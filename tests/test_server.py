import pytest
from fastapi.testclient import TestClient

import app as web
import plaid
from pipeline import demo_transactions


@pytest.fixture
def client(monkeypatch):
    for key in ["PLAID_CLIENT_ID", "PLAID_SECRET", "SESSION_SECRET"]:
        monkeypatch.delenv(key, raising=False)
    with TestClient(web.app) as client:
        yield client


def configured(monkeypatch):
    monkeypatch.setenv("PLAID_CLIENT_ID", "test-id")
    monkeypatch.setenv("PLAID_SECRET", "test-secret")
    monkeypatch.setenv("SESSION_SECRET", "test-encryption-key-with-32-characters")


def test_pages_export_and_missing_configuration(client):
    assert client.get("/").status_code == 200
    assert client.get("/?view=pipeline").status_code == 200
    exported = client.get("/export")
    assert exported.status_code == 200
    assert isinstance(exported.json(), list)
    assert "attachment" in exported.headers["content-disposition"]
    response = client.post(
        "/api/plaid", json={"action": "link"}, headers={"Origin": "http://testserver"}
    )
    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"


def test_origin_and_body_validation(client):
    assert client.post("/api/plaid", json={"action": "link"}).status_code == 403
    assert (
        client.post(
            "/api/plaid",
            json={"action": "link"},
            headers={"Origin": "http://evil.example"},
