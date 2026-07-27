import type { DocumentDetail, Section } from "@documentos/shared-types";
import { formatRelativeTime } from "@documentos/utils";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Check,
  ChevronRight,
  Download,
  FileCode,
  FileText,
  Globe,
  List,
  Loader2,
  Lock,
  Share2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { markdownToHtml as renderMarkdown } from "@/lib/markdown";
import { DocumentStatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiClientError, documentApi } from "@/lib/api-client";

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function SectionView({ section }: { section: Section }) {
  const html = useMemo(() => renderMarkdown(section.content || "*No content in this section yet.*"), [section.content]);
  return (
    <section id={`section-${section.id}`} className="scroll-mt-20 py-4">
      <h2 className="text-xl font-bold tracking-tight text-foreground border-b border-border/40 pb-2 mb-3">
        {section.title}
      </h2>
      <div
        className="docos-prose prose prose-sm dark:prose-invert max-w-none text-foreground/90 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

export function PublicDocumentPage() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const {
    data: doc,
    isLoading,
    isError,
    error,
  } = useQuery<DocumentDetail>({
    queryKey: ["public-document", documentId],
    queryFn: () => documentApi.publicGet(documentId!),
    enabled: !!documentId,
  });

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      toast.success("Public link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportMarkdown = async () => {
    if (!documentId || !doc) return;
    try {
      const { markdown } = await documentApi.publicMarkdown(documentId);
      downloadFile(markdown, `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`, "text/markdown");
      toast.success("Downloaded Markdown document");
    } catch {
      toast.error("Failed to export Markdown");
    }
  };

  const handleExportHtml = () => {
    if (!doc) return;
    const bodyHtml = doc.sections.map((s) => `<h1>${s.title}</h1>\n` + renderMarkdown(s.content)).join("\n\n");
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; }
    h1 { border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 32px; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #18181b; color: #f4f4f5; padding: 16px; border-radius: 8px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>${doc.title}</h1>
  ${bodyHtml}
</body>
</html>`;
    downloadFile(fullHtml, `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.html`, "text/html");
    toast.success("Downloaded HTML document");
  };

  const handleExportJson = () => {
    if (!doc) return;
    downloadFile(JSON.stringify(doc, null, 2), `${doc.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`, "application/json");
    toast.success("Downloaded JSON structure");
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground">Loading public document…</p>
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    const isRestricted = error instanceof ApiClientError && (error.status === 404 || error.status === 403);
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
        <div className="max-w-md space-y-4 rounded-2xl border border-border p-8 bg-card shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            {isRestricted ? "Document is Private or Unavailable" : "Unable to Load Document"}
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isRestricted
              ? "This document is either private, unshared by the author, or does not exist. Please ask the document owner for public link access."
              : "An unexpected error occurred while fetching the shared document."}
          </p>
          <div className="pt-2 flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/login")}>
              Log in to DocumentOS
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="DocumentOS" className="h-5 w-5 object-contain" />
          <span className="text-sm font-bold tracking-tight">DocumentOS</span>
          <span className="hidden sm:inline-block rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold border border-emerald-500/30">
            Public View
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5 text-xs">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy Link"}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs bg-[#5551FF] hover:bg-[#4440FF] text-white">
                <Download className="h-3.5 w-3.5" />
                <span>Export Document</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-xs z-[110]">
              <DropdownMenuItem onClick={handleExportMarkdown} className="cursor-pointer gap-2">
                <FileText className="h-3.5 w-3.5" />
                <span>Markdown (.md)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportHtml} className="cursor-pointer gap-2">
                <Globe className="h-3.5 w-3.5" />
                <span>HTML (.html)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJson} className="cursor-pointer gap-2">
                <FileCode className="h-3.5 w-3.5" />
                <span>JSON (.json)</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Public Content Layout */}
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 sm:px-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Table of Contents Sidebar */}
        <aside className="lg:col-span-1 hidden lg:block">
          <div className="sticky top-20 space-y-3 rounded-xl border border-border/60 p-4 bg-card/50">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <List className="h-3.5 w-3.5 text-primary" />
              <span>Contents</span>
            </div>
            <nav className="space-y-1 text-xs">
              {doc.sections.map((s) => (
                <a
                  key={s.id}
                  href={`#section-${s.id}`}
                  className="flex items-center gap-1.5 py-1 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors truncate"
                >
                  <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate">{s.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Document Body */}
        <article className="lg:col-span-3 space-y-6">
          <div className="space-y-2 border-b border-border/60 pb-6">
            <div className="flex items-center gap-2">
              <DocumentStatusBadge status={doc.status} />
              <span className="text-xs text-muted-foreground">
                Updated {formatRelativeTime(doc.updated_at)}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {doc.title}
            </h1>
            {doc.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{doc.description}</p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
              <span>{doc.word_count.toLocaleString()} words</span>
              <span>•</span>
              <span>{doc.section_count} sections</span>
              <span>•</span>
              <span>{Math.max(1, Math.ceil(doc.word_count / 200))} min read</span>
            </div>
          </div>

          {/* Sections List */}
          <div className="space-y-6 divide-y divide-border/40">
            {doc.sections.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">This document is currently empty.</p>
            ) : (
              doc.sections.map((section) => <SectionView key={section.id} section={section} />)
            )}
          </div>
        </article>
      </main>

      {/* Simple Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        Powered by <strong className="text-foreground">DocumentOS</strong> — AI Document Operating System
      </footer>
    </div>
  );
}
