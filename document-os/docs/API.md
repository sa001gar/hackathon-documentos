# DocumentOS — API Contract (v1)

Base URL: `/api/v1`. Auth: `Authorization: Bearer <access_token>` unless marked public.

Error envelope (all non-2xx):
```json
{ "error": { "code": "not_found", "detail": "Document not found" } }
```

All IDs are UUID strings. Timestamps are ISO-8601 UTC.

---

## Auth (public)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{email, password, full_name}` | `201 AuthResponse` |
| POST | `/auth/login` | form-encoded (`username`, `password`) — OAuth2 password | `200 AuthResponse` |
| POST | `/auth/refresh` | `{refresh_token}` | `200 AuthResponse` |

```ts
AuthResponse = { user: User; access_token: string; refresh_token: string; token_type: "bearer" }
User = { id: string; email: string; full_name: string; avatar_url: string | null; is_active: boolean; created_at: string }
```

## Users

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/users/me` | — | `User` |
| PATCH | `/users/me` | `{full_name?, avatar_url?}` | `User` |
| GET | `/users/me/settings` | — | `UserSettings` (auto-created) |
| PATCH | `/users/me/settings` | partial | `UserSettings` |

```ts
UserSettings = { id: string; user_id: string; theme: "light"|"dark"|"system";
  autosave_interval_ms: number; default_model: string | null;
  preferences: Record<string, unknown>; created_at: string; updated_at: string }
```

## Workspaces

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/workspaces` | — | `Workspace[]` (workspaces of current user) |
| POST | `/workspaces` | `{name, description?}` | `201 Workspace` |
| GET / PATCH / DELETE | `/workspaces/{id}` | `{name?, description?}` | `Workspace` / `204` |

```ts
Workspace = { id: string; name: string; slug: string; description: string | null;
  owner_id: string; created_at: string; updated_at: string }
```

## Projects

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/workspaces/{wid}/projects` | — | `Project[]` |
| POST | `/workspaces/{wid}/projects` | `{name, description?, color?, icon?}` | `201 Project` |
| GET / PATCH / DELETE | `/projects/{id}` | `{name?, description?, color?, icon?}` | `Project` / `204` |

```ts
Project = { id: string; workspace_id: string; name: string; description: string | null;
  color: string; icon: string | null; created_at: string; updated_at: string }
```

## Documents

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/projects/{pid}/documents` | — | `DocumentSummary[]` |
| POST | `/projects/{pid}/documents` | `{title, description?, template_id?}` | `201 DocumentDetail` |
| GET | `/documents/{id}` | — | `DocumentDetail` |
| PATCH | `/documents/{id}` | `{title?, description?, status?, is_public?}` | `DocumentSummary` |
| DELETE | `/documents/{id}` | — | `204` |
| GET | `/documents/{id}/markdown` | — | `{markdown: string}` (full doc, headings by depth) |
| GET | `/documents/{id}/activity` | — | `ActivityEntry[]` |
| GET (public) | `/public/documents/{id}` | — | `DocumentDetail` (if is_public is true) |
| GET (public) | `/public/documents/{id}/markdown` | — | `{markdown: string}` (if is_public is true) |

Creating with `template_id` materializes the template tree as sections (status `pending`).

```ts
DocumentSummary = { id: string; project_id: string; template_id: string | null;
  title: string; description: string | null;
  status: "draft"|"generating"|"generated"|"validated"|"reviewed"|"exported";
  is_public: boolean;
  section_count: number; word_count: number;
  created_by: string; created_at: string; updated_at: string }
DocumentDetail = DocumentSummary & { sections: Section[] }   // flat, ordered (parent_id, order_index)
ActivityEntry = { id: string; agent: string; action: string; status: string;
  section_id: string | null; detail: string | null; created_at: string }
```

## Sections

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/documents/{did}/sections` | `{title, parent_id?, order_index?, content?}` | `201 Section` |
| GET | `/sections/{id}` | — | `Section` |
| PATCH | `/sections/{id}` | `{title?, order_index?, status?}` | `Section` |
| PUT | `/sections/{id}/content` | `{content, source?, change_summary?}` | `Section` |
| POST | `/sections/{id}/move` | `{parent_id: string\|null, order_index}` | `Section` |
| DELETE | `/sections/{id}` | — | `204` (deletes subtree) |

`PUT content` creates a new `DocumentVersion` (source `manual` unless specified) and updates `word_count`.

```ts
Section = { id: string; document_id: string; parent_id: string | null;
  title: string; content: string;            // markdown
  order_index: number;
  status: "pending"|"generating"|"draft"|"reviewed"|"validated"|"error";
  ai_prompt: string | null; word_count: number;
  metadata: Record<string, unknown>; created_at: string; updated_at: string }
```

## Versions

| Method | Path | Response |
|---|---|---|
| GET | `/sections/{sid}/versions` | `Version[]` (newest first) |
| GET | `/versions/{id}` | `Version` |
| POST | `/versions/{id}/restore` | `Section` (content restored; a NEW version is appended) |

```ts
Version = { id: string; section_id: string; version: number; content: string;
  source: "manual"|"ai"|"restore"; agent: string | null;
  change_summary: string | null; created_at: string }
```

## Templates

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/templates?category=` | — | `Template[]` |
| GET | `/templates/{id}` | — | `Template` |
| POST | `/templates` | `{name, description?, category, structure}` | `201 Template` |

```ts
Template = { id: string; name: string; description: string | null; category: string;
  structure: TemplateSection[]; is_builtin: boolean; created_at: string }
TemplateSection = { title: string; prompt?: string; children?: TemplateSection[] }
```

## AI (all routed through the AI Engine — never direct model calls)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/documents/{id}/generate` | `{prompt, use_existing_structure?}` | `202 GenerationJob` |
| GET | `/generation-jobs/{id}` | — | `GenerationJob` |
| POST | `/generation-jobs/{id}/cancel` | — | `GenerationJob` |
| POST | `/sections/{id}/generate` | `{instructions?}` | `Section` (regenerated by Writer agent) |
| POST | `/sections/{id}/generate/stream` | `{instructions?}` | SSE stream (see below) |
| POST | `/sections/{id}/refine` | `{action, selected_text, instruction?}` | `{refined_text: string, action}` |
| POST | `/documents/{id}/validate` | — | `ValidationReport` |
| POST | `/documents/{id}/review` | — | `ReviewReport` |

`generate`: if the document has no sections (or `use_existing_structure` is false), the Planner agent builds the outline first; then each section is generated sequentially by the Writer agent. Resumable: completed sections are skipped on retry.

```ts
GenerationJob = { id: string; document_id: string;
  status: "pending"|"running"|"completed"|"failed"|"cancelled";
  total_sections: number; completed_sections: number;
  current_section_id: string | null; error: string | null;
  payload: Record<string, unknown>;
  created_at: string; started_at: string | null; finished_at: string | null }

RefineAction = "rewrite"|"improve"|"expand"|"shorten"|"professional"|"friendly"|
  "academic"|"legal"|"fix_grammar"|"summarize"|"continue"|"translate"

ValidationIssue = { type: "missing_section"|"duplicate"|"terminology"|"structure"|"formatting"|"broken_reference";
  severity: "error"|"warning"|"info"; message: string;
  section_id: string | null; suggestion: string | null }
ValidationReport = { is_valid: boolean; summary: string; issues: ValidationIssue[]; checked_at: string }

ReviewReport = { overall_score: number;      // 0-100
  readability: number; completeness: number; confidence: number;   // 0-100
  strengths: string[]; suggestions: string[]; summary: string }
```

### SSE stream format (`POST /sections/{id}/generate/stream`)
`Content-Type: text/event-stream`. Events:
```
data: {"type":"token","value":"..."}
data: {"type":"done","section": <Section>}
data: {"type":"error","message":"..."}
```

## Search

| Method | Path | Response |
|---|---|---|
| GET | `/search?q=...&workspace_id=...` | `SearchResults` |

```ts
SearchResults = { query: string;
  projects: {id, name}[]; documents: {id, title, project_id, snippet}[];
  sections: {id, document_id, title, snippet}[] }
```

## Exports

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/documents/{id}/export` | `{format: "markdown"\|"html"\|"pdf"\|"docx"\|"json"}` | `201 Export` |
| GET | `/exports/{id}/download` | — | file download |

```ts
Export = { id: string; document_id: string; format: string; status: string;
  file_path: string; created_at: string }
```

## Health (public)

| GET | `/health` (root, not under /api/v1) | `{status:"ok", service, ai_provider, gemma_model}` |
