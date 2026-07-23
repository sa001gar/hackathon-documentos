"""End-to-end smoke test of the whole DocumentOS flow (offline, mock AI).

Run:  python -m tests.smoke_test   (from apps/backend, venv active)
"""
import os
import sys
import tempfile
import time

# Isolate the test database and force the offline mock provider BEFORE app import.
_tmp = tempfile.mkdtemp(prefix="documentos-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["AI_PROVIDER"] = "mock"
os.environ["EXPORT_DIR"] = f"{_tmp}/exports"
os.environ["JWT_SECRET"] = "test-secret"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402

client = TestClient(create_app())
EMAIL = "demo@documentos.dev"


def check(name: str, ok: bool, extra: str = "") -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}" + (f" — {extra}" if extra else ""))
    if not ok:
        sys.exit(1)


# --- auth ---
r = client.post("/api/v1/auth/register-with-tokens", json={
    "email": EMAIL, "name": "Demo User", "password": "password123",
})
check("register", r.status_code == 201, str(r.status_code))
tokens = r.json()
headers = {"Authorization": f"Bearer {tokens['access_token']}"}

r = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": "password123"})
check("login", r.status_code == 200)

r = client.get("/api/v1/users/me", headers=headers)
check("me", r.status_code == 200 and r.json()["email"] == EMAIL)

# --- projects ---
r = client.get("/api/v1/projects", headers=headers)
check("list projects", r.status_code == 200 and len(r.json()) >= 1)
project_id = r.json()[0]["id"]

# --- templates ---
r = client.get("/api/v1/templates", headers=headers)
templates = r.json()
check("seeded templates", r.status_code == 200 and len(templates) >= 8, f"{len(templates)} templates")
prd = next(t for t in templates if t["doc_type"] == "prd")

# --- planner ---
r = client.post("/api/v1/ai/plan", headers=headers, json={
    "prompt": "A mobile app that helps students plan revision schedules with AI",
    "doc_type": "prd", "template_id": prd["id"],
})
plan = r.json()
check("planner plan", r.status_code == 200 and len(plan["sections"]) >= 4, plan.get("title", ""))

# --- document ---
r = client.post("/api/v1/documents", headers=headers, json={
    "project_id": project_id, "title": plan["title"], "doc_type": "prd",
    "template_id": prd["id"],
    "original_prompt": "A mobile app that helps students plan revision schedules with AI",
    "plan": {"title": plan["title"], "sections": plan["sections"]},
})
doc = r.json()
check("create document from plan", r.status_code == 201 and len(doc["sections"]) > 0)
doc_id = doc["id"]
first_section = doc["sections"][0]

# --- generation job ---
r = client.post(f"/api/v1/documents/{doc_id}/generate", headers=headers)
check("start generation job", r.status_code == 202)
job_id = r.json()["id"]

for _ in range(60):
    time.sleep(0.5)
    job = client.get(f"/api/v1/jobs/{job_id}", headers=headers).json()
    if job["status"] in ("completed", "failed", "cancelled"):
        break
check("job completed", job["status"] == "completed",
      f"{job['completed_sections']}/{job['total_sections']} status={job['status']}")

r = client.get(f"/api/v1/documents/{doc_id}", headers=headers)
doc = r.json()
leaf = doc["sections"][0]
check("sections generated", all(s["status"] in ("done", "edited") for s in doc["sections"]))
check("section has content", len(leaf["content"]) > 100)

# --- section edit + autosave + versioning ---
r = client.patch(f"/api/v1/sections/{leaf['id']}", headers=headers, json={
    "content": leaf["content"] + "\n\nManually added paragraph for the smoke test.",
    "base_updated_at": leaf["updated_at"],
    "source": "manual", "change_summary": "Manual edit",
})
check("autosave section (optimistic)", r.status_code == 200)

r = client.get(f"/api/v1/sections/{leaf['id']}/versions", headers=headers)
versions = r.json()
check("version history", len(versions) >= 2, f"{len(versions)} versions")

r = client.get(f"/api/v1/sections/{leaf['id']}/compare?a=1&b=2", headers=headers)
check("version compare", r.status_code == 200 and len(r.json()["lines"]) > 0)

r = client.post(f"/api/v1/sections/{leaf['id']}/versions/1/restore", headers=headers)
check("restore version", r.status_code == 200)

# conflict detection
r = client.patch(f"/api/v1/sections/{leaf['id']}", headers=headers, json={
    "content": "stale write", "base_updated_at": "2000-01-01T00:00:00Z",
})
check("conflict detected (409)", r.status_code == 409)

# --- refiner ---
r = client.post("/api/v1/ai/refine", headers=headers, json={
    "text": "The app helps students study.", "action": "expand", "section_id": leaf["id"],
})
check("refiner expand", r.status_code == 200 and len(r.json()["refined"]) > 40)

# --- single-section regeneration ---
r = client.post(f"/api/v1/sections/{leaf['id']}/generate", headers=headers,
                json={"extra_instructions": ""})
check("regenerate one section", r.status_code == 200)

# --- validation + review ---
r = client.post(f"/api/v1/ai/documents/{doc_id}/validate", headers=headers)
validation = r.json()
check("validator", r.status_code == 200 and "issues" in validation,
      f"passed={validation['passed']} issues={len(validation['issues'])}")

r = client.post(f"/api/v1/ai/documents/{doc_id}/review", headers=headers)
review = r.json()
check("reviewer", r.status_code == 200 and 0 <= review["score"] <= 100,
      f"score={review['score']}")

# --- search ---
r = client.get("/api/v1/search?q=revision", headers=headers)
check("search", r.status_code == 200 and len(r.json()["items"]) > 0)

# --- exports ---
for fmt in ("md", "json", "html", "docx", "pdf"):
    r = client.post(f"/api/v1/exports/documents/{doc_id}", headers=headers,
                    json={"format": fmt})
    ok = r.status_code == 201
    if ok:
        dl = client.get(f"/api/v1/exports/{r.json()['id']}/download", headers=headers)
        ok = dl.status_code == 200 and len(dl.content) > 200
    check(f"export {fmt}", ok)

# --- AI logs (traceability) ---
r = client.get(f"/api/v1/ai/documents/{doc_id}/logs", headers=headers)
check("ai logs", r.status_code == 200 and len(r.json()) > 0, f"{len(r.json())} traced calls")

print("\nALL SMOKE TESTS PASSED")
