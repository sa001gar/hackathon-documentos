import type {
  ActivityEntry,
  AuthResponse,
  DocumentDetail,
  DocumentStatus,
  DocumentSummary,
  Export,
  ExportFormat,
  GenerationJob,
  Project,
  RefineAction,
  RefineResponse,
  ReviewReport,
  SearchResults,
  Section,
  SectionStatus,
  Template,
  User,
  UserSettings,
  ValidationReport,
  Version,
  Workspace,
} from "@documentos/shared-types";
import { useAuthStore } from "./auth-store";

const BASE = "/api/v1";

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

/** Single-flight refresh promise shared across concurrent 401s. */
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const { refreshToken, setTokens, logout } = useAuthStore.getState();
      if (!refreshToken) return false;
      try {
        const res = await fetch(`${BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = (await res.json()) as AuthResponse;
        setTokens(data.access_token, data.refresh_token, data.user);
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      // Allow the next refresh attempt after this one settles.
      setTimeout(() => {
        refreshPromise = null;
      }, 0);
    });
  }
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  formData?: FormData;
  formEncoded?: Record<string, string>;
  signal?: AbortSignal;
  /** Skip the Authorization header (public endpoints). */
  public?: boolean;
  /** Internal: avoid infinite retry loops. */
  _retried?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { accessToken, logout } = useAuthStore.getState();
  const headers: Record<string, string> = {};
  if (!opts.public && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let body: BodyInit | undefined;
  if (opts.formEncoded) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(opts.formEncoded).toString();
  } else if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? (body !== undefined ? "POST" : "GET"),
      headers,
      body,
      signal: opts.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiClientError(0, "network_error", "Network unavailable — check your connection");
  }

  if (res.status === 401 && !opts.public && !opts._retried) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, { ...opts, _retried: true });
    logout();
    if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
      window.location.assign("/login");
    }
    throw new ApiClientError(401, "unauthorized", "Session expired");
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const envelope = data as { error?: { code?: string; detail?: string } } | undefined;
    throw new ApiClientError(
      res.status,
      envelope?.error?.code ?? `http_${res.status}`,
      envelope?.error?.detail ?? `Request failed (${res.status})`,
    );
  }
  return data as T;
}

/** Authenticated fetch returning a raw Response (downloads, SSE). */
export async function rawRequest(path: string, opts: RequestOptions = {}): Promise<Response> {
  const { accessToken, logout } = useAuthStore.getState();
  const headers: Record<string, string> = { ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (res.status === 401 && !opts._retried) {
    const ok = await tryRefresh();
    if (ok) return rawRequest(path, { ...opts, _retried: true });
    logout();
    window.location.assign("/login");
    throw new ApiClientError(401, "unauthorized", "Session expired");
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    let code = `http_${res.status}`;
    try {
      const data = (await res.json()) as { error?: { code?: string; detail?: string } };
      if (data.error?.detail) detail = data.error.detail;
      if (data.error?.code) code = data.error.code;
    } catch {
      /* not JSON */
    }
    throw new ApiClientError(res.status, code, detail);
  }
  return res;
}

// ---------------- Endpoint groups ----------------

export const authApi = {
  register: (body: { email: string; password: string; full_name: string }) =>
    request<AuthResponse>("/auth/register", { body, public: true }),
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      formEncoded: { username: email, password },
      public: true,
    }),
  refresh: (refreshToken: string) =>
    request<AuthResponse>("/auth/refresh", { body: { refresh_token: refreshToken }, public: true }),
};

export const usersApi = {
  me: () => request<User>("/users/me"),
  updateMe: (body: { full_name?: string; avatar_url?: string }) =>
    request<User>("/users/me", { method: "PATCH", body }),
  settings: () => request<UserSettings>("/users/me/settings"),
  updateSettings: (body: Partial<Pick<UserSettings, "theme" | "autosave_interval_ms" | "default_model" | "preferences">>) =>
    request<UserSettings>("/users/me/settings", { method: "PATCH", body }),
};

export const workspaceApi = {
  list: () => request<Workspace[]>("/workspaces"),
  create: (body: { name: string; description?: string }) =>
    request<Workspace>("/workspaces", { body }),
  update: (id: string, body: { name?: string; description?: string }) =>
    request<Workspace>(`/workspaces/${id}`, { method: "PATCH", body }),
  remove: (id: string) => request<void>(`/workspaces/${id}`, { method: "DELETE" }),
};

export const projectApi = {
  list: (workspaceId: string) => request<Project[]>(`/workspaces/${workspaceId}/projects`),
  create: (workspaceId: string, body: { name: string; description?: string; color?: string; icon?: string }) =>
    request<Project>(`/workspaces/${workspaceId}/projects`, { body }),
  update: (id: string, body: { name?: string; description?: string; color?: string; icon?: string }) =>
    request<Project>(`/projects/${id}`, { method: "PATCH", body }),
  remove: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),
};

export const documentApi = {
  list: (projectId: string) => request<DocumentSummary[]>(`/projects/${projectId}/documents`),
  create: (projectId: string, body: { title: string; description?: string; template_id?: string }) =>
    request<DocumentDetail>(`/projects/${projectId}/documents`, { body }),
  get: (id: string) => request<DocumentDetail>(`/documents/${id}`),
  update: (id: string, body: { title?: string; description?: string; status?: DocumentStatus }) =>
    request<DocumentSummary>(`/documents/${id}`, { method: "PATCH", body }),
  remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  markdown: (id: string) => request<{ markdown: string }>(`/documents/${id}/markdown`),
  activity: (id: string) => request<ActivityEntry[]>(`/documents/${id}/activity`),
};

export const sectionApi = {
  create: (documentId: string, body: { title: string; parent_id?: string | null; order_index?: number; content?: string }) =>
    request<Section>(`/documents/${documentId}/sections`, { body }),
  get: (id: string) => request<Section>(`/sections/${id}`),
  update: (id: string, body: { title?: string; order_index?: number; status?: SectionStatus }) =>
    request<Section>(`/sections/${id}`, { method: "PATCH", body }),
  putContent: (id: string, body: { content: string; source?: "manual" | "ai" | "restore"; change_summary?: string }) =>
    request<Section>(`/sections/${id}/content`, { method: "PUT", body }),
  move: (id: string, body: { parent_id: string | null; order_index: number }) =>
    request<Section>(`/sections/${id}/move`, { body }),
  remove: (id: string) => request<void>(`/sections/${id}`, { method: "DELETE" }),
};

export const versionApi = {
  list: (sectionId: string) => request<Version[]>(`/sections/${sectionId}/versions`),
  get: (id: string) => request<Version>(`/versions/${id}`),
  restore: (id: string) => request<Section>(`/versions/${id}/restore`, { method: "POST", body: {} }),
};

export const templateApi = {
  list: (category?: string) =>
    request<Template[]>(`/templates${category ? `?category=${encodeURIComponent(category)}` : ""}`),
  get: (id: string) => request<Template>(`/templates/${id}`),
  create: (body: { name: string; description?: string; category: string; structure: unknown }) =>
    request<Template>("/templates", { body }),
};

export const aiApi = {
  generateDocument: (documentId: string, body: { prompt: string; use_existing_structure?: boolean }) =>
    request<GenerationJob>(`/documents/${documentId}/generate`, { body }),
  getJob: (jobId: string) => request<GenerationJob>(`/generation-jobs/${jobId}`),
  cancelJob: (jobId: string) => request<GenerationJob>(`/generation-jobs/${jobId}/cancel`, { method: "POST", body: {} }),
  generateSection: (sectionId: string, instructions?: string) =>
    request<Section>(`/sections/${sectionId}/generate`, { body: { instructions } }),
  refine: (sectionId: string, body: { action: RefineAction; selected_text: string; instruction?: string }) =>
    request<RefineResponse>(`/sections/${sectionId}/refine`, { body }),
  validate: (documentId: string) =>
    request<ValidationReport>(`/documents/${documentId}/validate`, { method: "POST", body: {} }),
  review: (documentId: string) =>
    request<ReviewReport>(`/documents/${documentId}/review`, { method: "POST", body: {} }),
  /** SSE stream — caller consumes response.body. */
  streamSection: (sectionId: string, instructions: string | undefined, signal: AbortSignal) =>
    rawRequest(`/sections/${sectionId}/generate/stream`, {
      body: instructions ? { instructions } : {},
      signal,
    }),
};

export const searchApi = {
  search: (q: string, workspaceId?: string) => {
    const params = new URLSearchParams({ q });
    if (workspaceId) params.set("workspace_id", workspaceId);
    return request<SearchResults>(`/search?${params.toString()}`);
  },
};

export const exportApi = {
  create: (documentId: string, format: ExportFormat) =>
    request<Export>(`/documents/${documentId}/export`, { body: { format } }),
  download: async (exportId: string, filename: string) => {
    const res = await rawRequest(`/exports/${exportId}/download`);
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") ?? "";
    const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1].replace(/"/g, "")) : filename;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};
