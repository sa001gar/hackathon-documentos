/**
 * Shared types mirroring docs/API.md. Single source of truth for the frontend.
 * Keep in sync with apps/backend/app/schemas.
 */

// ---------- Auth & users ----------
export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
}

export interface UserSettings {
  id: string;
  user_id: string;
  theme: "light" | "dark" | "system";
  autosave_interval_ms: number;
  default_model: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ---------- Workspaces / projects ----------
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

// ---------- Documents / sections ----------
export type DocumentStatus =
  | "draft"
  | "generating"
  | "generated"
  | "validated"
  | "reviewed"
  | "exported";

export type SectionStatus =
  | "pending"
  | "generating"
  | "draft"
  | "reviewed"
  | "validated"
  | "error";

export interface DocumentSummary {
  id: string;
  project_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  status: DocumentStatus;
  section_count: number;
  word_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  document_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  order_index: number;
  status: SectionStatus;
  ai_prompt: string | null;
  word_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentDetail extends DocumentSummary {
  sections: Section[];
}

/** Client-side tree node derived from the flat section list. */
export interface SectionNode extends Section {
  children: SectionNode[];
}

// ---------- Versions ----------
export interface Version {
  id: string;
  section_id: string;
  version: number;
  content: string;
  source: "manual" | "ai" | "restore";
  agent: string | null;
  change_summary: string | null;
  created_at: string;
}

// ---------- Templates ----------
export interface TemplateSection {
  title: string;
  prompt?: string;
  children?: TemplateSection[];
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  structure: TemplateSection[];
  is_builtin: boolean;
  created_at: string;
}

// ---------- AI ----------
export type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface GenerationJob {
  id: string;
  document_id: string;
  status: JobStatus;
  total_sections: number;
  completed_sections: number;
  current_section_id: string | null;
  error: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export type RefineAction =
  | "rewrite"
  | "improve"
  | "expand"
  | "shorten"
  | "professional"
  | "friendly"
  | "academic"
  | "legal"
  | "fix_grammar"
  | "summarize"
  | "continue"
  | "translate";

export interface RefineResponse {
  refined_text: string;
  action: RefineAction;
}

export type IssueType =
  | "missing_section"
  | "duplicate"
  | "terminology"
  | "structure"
  | "formatting"
  | "broken_reference";

export interface ValidationIssue {
  type: IssueType;
  severity: "error" | "warning" | "info";
  message: string;
  section_id: string | null;
  suggestion: string | null;
}

export interface ValidationReport {
  is_valid: boolean;
  summary: string;
  issues: ValidationIssue[];
  checked_at: string;
}

export interface ReviewReport {
  overall_score: number;
  readability: number;
  completeness: number;
  confidence: number;
  strengths: string[];
  suggestions: string[];
  summary: string;
}

// ---------- Search / activity / export ----------
export interface SearchResults {
  query: string;
  projects: { id: string; name: string }[];
  documents: { id: string; title: string; project_id: string; snippet: string }[];
  sections: { id: string; document_id: string; title: string; snippet: string }[];
}

export interface ActivityEntry {
  id: string;
  agent: string;
  action: string;
  status: string;
  section_id: string | null;
  detail: string | null;
  created_at: string;
}

export type ExportFormat = "markdown" | "html" | "pdf" | "docx" | "json";

export interface Export {
  id: string;
  document_id: string;
  format: ExportFormat;
  status: string;
  file_path: string;
  created_at: string;
}

// ---------- SSE streaming ----------

/** Full-document generation pipeline events (POST /documents/{id}/generate/stream). */
export type DocGenEvent =
  | { type: "generation_started"; document_id: string }
  | { type: "planning_started" }
  | {
      type: "outline_created";
      title: string;
      total: number;
      sections: { id: string; title: string; status: "queued" | "completed" }[];
    }
  | { type: "section_started"; section_id: string; title: string; index: number; total: number }
  | { type: "token"; section_id: string; value: string }
  | { type: "section_completed"; section: Section }
  | { type: "section_failed"; section_id: string; title: string; message: string }
  | { type: "generation_completed"; document_id: string; total: number; succeeded: number; failed: number }
  | { type: "error"; message: string };

/** Single-section generation events (POST /sections/{id}/generate/stream). */
export type StreamEvent =
  | { type: "token"; value: string }
  | { type: "done"; section: Section }
  | { type: "error"; message: string };

export interface ApiError {
  error: { code: string; detail: string };
}
