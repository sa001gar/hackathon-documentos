"""Auth flow: register, login, me, refresh, failures."""
import uuid


def test_register_login_me_refresh(client):
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "full_name": "Jane Doe"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["user"]["email"] == email
    assert body["access_token"] and body["refresh_token"]

    # default workspace + project bootstrapped
    headers = {"Authorization": f"Bearer {body['access_token']}"}
    workspaces = client.get("/api/v1/workspaces", headers=headers).json()
    assert len(workspaces) == 1
    projects = client.get(f"/api/v1/workspaces/{workspaces[0]['id']}/projects", headers=headers).json()
    assert len(projects) == 1

    # login (form-encoded, OAuth2 password flow)
    resp = client.post(
        "/api/v1/auth/login",
        data={"username": email, "password": "supersecret1"},
    )
    assert resp.status_code == 200, resp.text

    # me
    resp = client.get("/api/v1/users/me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "Jane Doe"

    # settings auto-created
    resp = client.get("/api/v1/users/me/settings", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["autosave_interval_ms"] == 1500

    # refresh
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": body["refresh_token"]})
    assert resp.status_code == 200, resp.text
    assert resp.json()["access_token"]


def test_wrong_password_rejected(client):
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "supersecret1", "full_name": "Jane"},
    )
    resp = client.post("/api/v1/auth/login", data={"username": email, "password": "wrong-password"})
    assert resp.status_code == 401


def test_duplicate_email_rejected(client):
    email = f"user-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "supersecret1", "full_name": "Jane"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_protected_route_requires_token(client):
    assert client.get("/api/v1/workspaces").status_code == 401
