"""Section CRUD, versioned content saves, moves, restore."""


def _create_section(client, headers, doc_id, title="Overview", parent_id=None):
    payload = {"title": title}
    if parent_id:
        payload["parent_id"] = parent_id
    resp = client.post(f"/api/v1/documents/{doc_id}/sections", headers=headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_section_lifecycle_and_versions(client, auth_headers, doc_id):
    section = _create_section(client, auth_headers, doc_id)
    child = _create_section(client, auth_headers, doc_id, title="Details", parent_id=section["id"])
    assert child["parent_id"] == section["id"]

    # first save → version 1, status draft
    resp = client.put(
        f"/api/v1/sections/{section['id']}/content",
        headers=auth_headers,
        json={"content": "First draft of the overview."},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"
    assert resp.json()["word_count"] == 5

    # second save → version 2
    client.put(
        f"/api/v1/sections/{section['id']}/content",
        headers=auth_headers,
        json={"content": "Second draft, slightly longer overview."},
    )
    versions = client.get(f"/api/v1/sections/{section['id']}/versions", headers=auth_headers).json()
    assert [v["version"] for v in versions] == [2, 1]  # newest first
    assert versions[0]["source"] == "manual"

    # restore v1 → creates version 3
    resp = client.post(f"/api/v1/versions/{versions[1]['id']}/restore", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["content"] == "First draft of the overview."
    versions = client.get(f"/api/v1/sections/{section['id']}/versions", headers=auth_headers).json()
    assert versions[0]["version"] == 3
    assert versions[0]["source"] == "restore"

    # move child to root
    resp = client.post(
        f"/api/v1/sections/{child['id']}/move",
        headers=auth_headers,
        json={"parent_id": None, "order_index": 5},
    )
    assert resp.status_code == 200
    assert resp.json()["parent_id"] is None


def test_section_delete_removes_subtree(client, auth_headers, doc_id):
    parent = _create_section(client, auth_headers, doc_id, title="Doomed")
    child = _create_section(client, auth_headers, doc_id, title="Doomed child", parent_id=parent["id"])
    resp = client.delete(f"/api/v1/sections/{parent['id']}", headers=auth_headers)
    assert resp.status_code == 204
    assert client.get(f"/api/v1/sections/{child['id']}", headers=auth_headers).status_code == 404
