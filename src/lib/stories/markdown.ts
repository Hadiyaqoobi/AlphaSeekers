/**
 * Lightweight server-side markdown renderer.
 *
 * Supports: headings (h2/h3/h4), paragraphs, bold, italic, inline code,
 * code blocks, unordered + ordered lists, blockquotes, links.
 *
 * Output is HTML-escaped before transformation, then passed through
 * sanitize-html with a strict allowlist as a defense-in-depth step so
 * that student-supplied content can never inject script, event handlers,
 * or dangerous URLs (stored XSS).
 */

import sanitizeHtml from "sanitize-html";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * True if the string contains any ASCII control character (code point < 0x20)
 * or DEL (0x7f). Such characters can smuggle URL schemes (e.g. "java\tscript:")
 * or break out of an HTML attribute, so URLs containing them are rejected.
 */
function hasControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Validate + normalize a markdown link URL.
 *
 * Only http/https/mailto are permitted. Anything else (javascript:, data:,
 * vbscript:, relative/ambiguous, or unparseable) returns null so the link
 * is rendered as inert text instead of an anchor.
 */
function safeLinkHref(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url || /\s/.test(url) || hasControlChar(url)) return null;

  let scheme: string;
  try {
    const parsed = new URL(url);
    scheme = parsed.protocol.toLowerCase();
  } catch {
    return null;
  }

  if (scheme !== "http:" && scheme !== "https:" && scheme !== "mailto:") {
    return null;
  }
  return url;
}

/**
 * Percent/entity-encode a value so it is safe to place inside a double-quoted
 * HTML attribute. `encodeURI` keeps the URL functional while neutralizing the
 * characters ("<>) that could break out of the attribute or start a tag.
 */
function encodeAttr(value: string): string {
  return encodeURI(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderMarkdown(text: string): string {
  // First escape HTML so user content can't inject tags
  let html = escapeHtml(text);

  // Code blocks (```lang\n...\n```)
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) => {
    const langClass = lang ? ` class="language-${String(lang).replace(/[^a-z0-9]/gi, "")}"` : "";
    return `<pre class="story-code"><code${langClass}>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="story-inline-code">$1</code>');

  // Bold / italic
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

  // Headings
  html = html.replace(/^#### (.+)$/gm, '<h4 class="story-heading">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 class="story-heading">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="story-heading">$1</h2>');

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="story-quote">$1</blockquote>');

  // Ordered list items
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="story-list-item story-list-numbered">$1</li>');

  // Unordered list items
  html = html.replace(/^[-•*] (.+)$/gm, '<li class="story-list-item">$1</li>');

  // Wrap consecutive list items in <ul> or <ol>
  html = html.replace(/(<li class="story-list-item story-list-numbered">[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ol class="story-list story-ordered">${match}</ol>`;
  });
  html = html.replace(/(<li class="story-list-item">[\s\S]*?<\/li>\n?)+/g, (match) => {
    return `<ul class="story-list">${match}</ul>`;
  });

  // Links [text](url) — validate + encode the URL so it cannot break out of
  // the href attribute or carry a dangerous scheme. Invalid URLs degrade to
  // the plain (already-escaped) link text.
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, rawUrl) => {
    // The URL was HTML-escaped upstream; decode the handful of entities we
    // produce so the real URL can be validated, then re-encode for output.
    const decodedUrl = String(rawUrl)
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    const safe = safeLinkHref(decodedUrl);
    if (!safe) return String(text);
    return `<a href="${encodeAttr(safe)}" rel="noopener noreferrer nofollow" target="_blank" class="story-link">${text}</a>`;
  });

  // Paragraphs (blank line separated)
  const blocks = html.split(/\n\n+/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    // Don't wrap if it's already a block element
    if (/^<(h[234]|ul|ol|pre|blockquote)/.test(trimmed)) return trimmed;
    // Replace single newlines with <br /> within a paragraph
    return `<p class="story-paragraph">${trimmed.replace(/\n/g, "<br />")}</p>`;
  });

  const rendered = blocks.join("\n");

  // Defense-in-depth: re-parse and strip anything outside the strict allowlist.
  // Even if a transformation above were bypassed, no <script>, event handler,
  // or non-http(s)/mailto URL can survive this pass.
  return sanitizeHtml(rendered, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "strong",
      "em",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "a",
    ],
    allowedAttributes: {
      a: ["href", "rel", "target", "class"],
      code: ["class"],
      pre: ["class"],
      h2: ["class"],
      h3: ["class"],
      h4: ["class"],
      p: ["class"],
      ul: ["class"],
      ol: ["class"],
      li: ["class"],
      blockquote: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { a: ["http", "https", "mailto"] },
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: false,
    transformTags: {
      // Guarantee safe rel/target on every surviving anchor.
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
  });
}
