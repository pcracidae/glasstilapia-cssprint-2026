from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth import current_owner
from app.ledger import entries_for_owner
from app.main import app
from app.routes import shares

client = TestClient(app)

TODAY = date.today()
ALL = ["profile", "cash_flow", "monthly", "receivables", "entries"]


def share_body(**overrides) -> dict:
    body = {
        "lender_name": "San Isidro Cooperative",
        "purpose": "Loan application",
        "date_from": (TODAY - timedelta(days=29)).isoformat(),
        "date_to": TODAY.isoformat(),
        "expires_in_days": 7,
    }
    return body | overrides


@pytest.fixture(autouse=True)
def clean_store():
    shares._shares.clear()
    yield
    shares._shares.clear()
    app.dependency_overrides.clear()


def create(**overrides) -> dict:
    r = client.post("/api/shares", json=share_body(**overrides))
    assert r.status_code == 201, r.text
    return r.json()


def test_default_share_is_profile_and_cash_flow_only():
    share = create()
    r = client.get(f"/api/shared/{share['token']}",
                   headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14)"})
    assert r.status_code == 200
    rec = r.json()["records"]
    assert rec["sections"] == ["profile", "cash_flow"]
    assert rec["profile"]["store_name"] == "Aling Nena's Sari-sari Store"
    cf = rec["cash_flow"]
    assert cf["income"] > 0 and cf["profit"] == cf["income"] - cf["expenses"]
    assert rec["monthly"] is None and rec["receivables"] is None and rec["entries"] is None
    assert r.json()["csv_available"] is False

    views = client.get(f"/api/shares/{share['id']}/views").json()
    assert views == [views[0]] and views[0]["device"] == "Android phone"
    assert views[0]["action"] == "opened"


def test_owner_can_share_every_section():
    share = create(sections=ALL, date_from=(TODAY - timedelta(days=59)).isoformat())
    rec = client.get(f"/api/shared/{share['token']}").json()["records"]
    assert rec["sections"] == ALL
    assert len(rec["monthly"]) >= 2
    r = rec["receivables"]
    assert r["outstanding"] == r["age_0_30"] + r["age_31_60"] + r["age_over_60"]
    assert rec["entries"] and set(rec["entries"][0]) == {"sale_date", "kind", "amount", "tier", "late"}


def test_customer_names_and_notes_never_leave():
    names = {e.customer for e in entries_for_owner("nena") if e.customer}
    notes = {e.note for e in entries_for_owner("nena") if e.note}
    assert names  # the sample has utang customers, so this test means something

    share = create(sections=ALL)
    bodies = [
        client.get(f"/api/shared/{share['token']}").text,
        client.get(f"/api/shared/{share['token']}/entries.csv").text,
        client.post("/api/shares/preview", json=share_body(sections=ALL)).text,
        client.get("/api/exports/entries.csv", params={
            "date_from": share_body()["date_from"], "date_to": TODAY.isoformat()}).text,
    ]
    for body in bodies:
        for text in names | notes:
            assert text not in body


def test_lender_csv_only_when_entries_were_shared():
    summary_only = create()
    assert client.get(f"/api/shared/{summary_only['token']}/entries.csv").status_code == 404

    share = create(sections=["entries"])
    r = client.get(f"/api/shared/{share['token']}/entries.csv")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    assert r.text.splitlines()[0] == "date,kind,amount_php,trust_tier,late_entry"
    assert "attachment" in r.headers["content-disposition"]
    actions = [v["action"] for v in client.get(f"/api/shares/{share['id']}/views").json()]
    assert actions == ["downloaded CSV"]


def test_owner_export_is_a_plain_download():
    r = client.get("/api/exports/entries.csv", params={
        "date_from": (TODAY - timedelta(days=6)).isoformat(), "date_to": TODAY.isoformat()})
    assert r.status_code == 200
    rows = r.text.strip().splitlines()
    assert rows[0] == "date,kind,amount_php,trust_tier,late_entry" and len(rows) > 7
    assert client.get("/api/shares").json() == []  # exporting doesn't create a share


def test_owner_export_rejects_bad_ranges():
    r = client.get("/api/exports/entries.csv", params={
        "date_from": TODAY.isoformat(), "date_to": (TODAY - timedelta(days=1)).isoformat()})
    assert r.status_code == 422


def test_preview_matches_what_the_lender_sees():
    preview = client.post("/api/shares/preview", json=share_body(sections=ALL)).json()
    share = create(sections=ALL)
    seen = client.get(f"/api/shared/{share['token']}").json()
    assert preview["records"] == seen["records"]


def test_revoked_link_stops_working_at_once():
    share = create(sections=ALL)
    r = client.post(f"/api/shares/{share['id']}/revoke")
    assert r.status_code == 200 and r.json()["status"] == "revoked"
    assert client.get(f"/api/shared/{share['token']}").status_code == 404
    assert client.get(f"/api/shared/{share['token']}/entries.csv").status_code == 404


def test_expired_link_stops_working():
    share = create()
    shares._shares[share["id"]].expires_at -= timedelta(days=8)
    assert client.get(f"/api/shared/{share['token']}").status_code == 404
    assert client.get("/api/shares").json()[0]["status"] == "expired"


def test_wrong_expired_and_revoked_links_look_the_same():
    expired = create()
    shares._shares[expired["id"]].expires_at -= timedelta(days=8)
    revoked = create()
    client.post(f"/api/shares/{revoked['id']}/revoke")
    replies = [client.get(f"/api/shared/{t}").json()
               for t in (expired["token"], revoked["token"], "not-a-real-token")]
    assert replies[0] == replies[1] == replies[2]


def test_only_the_token_hash_is_stored():
    share = create()
    rec = shares._shares[share["id"]]
    assert share["token"] not in rec.model_dump_json()
    assert len(share["token"]) >= 43  # 32 random bytes


def test_lender_page_is_not_cached():
    share = create()
    r = client.get(f"/api/shared/{share['token']}")
    assert r.headers["cache-control"] == "no-store"
    assert r.headers["referrer-policy"] == "no-referrer"


def test_other_owners_cannot_see_or_revoke_my_shares():
    share = create()
    app.dependency_overrides[current_owner] = lambda: "someone-else"
    assert client.get("/api/shares").json() == []
    assert client.post(f"/api/shares/{share['id']}/revoke").status_code == 404
    assert client.get(f"/api/shares/{share['id']}/views").status_code == 404


@pytest.mark.parametrize("overrides", [
    {"date_from": TODAY.isoformat(), "date_to": (TODAY - timedelta(days=1)).isoformat()},
    {"date_to": (TODAY + timedelta(days=1)).isoformat()},
    {"date_from": (TODAY - timedelta(days=400)).isoformat()},
    {"expires_in_days": 365},
    {"lender_name": ""},
    {"sections": []},
    {"sections": ["customer_names"]},
])
def test_bad_requests_are_rejected(overrides):
    assert client.post("/api/shares", json=share_body(**overrides)).status_code == 422
