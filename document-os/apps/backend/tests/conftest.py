"""Test fixtures: isolated sqlite DB, mock AI provider, authenticated client."""
import os
import uuid

# Environment MUST be set before any app import (settings are cached).
os.environ["DATABASE_URL"] = "sqlite:///./test_documentos.db"
os.environ["AI_PROVIDER"] = "mock"
os.environ["EXPORT_DIR"] = "./test_exports"

# Start from a clean DB (teardown can't unlink it on Windows while connections linger).
for _path in ("./test_documentos.db",):
    if os.path.exists(_path):
        os.remove(_path)

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings

get_settings.cache_clear()

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c
    from app.db.session import engine

    engine.dispose()
    import shutil

    if os.path.isdir("./test_exports"):
        shutil.rmtree("./test_exports", ignore_errors=True)


@pytest.fixture(scope="session")
def auth_headers(client) -> dict:
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "testpass123", "full_name": "Test User"},
    )
    assert resp.status_code == 201, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def workspace_id(client, auth_headers) -> str:
    resp = client.get("/api/v1/workspaces", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()[0]["id"]


@pytest.fixture(scope="session")
def project_id(client, auth_headers, workspace_id) -> str:
    resp = client.get(f"/api/v1/workspaces/{workspace_id}/projects", headers=auth_headers)
    assert resp.status_code == 200
    return resp.json()[0]["id"]


@pytest.fixture(scope="session")
def doc_id(client, auth_headers, project_id) -> str:
    resp = client.post(
        f"/api/v1/projects/{project_id}/documents",
        headers=auth_headers,
        json={"title": "Test Document"},
    )
    assert resp.status_code == 201, resp.text
    document_id = resp.json()["id"]
    resp = client.post(
        f"/api/v1/documents/{document_id}/sections",
        headers=auth_headers,
        json={"title": "Overview"},
    )
    assert resp.status_code == 201, resp.text
    return document_id
