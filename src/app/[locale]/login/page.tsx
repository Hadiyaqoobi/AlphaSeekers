"use client";

import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

const QUOTES = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "The mind is not a vessel to be filled, but a fire to be kindled.", author: "Plutarch" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
];

// Deterministic star field (no hydration issues)
const STARS = Array.from({ length: 32 }, (_, i) => ({
  id: i,
  top: ((i * 41) % 100),
  left: ((i * 67 + 13) % 100),
  size: 0.8 + (i % 4) * 0.4,
  delay: (i % 8) * 0.5,
  duration: 2 + (i % 6) * 0.7,
}));

export default function LoginPage() {
  const t = useTranslations("login");
  const router = useRouter();
  const params = useParams<{ locale: string }>();
  const searchParams = useSearchParams();
  const locale = params.locale || "fa";
  const nextParam = searchParams.get("next");
  const safeNext =
    nextParam && (nextParam === `/${locale}` || nextParam.startsWith(`/${locale}/`))
      ? nextParam
      : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => {
    const err = searchParams.get("error");
    return err === "PENDING_APPROVAL" ? t("pending") : null;
  });
  const [mounted, setMounted] = useState(false);
  const [quoteIndex, setQuoteIndex] = useState(0);

  // Mouse-following glow position
  const cardWrapperRef = useRef<HTMLDivElement>(null);
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteIndex((i) => (i + 1) % QUOTES.length);
    }, 6500);
    return () => clearInterval(interval);
  }, []);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setGlowPos({ x, y });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    setSubmitting(false);

    if (!result || !result.ok) {
      const pending = result?.error === "PENDING_APPROVAL" || result?.url?.includes("PENDING_APPROVAL");
      setErrorMessage(pending ? t("pending") : t("error"));
      setShakeError(true);
      setTimeout(() => setShakeError(false), 600);
      return;
    }

    router.push(safeNext ?? `/${locale}/dashboard`);
    router.refresh();
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-12 lg:px-12"
      style={{ background: "#080D12" }}
    >
      {/* ═══════════════ ANIMATED BACKGROUND ═══════════════ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Drifting mesh orbs */}
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 620, height: 620, top: "-15%", left: "-8%",
            background: "radial-gradient(circle, rgba(0,230,118,0.25) 0%, transparent 65%)",
            animation: "orb-1 22s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 540, height: 540, bottom: "-15%", right: "-10%",
            background: "radial-gradient(circle, rgba(0,229,255,0.18) 0%, transparent 65%)",
            animation: "orb-2 28s ease-in-out infinite",
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 700, height: 700, top: "30%", right: "20%",
            background: "radial-gradient(circle, rgba(41,121,255,0.12) 0%, transparent 65%)",
            animation: "orb-3 34s ease-in-out infinite",
          }}
        />

        {/* Animated SVG wave at top */}
        <svg
          className="absolute top-0 left-0 w-full h-[280px] opacity-50"
          viewBox="0 0 1440 280"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="wave1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(0,230,118,0)" />
              <stop offset="50%" stopColor="rgba(0,230,118,0.55)" />
              <stop offset="100%" stopColor="rgba(0,229,255,0)" />
            </linearGradient>
            <linearGradient id="wave2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(0,229,255,0)" />
              <stop offset="50%" stopColor="rgba(0,229,255,0.45)" />
              <stop offset="100%" stopColor="rgba(41,121,255,0)" />
            </linearGradient>
            <linearGradient id="wave3" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(41,121,255,0)" />
              <stop offset="50%" stopColor="rgba(41,121,255,0.35)" />
              <stop offset="100%" stopColor="rgba(0,230,118,0)" />
            </linearGradient>
          </defs>
          <path d="M0,140 C320,40 720,240 1080,120 S1440,180 1440,140" fill="none" stroke="url(#wave1)" strokeWidth="1.5" style={{ animation: "wave-flow-1 18s ease-in-out infinite" }} />
          <path d="M0,160 C400,80 800,260 1200,160 S1440,200 1440,160" fill="none" stroke="url(#wave2)" strokeWidth="1.2" style={{ animation: "wave-flow-2 22s ease-in-out infinite" }} />
          <path d="M0,180 C360,100 760,220 1100,180 S1440,200 1440,180" fill="none" stroke="url(#wave3)" strokeWidth="1" style={{ animation: "wave-flow-3 26s ease-in-out infinite" }} />
        </svg>

        {/* Star field */}
        {STARS.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full"
            style={{
              top: `${s.top}%`, left: `${s.left}%`,
              width: `${s.size}px`, height: `${s.size}px`,
              background: "#FFFFFF", opacity: 0.35,
              animation: `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 50%, transparent 30%, #080D12 100%)" }}
        />
      </div>

      {/* ═══════════════ MAIN CONTAINER ═══════════════ */}
      <div className="relative z-10 w-full max-w-[440px]">
        {/* Logo with breathing halo */}
        <div
          className="flex flex-col items-center mb-8"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(-12px)",
            transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s",
          }}
        >
          <div className="relative mb-5">
            {/* Pulsing rings */}
            <div
              className="absolute -inset-3 rounded-2xl"
              style={{
                background: "radial-gradient(circle, rgba(0,230,118,0.4) 0%, transparent 70%)",
                animation: "halo-pulse 3s ease-in-out infinite",
              }}
            />
            <div
              className="absolute -inset-1 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, #00E676, #00E5FF)",
                opacity: 0.6,
                filter: "blur(6px)",
              }}
            />
            <div
              className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold"
              style={{
                background: "#00E676",
                color: "#080D12",
                boxShadow: "0 0 0 1px rgba(0,230,118,0.4) inset",
              }}
            >
              A
            </div>
          </div>
          <span className="text-base font-bold tracking-tight" style={{ color: "#FFFFFF" }}>
            AlphaSeekers
          </span>
        </div>

        {/* Heading with security pill */}
        <div
          className="text-center mb-8"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(16px)",
            transition: "all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.25s",
          }}
        >
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-5"
            style={{
              background: "rgba(0,230,118,0.08)",
              border: "1px solid rgba(0,230,118,0.18)",
            }}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: "#00E676" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#00E676" }}>
              {t("secureSignIn")}
            </span>
          </div>
          <h1
            className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.05]"
            style={{ color: "#FFFFFF" }}
          >
            {t("welcomeLine1")}
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #00E676 0%, #00E5FF 60%, #2979FF 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("welcomeLine2")}
            </span>
          </h1>
          <p className="mt-4 text-sm" style={{ color: "#8899A6" }}>
            {t("tagline")}
          </p>
        </div>

        {/* ════════ Form card with mouse-following glow & nested rings ════════ */}
        <div
          ref={cardWrapperRef}
          onMouseMove={handleMouseMove}
          className="relative"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(28px)",
            transition: "all 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.4s",
          }}
        >
          {/* Outer soft glow ring */}
          <div
            className="absolute -inset-6 rounded-[28px] pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,230,118,0.18), rgba(0,229,255,0.12), rgba(41,121,255,0.10))",
              filter: "blur(28px)",
              opacity: 0.7,
            }}
          />
          {/* Mouse-following spotlight */}
          <div
            className="absolute -inset-2 rounded-[22px] pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(0,230,118,0.18) 0%, transparent 50%)`,
            }}
          />
          {/* Gradient border ring */}
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              padding: "1px",
              background: "linear-gradient(135deg, rgba(0,230,118,0.35), rgba(0,229,255,0.18) 50%, rgba(26,45,61,0.6))",
              WebkitMask:
                "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          {/* The actual card */}
          <form
            className="relative rounded-2xl px-7 py-8 backdrop-blur-2xl"
            style={{
              background:
                "linear-gradient(180deg, rgba(20,34,48,0.85) 0%, rgba(14,25,33,0.85) 100%)",
              boxShadow: "0 30px 80px rgba(0,0,0,0.5)",
            }}
            onSubmit={handleSubmit}
          >
            {/* Top edge highlight */}
            <div
              className="absolute top-0 left-8 right-8 h-px pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
              }}
            />

            <div className="space-y-5">
              {/* Email with icon */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-[0.12em] mb-2" style={{ color: "#8899A6" }}>
                  {t("email")}
                </label>
                <div className="relative">
                  {/* Icon */}
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <svg
                      className="w-4 h-4 transition-colors duration-200"
                      style={{ color: emailFocused ? "#00E676" : "#556677" }}
                      fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  {/* Glow halo */}
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300"
                    style={{
                      background: "linear-gradient(135deg, rgba(0,230,118,0.5), rgba(0,229,255,0.35))",
                      opacity: emailFocused ? 1 : 0,
                      filter: "blur(12px)",
                      transform: "scale(1.03)",
                    }}
                  />
                  <input
                    autoComplete="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    placeholder={t("emailPlaceholder")}
                    className="relative w-full pl-11 pr-4 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: "#0F1A24",
                      border: `1px solid ${emailFocused ? "#00E676" : "#1E3A4F"}`,
                      color: "#E8EEF2",
                      boxShadow: emailFocused ? "0 0 0 3px rgba(0,230,118,0.15)" : "none",
                    }}
                  />
                  {/* Animated underline */}
                  <div
                    className="absolute bottom-0 left-1/2 h-px pointer-events-none transition-all duration-500"
                    style={{
                      width: emailFocused ? "calc(100% - 24px)" : "0%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(90deg, transparent, #00E676, transparent)",
                      boxShadow: "0 0 8px rgba(0,230,118,0.6)",
                    }}
                  />
                </div>
              </div>

              {/* Password with icon */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: "#8899A6" }}>
                    {t("password")}
                  </label>
                  <button
                    type="button"
                    className="text-[11px] font-medium transition-colors"
                    style={{ color: "#556677" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#00E676"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#556677"; }}
                  >
                    {t("forgot")}
                  </button>
                </div>
                <div className="relative">
                  {/* Lock icon */}
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none">
                    <svg
                      className="w-4 h-4 transition-colors duration-200"
                      style={{ color: passwordFocused ? "#00E676" : "#556677" }}
                      fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  </div>
                  {/* Glow halo */}
                  <div
                    className="absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300"
                    style={{
                      background: "linear-gradient(135deg, rgba(0,230,118,0.5), rgba(0,229,255,0.35))",
                      opacity: passwordFocused ? 1 : 0,
                      filter: "blur(12px)",
                      transform: "scale(1.03)",
                    }}
                  />
                  <input
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    placeholder="••••••••"
                    className="relative w-full pl-11 pr-12 py-3.5 rounded-xl text-sm focus:outline-none transition-all"
                    style={{
                      background: "#0F1A24",
                      border: `1px solid ${passwordFocused ? "#00E676" : "#1E3A4F"}`,
                      color: "#E8EEF2",
                      boxShadow: passwordFocused ? "0 0 0 3px rgba(0,230,118,0.15)" : "none",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                    aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
                    style={{ color: "#556677" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#00E676"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#556677"; }}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    )}
                  </button>
                  {/* Animated underline */}
                  <div
                    className="absolute bottom-0 left-1/2 h-px pointer-events-none transition-all duration-500"
                    style={{
                      width: passwordFocused ? "calc(100% - 24px)" : "0%",
                      transform: "translateX(-50%)",
                      background: "linear-gradient(90deg, transparent, #00E676, transparent)",
                      boxShadow: "0 0 8px rgba(0,230,118,0.6)",
                    }}
                  />
                </div>
              </div>

              {/* Error */}
              {errorMessage && (
                <div
                  className={`flex items-start gap-2 rounded-xl p-3 text-sm ${shakeError ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
                  style={{
                    background: "rgba(239,68,68,0.10)",
                    border: "1px solid rgba(239,68,68,0.25)",
                    color: "#F87171",
                  }}
                >
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                className="group relative w-full py-3.5 rounded-xl text-sm font-bold transition-all overflow-hidden disabled:opacity-60"
                style={{
                  background: "#00E676",
                  color: "#080D12",
                  boxShadow: "0 8px 24px rgba(0,230,118,0.35), 0 0 0 1px rgba(0,230,118,0.5)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#00C853";
                  e.currentTarget.style.boxShadow =
                    "0 12px 36px rgba(0,230,118,0.5), 0 0 0 1px rgba(0,230,118,0.7)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#00E676";
                  e.currentTarget.style.boxShadow =
                    "0 8px 24px rgba(0,230,118,0.35), 0 0 0 1px rgba(0,230,118,0.5)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.4) 50%, transparent 65%)",
                    transform: "translateX(-100%)",
                    animation: submitting ? "shimmer 1.4s linear infinite" : "none",
                  }}
                />
                <span className="relative flex items-center justify-center gap-2">
                  {submitting ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>{t("signingIn")}</span>
                    </>
                  ) : (
                    <>
                      <span>{t("signIn")}</span>
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  )}
                </span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 pt-1">
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #1E3A4F, transparent)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "#556677" }}>{t("or")}</span>
                <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, transparent, #1E3A4F, transparent)" }} />
              </div>

              {/* Magic link option */}
              <button
                type="button"
                className="w-full py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
                style={{
                  background: "rgba(0,229,255,0.06)",
                  border: "1px solid rgba(0,229,255,0.2)",
                  color: "#00E5FF",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,229,255,0.10)";
                  e.currentTarget.style.borderColor = "rgba(0,229,255,0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(0,229,255,0.06)";
                  e.currentTarget.style.borderColor = "rgba(0,229,255,0.2)";
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
                </svg>
                {t("magicLink")}
              </button>
            </div>
          </form>
        </div>

        {/* Sign up + rotating quote */}
        <div
          className="mt-8 text-center"
          style={{
            opacity: mounted ? 1 : 0,
            transition: "opacity 0.7s ease 0.85s",
          }}
        >
          <p className="text-sm" style={{ color: "#8899A6" }}>
            {t("newToPlatform")}{" "}
            <Link
              href={`/${locale}/register`}
              className="font-bold transition-colors"
              style={{ color: "#00E676" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#3DFFA0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#00E676"; }}
            >
              {t("requestAccessArrow")}
            </Link>
          </p>

          {/* Rotating quote — small, subtle */}
          <div className="mt-10 relative h-[60px]">
            {QUOTES.map((q, i) => (
              <div
                key={i}
                className="absolute inset-x-0 transition-all duration-700"
                style={{
                  opacity: i === quoteIndex ? 1 : 0,
                  transform: i === quoteIndex ? "translateY(0)" : "translateY(8px)",
                  pointerEvents: i === quoteIndex ? "auto" : "none",
                }}
              >
                <p className="text-xs italic max-w-md mx-auto leading-relaxed" style={{ color: "#556677" }}>
                  &ldquo;{q.text}&rdquo;
                </p>
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.15em]" style={{ color: "#3D5A72" }}>
                  — {q.author}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════ KEYFRAMES ═══════════════ */}
      <style>{`
        @keyframes orb-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, 60px) scale(1.05); }
          66% { transform: translate(-30px, 30px) scale(0.97); }
        }
        @keyframes orb-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-50px, -40px) scale(1.08); }
        }
        @keyframes orb-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(40px, -60px) scale(0.94); }
        }
        @keyframes wave-flow-1 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-30px); }
        }
        @keyframes wave-flow-2 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(40px); }
        }
        @keyframes wave-flow-3 {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-25px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.1; transform: scale(0.8); }
          50% { opacity: 0.7; transform: scale(1.5); }
        }
        @keyframes halo-pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.15); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
