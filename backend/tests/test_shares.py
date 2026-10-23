from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.auth import current_owner
from app.ledger import entries_for_owner
from app.main import app
from app.routes import shares

client = TestClient(app)

TODAY = date.today()


def share_body(**overrides) -> dict:
    body = {
        "lender_name": "San Isidro Cooperative",
        "purpose": "Loan application: SB Corp P3",
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


def test_lender_sees_the_summary_and_view_is_logged():
    share = create()
    r = client.get(f"/api/shared/{share['token']}",
                   headers={"User-Agent": "Mozilla/5.0 (Linux; Android 14)"})
    assert r.status_code == 200
    view = r.json()
    assert view["lender_name"] == "San Isidro Cooperative"
    s = view["summary"]
    assert s["income"] > 0 and s["profit"] == s["income"] - s["expenses"]
    assert sum(s["income_by_tier"].values()) in (99, 100, 101)  # rounding
    assert view["entries"] is None  # totals only by default

    views = client.get(f"/api/shares/{share['id']}/views").json()
    assert len(views) == 1 and views[0]["device"] == "Android phone"
    assert client.get("/api/shares").json()[0]["view_count"] == 1


def test_customer_names_never_reach_the_lender():
    names = {e.customer for e in entries_for_owner("nena") if e.customer}
    notes = {e.note for e in entries_for_owner("nena") if e.note}
    assert names  # the sample has utang customers, so this test means something

    share = create(include_entries=True)
    body = client.get(f"/api/shared/{share['token']}").text
    preview = client.post("/api/shares/preview",
                          json=share_body(include_entries=True)).text
    for text in names | notes:
        assert text not in body
        assert text not in preview
    entry = client.get(f"/api/shared/{share['token']}").json()["entries"][0]
    assert set(entry) == {"sale_date", "kind", "amount", "tier", "late"}


def test_preview_matches_what_the_lender_sees():
    preview = client.post("/api/shares/preview", json=share_body()).json()
    share = create()
    seen = client.get(f"/api/shared/{share['token']}").json()
    assert preview["summary"] == seen["summary"]


def test_revoked_link_stops_working_at_once():
    share = create()
    r = client.post(f"/api/shares/{share['id']}/revoke")
    assert r.status_code == 200 and r.json()["status"] == "revoked"
    assert client.get(f"/api/shared/{share['token']}").status_code == 404


def test_expired_link_stops_working():
    share = create()
    shares._shares[share["id"]].expires_at -= timedelta(days=8)
    r = client.get(f"/api/shared/{share['token']}")
    assert r.status_code == 404
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


def test_program_id_is_kept_for_the_loan_tab():
    create(program_id="sbcorp-p3")
    assert client.get("/api/shares").json()[0]["program_id"] == "sbcorp-p3"


@pytest.mark.parametrize("overrides", [
    {"date_from": TODAY.isoformat(), "date_to": (TODAY - timedelta(days=1)).isoformat()},
    {"date_to": (TODAY + timedelta(days=1)).isoformat()},
    {"date_from": (TODAY - timedelta(days=200)).isoformat()},
    {"expires_in_days": 365},
    {"lender_name": ""},
])
def test_bad_requests_are_rejected(overrides):
    assert client.post("/api/shares", json=share_body(**overrides)).status_code == 422
