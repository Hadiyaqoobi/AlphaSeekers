/**
 * Lightweight server-side markdown renderer (no dependencies).
 *
 * Supports: headings (h2/h3/h4), paragraphs, bold, italic, inline code,
 * code blocks, unordered + ordered lists, blockquotes, links.
 *
 * Output is HTML-escaped before transformation.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
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

  // Links [text](url) — only allow http/https
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank" class="story-link">$1</a>');

  // Paragraphs (blank line separated)
  const blocks = html.split(/\n\n+/).map((block) => {
    const trimmed = block.trim();
    if (!trimmed) return "";
    // Don't wrap if it's already a block element
    if (/^<(h[234]|ul|ol|pre|blockquote)/.test(trimmed)) return trimmed;
    // Replace single newlines with <br /> within a paragraph
    return `<p class="story-paragraph">${trimmed.replace(/\n/g, "<br />")}</p>`;
  });

  return blocks.join("\n");
}
