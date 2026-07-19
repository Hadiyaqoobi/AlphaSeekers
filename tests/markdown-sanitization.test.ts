/**
 * Unit tests for the story markdown renderer/sanitizer
 * (src/lib/stories/markdown.ts).
 *
 * This is a Wave-1 stored-XSS defense: student-supplied markdown is rendered to
 * HTML server-side and displayed to other users, so the renderer must strip or
 * neutralize any script injection while preserving legitimate formatting. These
 * tests assert both halves of that contract.
 */
import { describe, it, expect } from "vitest";

import { renderMarkdown } from "@/lib/stories/markdown";

describe("renderMarkdown — XSS neutralization", () => {
  it("strips <script> tags entirely (no executable markup survives)", () => {
    const out = renderMarkdown('Hello <script>alert("pwned")</script> world');
    expect(out).not.toMatch(/<script/i);
    // The literal angle-bracketed tag must not reappear as real markup.
    expect(out).not.toContain("</script>");
    // The visible text is preserved (HTML-escaped), just inert.
    expect(out).toContain("Hello");
    expect(out).toContain("world");
  });

  it("neutralizes event-handler attributes (onerror) from injected tags", () => {
    const out = renderMarkdown('<img src=x onerror="alert(1)">');
    // The tag is HTML-escaped to inert text: no live <img> element exists, so
    // the onerror handler can never fire even though its text is preserved.
    expect(out).not.toMatch(/<img\b/i);
    expect(out).toContain("&lt;img");
  });

  it("neutralizes onclick handlers injected via raw HTML", () => {
    const out = renderMarkdown('<a href="http://x.com" onclick="steal()">click</a>');
    // No live anchor element is produced from the raw tag; it is escaped text.
    expect(out).not.toMatch(/<a\b[^>]*onclick/i);
    expect(out).toContain("&lt;a");
  });

  it("does not emit an anchor for a javascript: link URL", () => {
    const out = renderMarkdown("[click me](javascript:alert(1))");
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/<a\b/i);
    // Degrades to the plain link text instead.
    expect(out).toContain("click me");
  });

  it("does not emit an anchor for a data: URL link", () => {
    const out = renderMarkdown("[x](data:text/html,<script>alert(1)</script>)");
    expect(out).not.toMatch(/href="data:/i);
    expect(out).not.toMatch(/<a\b/i);
  });

  it("rejects a vbscript: link URL", () => {
    const out = renderMarkdown("[x](vbscript:msgbox(1))");
    expect(out).not.toMatch(/vbscript:/i);
    expect(out).not.toMatch(/<a\b/i);
  });

  it("does not treat a raw <a javascript:> tag as a live link", () => {
    const out = renderMarkdown('<a href="javascript:alert(1)">x</a>');
    // The raw tag is escaped, so no live anchor (and thus no navigable
    // javascript: href) is produced — the payload is inert text.
    expect(out).not.toMatch(/<a\b/i);
    expect(out).toContain("&lt;a");
  });
});

describe("renderMarkdown — legitimate markdown is preserved", () => {
  it("renders ## headings as <h2>", () => {
    const out = renderMarkdown("## My Story");
    expect(out).toMatch(/<h2[^>]*>My Story<\/h2>/);
  });

  it("renders ### headings as <h3>", () => {
    const out = renderMarkdown("### Sub Section");
    expect(out).toMatch(/<h3[^>]*>Sub Section<\/h3>/);
  });

  it("renders **bold** as <strong>", () => {
    const out = renderMarkdown("This is **important** text");
    expect(out).toMatch(/<strong>important<\/strong>/);
  });

  it("renders *italic* as <em>", () => {
    const out = renderMarkdown("This is *slanted* text");
    expect(out).toMatch(/<em>slanted<\/em>/);
  });

  it("renders an http link as a safe anchor", () => {
    const out = renderMarkdown("See [our site](http://example.com)");
    expect(out).toMatch(/<a\b[^>]*href="http:\/\/example\.com"/);
    expect(out).toContain("our site");
    expect(out).toMatch(/rel="noopener noreferrer nofollow"/);
    expect(out).toMatch(/target="_blank"/);
  });

  it("renders an https link as a safe anchor", () => {
    const out = renderMarkdown("[secure](https://example.com/path)");
    expect(out).toMatch(/<a\b[^>]*href="https:\/\/example\.com\/path"/);
  });

  it("renders unordered lists as <ul>/<li>", () => {
    const out = renderMarkdown("- one\n- two\n- three");
    expect(out).toMatch(/<ul[^>]*>/);
    expect(out).toMatch(/<li[^>]*>one<\/li>/);
    expect(out).toMatch(/<li[^>]*>two<\/li>/);
  });

  it("renders ordered lists as <ol>/<li>", () => {
    const out = renderMarkdown("1. first\n2. second");
    expect(out).toMatch(/<ol[^>]*>/);
    expect(out).toMatch(/<li[^>]*>first<\/li>/);
  });

  it("preserves plain text in a paragraph and never executes injected markup alongside real content", () => {
    const out = renderMarkdown(
      "## Real Heading\n\nSafe **bold** and a [link](https://ok.com) plus <script>bad()</script>",
    );
    // Legit content survives.
    expect(out).toMatch(/<h2[^>]*>Real Heading<\/h2>/);
    expect(out).toMatch(/<strong>bold<\/strong>/);
    expect(out).toMatch(/<a\b[^>]*href="https:\/\/ok\.com"/);
    // Injection does not.
    expect(out).not.toMatch(/<script/i);
  });
});
