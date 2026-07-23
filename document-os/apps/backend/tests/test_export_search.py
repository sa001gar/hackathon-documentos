"""Export rendering + workspace search."""


def _fill_doc(client, headers, doc_id):
    sections = client.get(f"/api/v1/documents/{doc_id}", headers=headers).json()["sections"]
    section = sections[0]
    client.put(
        f"/api/v1/sections/{section['id']}/content",
        headers=headers,
        json={"content": "# Overview\n\nA paragraph with **bold** text.\n\n- one\n- two\n\n| A | B |\n|---|---|\n| 1 | 2 |"},
    )
    return section


def test_export_all_formats_and_download(client, auth_headers, doc_id):
    _fill_doc(client, auth_headers, doc_id)
    for fmt in ("markdown", "html", "pdf", "docx", "json"):
        resp = client.post(
            f"/api/v1/documents/{doc_id}/export", headers=auth_headers, json={"format": fmt}
        )
        assert resp.status_code == 201, f"{fmt}: {resp.text}"
        export = resp.json()
        assert export["status"] == "completed"
        dl = client.get(f"/api/v1/exports/{export['id']}/download", headers=auth_headers)
        assert dl.status_code == 200, f"{fmt} download failed"
        assert len(dl.content) > 100, f"{fmt} export suspiciously small"
        if fmt == "pdf":
            assert dl.content[:5] == b"%PDF-"
        if fmt == "docx":
            assert dl.content[:2] == b"PK"  # zip container


def test_search_finds_documents_and_sections(client, auth_headers, workspace_id, doc_id):
    _fill_doc(client, auth_headers, doc_id)
    resp = client.get(
        f"/api/v1/search?q=Overview&workspace_id={workspace_id}", headers=auth_headers
    )
    assert resp.status_code == 200, resp.text
    results = resp.json()
    assert results["query"] == "Overview"
    assert any(s["title"] for s in results["sections"])

    resp = client.get(
        f"/api/v1/search?q=Renamed&workspace_id={workspace_id}", headers=auth_headers
    )
    assert any(d["id"] == doc_id for d in resp.json()["documents"])
