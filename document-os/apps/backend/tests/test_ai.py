"""AI flows against the deterministic mock provider."""
import time


def test_full_generation_job(client, auth_headers, project_id):
    resp = client.post(
        f"/api/v1/projects/{project_id}/documents",
        headers=auth_headers,
        json={"title": "Generated Handbook"},
    )
    doc_id = resp.json()["id"]

    resp = client.post(
        f"/api/v1/documents/{doc_id}/generate",
        headers=auth_headers,
        json={"prompt": "An employee onboarding handbook for a remote-first startup"},
    )
    assert resp.status_code == 202, resp.text
    job = resp.json()
    assert job["status"] in ("pending", "running")

    # poll until terminal (mock provider is fast)
    final = None
    for _ in range(60):
        current = client.get(f"/api/v1/generation-jobs/{job['id']}", headers=auth_headers).json()
        if current["status"] in ("completed", "failed", "cancelled"):
            final = current
            break
        time.sleep(0.5)
    assert final is not None, "job did not finish in time"
    assert final["status"] == "completed", final
    assert final["completed_sections"] == final["total_sections"] > 0

    # sections were written by the writer agent (with versions + activity)
    doc = client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers).json()
    assert doc["status"] == "generated"
    assert all(s["status"] == "draft" for s in doc["sections"])
    assert all(s["content"] for s in doc["sections"])

    versions = client.get(
        f"/api/v1/sections/{doc['sections'][0]['id']}/versions", headers=auth_headers
    ).json()
    assert versions[0]["source"] == "ai"
    assert versions[0]["agent"] == "writer"

    activity = client.get(f"/api/v1/documents/{doc_id}/activity", headers=auth_headers).json()
    agents = {a["agent"] for a in activity}
    assert {"planner", "writer"} <= agents


def test_refine_validate_review(client, auth_headers, doc_id):
    # ensure content exists
    sections = client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers).json()["sections"]
    section = sections[0]
    client.put(
        f"/api/v1/sections/{section['id']}/content",
        headers=auth_headers,
        json={"content": "Hiring is slow. Candidates drop out. Teams lose momentum every week."},
    )

    resp = client.post(
        f"/api/v1/sections/{section['id']}/refine",
        headers=auth_headers,
        json={"action": "expand", "selected_text": "Hiring is slow."},
    )
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["refined_text"]) > len("Hiring is slow.")

    resp = client.post(f"/api/v1/documents/{doc_id}/validate", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    report = resp.json()
    assert "is_valid" in report and "issues" in report and report["checked_at"]

    resp = client.post(f"/api/v1/documents/{doc_id}/review", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    review = resp.json()
    assert 0 <= review["overall_score"] <= 100
    assert len(review["suggestions"]) >= 1


def test_stream_section_generation(client, auth_headers, doc_id):
    sections = client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers).json()["sections"]
    section = sections[0]
    resp = client.post(
        f"/api/v1/sections/{section['id']}/generate/stream",
        headers=auth_headers,
        json={"instructions": "Keep it brief."},
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"].startswith("text/event-stream")
    body = resp.text
    assert '"type": "token"' in body or '"type":"token"' in body
    assert '"type": "done"' in body or '"type":"done"' in body
