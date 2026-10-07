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
