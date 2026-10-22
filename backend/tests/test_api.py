from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_create_and_get_item():
    r = client.post("/api/items", json={"name": "demo"})
    assert r.status_code == 201
    item = r.json()
    assert item["name"] == "demo" and item["done"] is False

    r = client.get(f"/api/items/{item['id']}")
    assert r.status_code == 200


def test_missing_item_is_404():
    assert client.get("/api/items/99999").status_code == 404
