"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// ── Types ──────────────────────────────────────────────────────

type SourceChunk = {
  title: string;
  content: string;
  similarity: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  timestamp: number;
  feedback?: "up" | "down" | null;
};

// ── Simple Markdown Renderer ──────────────────────────────────

function renderMarkdown(text: string): string {
  let html = text
    // Code blocks (```lang\n...\n```)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="ai-code-block"><code class="language-${lang || ''}">${escapeHtml(code.trim())}</code></pre>`)
    // Inline code (`...`)
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    // Bold (**...**)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic (*...*)
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headings (### ... )
    .replace(/^### (.+)$/gm, '<h4 class="ai-heading">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>')
    // Bullet lists
    .replace(/^[-•] (.+)$/gm, '<li class="ai-list-item">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li class="ai-list-item ai-list-numbered">$1</li>');

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li class="ai-list-item[^>]*">[\s\S]*?<\/li>\n?)+/g, (match) =>
    `<ul class="ai-list">${match}</ul>`);

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p class="ai-paragraph">');
  html = `<p class="ai-paragraph">${html}</p>`;
  // Clean up empty paragraphs
  html = html.replace(/<p class="ai-paragraph"><\/p>/g, '');

  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Typing Indicator ─────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-emerald-400"
            style={{
              animation: 'typing-bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-slate-400 ml-2">Thinking...</span>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function StudyAssistant() {
  const t = useTranslations("ai");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("alphaseeker-ai-chat");
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Persist conversation to sessionStorage
  useEffect(() => {
    if (messages.length > 0) {
      try {
        sessionStorage.setItem("alphaseeker-ai-chat", JSON.stringify(messages));
      } catch {
        // Ignore storage errors
      }
    }
  }, [messages]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSubmit = useCallback(async (queryText?: string) => {
    const query = queryText ?? input.trim();
    if (!query || isStreaming) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: query,
      timestamp: Date.now(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      sources: [],
      timestamp: Date.now(),
      feedback: null,
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
    setIsStreaming(true);

    try {
      const response = await fetch("/api/ai/study", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;

          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "token" && parsed.token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.token }
                    : m
                )
              );
            } else if (parsed.type === "sources" && parsed.sources) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: parsed.sources } : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content:
                  "I'm sorry, I couldn't process your question right now. Please try again or check your connection.",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming]);

  const handleFeedback = useCallback(
    async (messageId: string, rating: "up" | "down") => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, feedback: rating } : m
        )
      );

      // Fire-and-forget feedback to API
      try {
        await fetch("/api/ai/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId, rating }),
        });
      } catch {
        // Non-critical
      }
    },
    []
  );

  const handleNewConversation = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem("alphaseeker-ai-chat");
    inputRef.current?.focus();
  }, []);

  const toggleSources = useCallback((messageId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-12rem)] bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-teal-50/80">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{t("title")}</h2>
            <p className="text-xs text-slate-500">{t("poweredBy")}</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("newConversation")}
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t("emptyTitle")}</h3>
            <p className="text-sm text-slate-500 max-w-sm mb-8">{t("emptySubtitle")}</p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {[t("suggestion1"), t("suggestion2"), t("suggestion3")].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSubmit(suggestion)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-600 font-medium hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
                >
                  <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m5.25 4.5 7.5 7.5-7.5 7.5m6-15 7.5 7.5-7.5 7.5" />
                  </svg>
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[75%] ${
                    message.role === "user"
                      ? "bg-emerald-600 text-white rounded-2xl rounded-br-md px-5 py-3.5 shadow-sm"
                      : "bg-slate-50 text-slate-800 rounded-2xl rounded-bl-md px-5 py-4 border border-slate-100"
                  }`}
                >
                  {message.role === "assistant" && message.content ? (
                    <>
                      {/* Rendered markdown content */}
                      <div
                        className="ai-response prose prose-sm prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-200/60">
                          <button
                            onClick={() => toggleSources(message.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-emerald-600 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                            </svg>
                            {t("sources")} ({message.sources.length})
                            <svg
                              className={`w-3 h-3 transition-transform ${expandedSources.has(message.id) ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                            </svg>
                          </button>
                          {expandedSources.has(message.id) && (
                            <div className="mt-2 space-y-2">
                              {message.sources.map((source, i) => (
                                <div
                                  key={i}
                                  className="rounded-lg bg-white border border-slate-200 p-3 text-xs"
                                >
                                  <p className="font-semibold text-slate-700 mb-1">{source.title}</p>
                                  <p className="text-slate-500 line-clamp-3">{source.content}</p>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                      {Math.round(source.similarity * 100)}% match
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feedback buttons */}
                      {!isStreaming && message.content && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2">
                          {message.feedback ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                              </svg>
                              {t("feedbackThanks")}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleFeedback(message.id, "up")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                                title={t("helpful")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                                </svg>
                                {t("helpful")}
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, "down")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title={t("notHelpful")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 0 1 2.25 12c0-2.848.992-5.464 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 0H4.372" />
                                </svg>
                                {t("notHelpful")}
                              </button>
                              <span className="mx-1 w-px h-4 bg-slate-200" />
                              <button
                                onClick={() => handleSubmit(t("explainSimpler"))}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                              >
                                {t("explainSimpler")}
                              </button>
                              <button
                                onClick={() => handleSubmit(t("giveExample"))}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                              >
                                {t("giveExample")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : message.role === "assistant" && !message.content ? (
                    <TypingIndicator />
                  ) : (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-slate-100 bg-white px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all min-h-[44px] max-h-[120px]"
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              rows={1}
              value={input}
            />
          </div>
          <button
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:shadow-md active:scale-95"
            disabled={!input.trim() || isStreaming}
            onClick={() => handleSubmit()}
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-slate-400 text-center">{t("disclaimer")}</p>
      </div>

      {/* AI Response Styles */}
      <style>{`
        .ai-response .ai-heading {
          font-size: 0.875rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0.75rem 0 0.375rem 0;
        }
        .ai-response .ai-paragraph {
          margin: 0.375rem 0;
          line-height: 1.7;
        }
        .ai-response .ai-list {
          margin: 0.5rem 0;
          padding-left: 1.25rem;
          list-style: disc;
        }
        .ai-response .ai-list-item {
          margin: 0.25rem 0;
          line-height: 1.6;
        }
        .ai-response .ai-list-numbered {
          list-style: decimal;
        }
        .ai-response .ai-code-block {
          background: #1e293b;
          color: #e2e8f0;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          margin: 0.75rem 0;
          overflow-x: auto;
          font-size: 0.8rem;
          line-height: 1.5;
        }
        .ai-response .ai-inline-code {
          background: #f1f5f9;
          color: #0f766e;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.85em;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
