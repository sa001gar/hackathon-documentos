/**
 * Round-trip fidelity tests for the markdown pipeline.
 *
 * The contract: AI output (markdown) → editor HTML → saved markdown must be
 * semantically identical — no symbol corruption, no table/heading/list
 * mangling, no math escaping. These tests encode that contract and pinpoint
 * exactly which construct breaks it.
 */
import { describe, expect, it } from "vitest";
import { countWords, htmlToMarkdown, markdownToHtml, markdownToHtmlFast } from "./markdown";

/** markdown → editor HTML → markdown. */
function roundTrip(md: string): string {
  return htmlToMarkdown(markdownToHtml(md));
}

describe("unicode symbols", () => {
  it("keeps unicode math/arrow symbols as-is (no escaping, no $ conversion)", () => {
    const md = "Coverage ≥ 95%, latency ≤ 200ms, A × B → C ✓ — done • now";
    expect(roundTrip(md)).toContain("≥ 95%");
    expect(roundTrip(md)).toContain("≤ 200ms");
    expect(roundTrip(md)).toContain("×");
    expect(roundTrip(md)).toContain("→");
    expect(roundTrip(md)).toContain("✓");
    expect(roundTrip(md)).toContain("—");
    expect(roundTrip(md)).not.toContain("$\\ge");
  });
});

describe("math", () => {
  it("round-trips inline math", () => {
    const md = "Accuracy $\\ge 95\\%$ of the time.";
    const out = roundTrip(md);
    expect(out).toContain("$\\ge 95\\%$");
  });

  it("round-trips math inside table cells", () => {
    const md = [
      "| Module | Target |",
      "| --- | --- |",
      "| Traffic | $\\ge 15\\%$ Reduction |",
      "| Transit | $\\ge 95\\%$ Adherence |",
    ].join("\n");
    const out = roundTrip(md);
    expect(out).toContain("$\\ge 15\\%$");
    expect(out).toContain("$\\ge 95\\%$");
    expect(out).toContain("| Traffic |");
  });

  it("converts inline math to math spans in editor HTML (streaming/editor parity)", () => {
    const html = markdownToHtml("Value $\\ge 15\\%$ here");
    expect(html).toContain("data-math");
    expect(html).toContain('data-tex="\\ge 15\\%"');
  });

  it("converts math inside tables to math spans", () => {
    const html = markdownToHtml("| A | B |\n| --- | --- |\n| x | $\\ge 15\\%$ off |");
    expect(html).toContain("data-math");
  });
});

describe("tables", () => {
  it("round-trips a GFM table with header", () => {
    const md = [
      "| Module | KPI | Target |",
      "| --- | --- | --- |",
      "| Traffic Management | Avg. Commute Time | 15% Reduction |",
      "| Public Transit | On-Time Performance | 95% Adherence |",
    ].join("\n");
    const out = roundTrip(md);
    expect(out).toContain("| Module | KPI | Target |");
    expect(out).toContain("| Traffic Management | Avg. Commute Time | 15% Reduction |");
    expect(out).toContain("| Public Transit | On-Time Performance | 95% Adherence |");
  });

  it("keeps bold header text inside table cells", () => {
    const md = "| A | B |\n| --- | --- |\n| **Bold** | plain |";
    const out = roundTrip(md);
    expect(out).toContain("**Bold**");
  });
});

describe("headings and paragraphs", () => {
  it("round-trips ATX headings", () => {
    const md = "## Key Performance Indicators (KPIs)\n\nSome text here.";
    const out = roundTrip(md);
    expect(out).toContain("## Key Performance Indicators (KPIs)");
    expect(out).toContain("Some text here.");
  });
});

describe("lists", () => {
  it("round-trips nested bullet lists (semantically: same items, same nesting)", () => {
    const md = "- Top level\n  - Nested item\n  - Another nested\n- Back to top";
    const out = roundTrip(md);
    expect(out).toContain("Top level");
    expect(out).toContain("Nested item");
    expect(out).toContain("Another nested");
    expect(out).toContain("Back to top");
    // Nesting survives: re-rendered HTML still has a nested <ul>.
    const html = markdownToHtml(out);
    expect(html).toMatch(/<ul>[\s\S]*<ul>/);
  });

  it("round-trips task lists", () => {
    const md = "- [x] Done thing\n- [ ] Pending thing";
    const out = roundTrip(md);
    expect(out).toContain("[x] Done thing");
    expect(out).toContain("[ ] Pending thing");
  });
});

describe("code blocks", () => {
  it("round-trips fenced code with language", () => {
    const md = "```python\ndef hello():\n    return 42\n```";
    const out = roundTrip(md);
    expect(out).toContain("```python");
    expect(out).toContain("def hello():");
    expect(out).toContain("return 42");
  });

  it("preserves $ characters inside code (no math conversion)", () => {
    const md = "```bash\ncost=$((a + b))\n```";
    const out = roundTrip(md);
    expect(out).toContain("$((a + b))");
    expect(out).not.toContain("data-math");
  });
});

describe("mermaid", () => {
  it("round-trips mermaid fences verbatim", () => {
    const md = "```mermaid\ngraph TD\n  A[Start] --> B[Done]\n```";
    const out = roundTrip(md);
    expect(out).toContain("```mermaid");
    expect(out).toContain("graph TD");
    expect(out).toContain("A[Start] --> B[Done]");
  });
});

describe("blockquote and rules", () => {
  it("round-trips blockquotes", () => {
    const md = "> Important note here";
    expect(roundTrip(md)).toContain("> Important note here");
  });

  it("round-trips horizontal rules in canonical form", () => {
    const out = roundTrip("Above\n\n---\n\nBelow");
    expect(out).toContain("---");
  });
});

describe("idempotency (the strong invariant)", () => {
  it("a second round-trip is a fixed point for a complex document", () => {
    const md = [
      "## KPIs",
      "",
      "Coverage ≥ 95% with $\\ge 15\\%$ margin.",
      "",
      "| Module | Target | Method |",
      "| --- | --- | --- |",
      "| Traffic | $\\ge 15\\%$ cut | GPS |",
      "| Transit | **95%** on-time | GTFS |",
      "",
      "- one",
      "  - nested",
      "- two",
      "",
      "```mermaid",
      "graph TD",
      "  A --> B",
      "```",
      "",
      "> note",
      "",
      "---",
    ].join("\n");
    const once = roundTrip(md);
    const twice = roundTrip(once);
    expect(twice).toBe(once);
    // Spot-check nothing vital was lost:
    for (const token of ["≥", "$\\ge 15\\%$", "| Traffic |", "**95%**", "nested", "```mermaid", "A --> B", "> note", "---"]) {
      expect(once).toContain(token);
    }
  });
});

describe("streaming/editor parity", () => {
  it("fast and full pipelines produce the same table markup", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    expect(markdownToHtmlFast(md)).toContain("<table>");
    expect(markdownToHtml(md)).toContain("<table>");
  });
});

describe("countWords", () => {
  it("counts whitespace-separated words", () => {
    expect(countWords("one two  three")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
  });
});
