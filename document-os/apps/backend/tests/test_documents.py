"""Document + template flows."""


def test_builtin_templates_seeded(client, auth_headers):
    resp = client.get("/api/v1/templates", headers=auth_headers)
    assert resp.status_code == 200
    names = [t["name"] for t in resp.json()]
    assert any("PRD" in n for n in names)
    assert len(names) >= 10


def test_create_document_from_template(client, auth_headers, project_id):
    templates = client.get("/api/v1/templates", headers=auth_headers).json()
    prd = next(t for t in templates if "PRD" in t["name"])
    resp = client.post(
        f"/api/v1/projects/{project_id}/documents",
        headers=auth_headers,
        json={"title": "My PRD", "template_id": prd["id"]},
    )
    assert resp.status_code == 201, resp.text
    doc = resp.json()
    assert doc["section_count"] > 0
    titles = [s["title"] for s in doc["sections"]]
    assert any("Overview" in t or "Introduction" in t for t in titles)
    # sections materialized as pending with writing briefs
    assert all(s["status"] == "pending" for s in doc["sections"])
    assert any(s["ai_prompt"] for s in doc["sections"])


def test_document_crud_and_markdown(client, auth_headers, project_id, doc_id):
    # list
    resp = client.get(f"/api/v1/projects/{project_id}/documents", headers=auth_headers)
    assert resp.status_code == 200
    assert any(d["id"] == doc_id for d in resp.json())

    # update
    resp = client.patch(
        f"/api/v1/documents/{doc_id}", headers=auth_headers, json={"title": "Renamed"}
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Renamed"

    # markdown endpoint
    resp = client.get(f"/api/v1/documents/{doc_id}/markdown", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["markdown"].startswith("# Renamed")


def test_document_ownership_isolation(client, auth_headers, doc_id):
    import uuid as _uuid

    other = f"other-{_uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": other, "password": "supersecret1", "full_name": "Other"},
    )
    other_headers = {"Authorization": f"Bearer {resp.json()['access_token']}"}
    resp = client.get(f"/api/v1/documents/{doc_id}", headers=other_headers)
    assert resp.status_code == 404  # no existence leak
