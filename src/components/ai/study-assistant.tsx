"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

// ── Types ──────────────────────────────────────────────────────

type SourceChunk = {
  title: string;
  content: string;
  similarity: number;
};

type AiMode = "study" | "practice" | "quiz" | "explain" | "vocabulary" | "prepare";

type ConfidenceInfo = {
  level: "high" | "medium" | "low";
  label: string;
  labelDari: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  timestamp: number;
  feedback?: "up" | "down" | null;
  mode?: AiMode;
  confidence?: ConfidenceInfo;
};

type EnrolledClass = {
  id: string;
  name: string;
  category: string;
  isLanguageClass: boolean;
};

type StudentAiContext = {
  enrolledClasses: EnrolledClass[];
  nextClass: { name: string; startTime: string } | null;
};

// ── Mode Labels & Icons ─────────────────────────────────────────

const MODE_CONFIG: Record<AiMode, { icon: string; labelKey: string; color: string }> = {
  study: { icon: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25", labelKey: "modeStudy", color: "emerald" },
  practice: { icon: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155", labelKey: "modePractice", color: "blue" },
  quiz: { icon: "M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z", labelKey: "modeQuiz", color: "amber" },
  explain: { icon: "M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z", labelKey: "modeExplain", color: "violet" },
  vocabulary: { icon: "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25", labelKey: "modeVocab", color: "rose" },
  prepare: { icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 9v9.75", labelKey: "modePrepare", color: "sky" },
};

const MODE_COLORS: Record<string, string> = {
  emerald: "text-neon-600 bg-neon-50",
  blue: "text-blue-600 bg-blue-50",
  amber: "text-amber-600 bg-amber-50",
  violet: "text-violet-600 bg-violet-50",
  rose: "text-rose-600 bg-rose-50",
  sky: "text-sky-600 bg-sky-50",
};

// ── Simple Markdown Renderer ──────────────────────────────────

function renderMarkdown(text: string): string {
  // SECURITY (XSS): escape ALL HTML in the model output FIRST. The model reply
  // can contain attacker-controlled text (prompt injection), so nothing it
  // emits may reach dangerouslySetInnerHTML as live markup. After escaping, the
  // only tags in the string are the fixed, safe ones we add below. The code
  // capture is already escaped by this first step, so it must NOT be escaped
  // again (that would double-encode it).
  let html = escapeHtml(text)
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_m, lang, code) =>
      `<pre class="ai-code-block"><code class="language-${(lang || '').replace(/[^a-zA-Z0-9]/g, '')}">${code.trim()}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<h4 class="ai-heading">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="ai-heading">$1</h3>')
    .replace(/^[-•] (.+)$/gm, '<li class="ai-list-item">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ai-list-item ai-list-numbered">$1</li>');

  html = html.replace(/(<li class="ai-list-item[^>]*">[\s\S]*?<\/li>\n?)+/g, (match) =>
    `<ul class="ai-list">${match}</ul>`);

  html = html.replace(/\n\n/g, '</p><p class="ai-paragraph">');
  html = `<p class="ai-paragraph">${html}</p>`;
  html = html.replace(/<p class="ai-paragraph"><\/p>/g, '');

  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Typing Indicator ─────────────────────────────────────────

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-neon-400"
            style={{
              animation: 'typing-bounce 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.16}s`,
            }}
          />
        ))}
      </div>
      <span className="text-xs text-ink-faint ml-2">{label}</span>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ── Mode Badge ──────────────────────────────────────────────

function ModeBadge({ mode }: { mode: AiMode }) {
  const t = useTranslations("ai");
  const config = MODE_CONFIG[mode];
  const colorClasses = MODE_COLORS[config.color];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colorClasses} mb-1.5`}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d={config.icon} />
      </svg>
      {t(config.labelKey)}
    </span>
  );
}

// ── Personalized Suggestions ─────────────────────────────────

function generateSuggestions(
  ctx: StudentAiContext | null,
  t: ReturnType<typeof useTranslations>,
): string[] {
  if (!ctx || ctx.enrolledClasses.length === 0) {
    return [t("suggestion1"), t("suggestion2"), t("suggestion3")];
  }

  const suggestions: string[] = [];
  const langClass = ctx.enrolledClasses.find((c) => c.isLanguageClass);
  const nonLangClass = ctx.enrolledClasses.find((c) => !c.isLanguageClass);

  if (langClass) {
    const langName = langClass.name.split(" ")[0]; // e.g. "English"
    suggestions.push(`Practice ${langName} with me`);
    suggestions.push(`Teach me 5 new ${langName} words`);
  }

  if (nonLangClass) {
    suggestions.push(`Quiz me on ${nonLangClass.name}`);
  }

  if (ctx.nextClass) {
    suggestions.push(`Prepare me for ${ctx.nextClass.name}`);
  }

  // Fill remaining with defaults
  const defaults = [t("suggestion1"), t("suggestion2"), t("suggestion3")];
  while (suggestions.length < 4 && defaults.length > 0) {
    const d = defaults.shift()!;
    if (!suggestions.includes(d)) suggestions.push(d);
  }

  return suggestions.slice(0, 4);
}

// ── Main Component ───────────────────────────────────────────

export function StudyAssistant() {
  const t = useTranslations("ai");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [studentContext, setStudentContext] = useState<StudentAiContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch student context for personalized suggestions
  useEffect(() => {
    fetch("/api/student/ai-context")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setStudentContext(data); })
      .catch(() => {});
  }, []);

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

  // Focus the textarea on mount and whenever streaming completes so
  // students can keep typing without re-clicking the input
  // (UAT 2026-04-26 HIGH-D — Shahla reported "could not type properly").
  useEffect(() => {
    if (!isStreaming) {
      inputRef.current?.focus();
    }
  }, [isStreaming]);

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
      const response = await fetch("/api/ai/ask", {
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
            if (parsed.type === "text" && parsed.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.content }
                    : m
                )
              );
            } else if (parsed.type === "sources" && parsed.sources) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, sources: parsed.sources } : m
                )
              );
            } else if (parsed.type === "mode" && parsed.mode) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, mode: parsed.mode } : m
                )
              );
            } else if (parsed.type === "confidence" && parsed.level) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, confidence: { level: parsed.level, label: parsed.label, labelDari: parsed.labelDari } }
                    : m
                )
              );
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      const errorContent = (error instanceof Error && error.message.includes("429"))
        ? "You're asking great questions! Give me a moment to catch up — try again in a few seconds."
        : "I wasn't able to find an answer right now. This usually means the connection is slow.";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `__ERROR__${errorContent}__QUERY__${query}` }
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

  const suggestions = generateSuggestions(studentContext, t);

  return (
    <div
      className="flex flex-col h-full max-h-[calc(100vh-12rem)] rounded-2xl overflow-hidden"
      style={{ background: "#0E1921", border: "1px solid #1A2D3D" }}
    >
      {/* Header — flat dark, no gradient */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ background: "#0E1921", borderBottom: "1px solid #1A2D3D" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "rgba(0, 230, 118, 0.10)", color: "#00E676" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
            </svg>
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#E8EEF2" }}>{t("title")}</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#00E676", boxShadow: "0 0 6px rgba(0,230,118,0.6)" }} />
              <span className="text-xs" style={{ color: "#00E676" }}>Online</span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleNewConversation}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors"
            style={{ color: "#8899A6" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#E8EEF2"; e.currentTarget.style.background = "#142230"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#8899A6"; e.currentTarget.style.background = ""; }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            {t("newConversation")}
          </button>
        )}
      </div>

      {/* Messages — page-dark background */}
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6" style={{ background: "#080D12" }}>
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: "rgba(0, 230, 118, 0.10)" }}
            >
              <svg className="w-7 h-7" style={{ color: "#00E676" }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: "#E8EEF2" }}>{t("emptyTitle")}</h3>
            <p className="text-sm max-w-sm mb-8" style={{ color: "#8899A6" }}>{t("emptySubtitle")}</p>

            {/* Personalized suggestion chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSubmit(suggestion)}
                  className="text-left px-4 py-3.5 rounded-xl text-sm transition-colors"
                  style={{ background: "#0E1921", border: "1px solid #1A2D3D", color: "#8899A6" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(0,230,118,0.30)"; e.currentTarget.style.color = "#E8EEF2"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1A2D3D"; e.currentTarget.style.color = "#8899A6"; }}
                >
                  <span style={{ color: "#00E676" }} className="mr-2">›</span>
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
                      ? "rounded-2xl rounded-br-md px-5 py-3.5"
                      : "rounded-2xl rounded-bl-md px-5 py-4"
                  }`}
                  style={
                    message.role === "user"
                      ? { background: "#00E676", color: "#080D12", boxShadow: "0 0 12px rgba(0,230,118,0.20)" }
                      : { background: "#0E1921", color: "#E8EEF2", border: "1px solid #1A2D3D" }
                  }
                >
                  {message.role === "assistant" && message.content?.startsWith("__ERROR__") ? (
                    (() => {
                      const errorText = message.content.split("__QUERY__")[0].replace("__ERROR__", "");
                      const originalQuery = message.content.split("__QUERY__")[1] || "";
                      return (
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl rounded-bl-md px-5 py-4">
                          <p className="text-sm text-amber-800">{errorText}</p>
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => handleSubmit(originalQuery)} className="text-xs font-medium text-amber-700 hover:text-amber-900 bg-amber-100 px-3 py-1.5 rounded-lg transition-colors">Try again</button>
                            <button onClick={() => inputRef.current?.focus()} className="text-xs font-medium text-amber-600 hover:text-amber-800 px-3 py-1.5 rounded-lg transition-colors">Ask differently</button>
                          </div>
                        </div>
                      );
                    })()
                  ) : message.role === "assistant" && message.content ? (
                    <>
                      {/* Mode badge */}
                      {/* Mode + confidence badges */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {message.mode && <ModeBadge mode={message.mode} />}
                        {message.confidence && message.confidence.level !== "high" && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold mb-1.5 ${
                            message.confidence.level === "low"
                              ? "text-amber-700 bg-amber-50"
                              : "text-ink-soft bg-dark-100"
                          }`}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                            </svg>
                            {message.confidence.label}
                          </span>
                        )}
                      </div>

                      {/* Rendered markdown content */}
                      <div
                        className="ai-response prose prose-sm prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                      />

                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-line-DEFAULT/60">
                          <button
                            onClick={() => toggleSources(message.id)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-ink-faint hover:text-neon-600 transition-colors"
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
                                  className="rounded-lg bg-dark-100 border border-line-DEFAULT p-3 text-xs"
                                >
                                  <p className="font-semibold text-ink-main mb-1">{source.title}</p>
                                  <p className="text-ink-soft line-clamp-3">{source.content}</p>
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-neon-50 text-neon-700 text-[10px] font-bold">
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
                        <div className="mt-3 pt-3 border-t border-line-DEFAULT/60 flex items-center gap-2">
                          {message.feedback ? (
                            <span className="text-xs text-neon-600 font-medium flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
                              </svg>
                              {t("feedbackThanks")}
                            </span>
                          ) : (
                            <>
                              <button
                                onClick={() => handleFeedback(message.id, "up")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-ink-faint hover:text-neon-600 hover:bg-neon-50 transition-colors"
                                title={t("helpful")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 0 1 2.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 0 0 .322-1.672V2.75a.75.75 0 0 1 .75-.75 2.25 2.25 0 0 1 2.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 0 1-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 0 0-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 0 1-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 0 0-1.302 4.665c0 1.194.232 2.333.654 3.375Z" />
                                </svg>
                                {t("helpful")}
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, "down")}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-ink-faint hover:text-red-500 hover:bg-red-50 transition-colors"
                                title={t("notHelpful")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.498 15.25H4.372c-1.026 0-1.945-.694-2.054-1.715A12.137 12.137 0 0 1 2.25 12c0-2.848.992-5.464 2.649-7.521C5.287 3.997 5.886 3.75 6.504 3.75h4.016a4.5 4.5 0 0 1 1.423.23l3.114 1.04a4.5 4.5 0 0 0 1.423.23h1.294M7.498 15.25c.618 0 .991.724.725 1.282A7.471 7.471 0 0 0 7.5 19.75 2.25 2.25 0 0 0 9.75 22a.75.75 0 0 0 .75-.75v-.633c0-.573.11-1.14.322-1.672.304-.76.93-1.33 1.653-1.715a9.04 9.04 0 0 0 2.86-2.4c.498-.634 1.226-1.08 2.032-1.08h.384m-10.253 0H4.372" />
                                </svg>
                                {t("notHelpful")}
                              </button>
                              <span className="mx-1 w-px h-4 bg-dark-200" />
                              <button
                                onClick={() => handleSubmit(t("explainSimpler"))}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-ink-faint hover:text-sky-600 hover:bg-sky-50 transition-colors"
                              >
                                {t("explainSimpler")}
                              </button>
                              <button
                                onClick={() => handleSubmit(t("giveExample"))}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-ink-faint hover:text-violet-600 hover:bg-violet-50 transition-colors"
                              >
                                {t("giveExample")}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  ) : message.role === "assistant" && !message.content ? (
                    <TypingIndicator label={t("thinking")} />
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
      <div
        className="px-4 py-3"
        style={{ background: "#0E1921", borderTop: "1px solid #1A2D3D" }}
      >
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              autoFocus
              dir="auto"
              className="w-full resize-none rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none transition-all min-h-[44px] max-h-[120px]"
              style={{ background: "#142230", border: "1px solid #1E3A4F", color: "#E8EEF2" }}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("placeholder")}
              rows={1}
              value={input}
            />
          </div>
          <button
            className="flex items-center justify-center w-11 h-11 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            style={{ background: "#00E676", color: "#080D12", boxShadow: "0 0 12px rgba(0,230,118,0.20)" }}
            disabled={!input.trim() || isStreaming}
            onClick={() => handleSubmit()}
            type="button"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-[10px] text-center" style={{ color: "#556677" }}>{t("disclaimer")}</p>
      </div>

      {/* AI Response Styles */}
      <style>{`
        .ai-response { color: #E8EEF2; }
        .ai-response .ai-heading {
          font-size: 0.875rem;
          font-weight: 700;
          color: #E8EEF2;
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
          background: #142230;
          color: #E8EEF2;
          padding: 0.75rem 1rem;
          border-radius: 0.5rem;
          margin: 0.75rem 0;
          overflow-x: auto;
          font-size: 0.8rem;
          line-height: 1.5;
          border: 1px solid #1A2D3D;
        }
        .ai-response .ai-inline-code {
          background: rgba(0, 230, 118, 0.10);
          color: #00E676;
          padding: 0.125rem 0.375rem;
          border-radius: 0.25rem;
          font-size: 0.85em;
          font-weight: 500;
        }
      `}</style>
    </div>
  );
}
