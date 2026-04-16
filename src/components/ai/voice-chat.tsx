"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface VoiceChatProps {
  onTranscript: (text: string) => void;
  isAiResponding: boolean;
  locale: "en" | "fa";
  aiResponse?: string;
}

// Narrow type for the Web Speech API (not in standard DOM lib)
type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string }; isFinal: boolean } }; }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function VoiceChat({ onTranscript, isAiResponding, locale, aiResponse }: VoiceChatProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const supported = typeof window !== "undefined" && Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
    setIsSupported(supported);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported || isAiResponding) return;

    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionType; webkitSpeechRecognition?: new () => SpeechRecognitionType };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = locale === "fa" ? "fa-AF" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript("");
    };

    recognition.onresult = (event) => {
      const results = event.results as unknown as ArrayLike<{ [j: number]: { transcript: string }; isFinal: boolean }>;
      const lastIndex = results.length - 1;
      const current = results[lastIndex];
      const text = current[0].transcript;
      setTranscript(text);

      if (current.isFinal) {
        setIsListening(false);
        onTranscript(text);
      }
    };

    recognition.onerror = (event) => {
      console.error("[Voice] Recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, isAiResponding, locale, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speakResponse = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale === "fa" ? "fa-AF" : "en-US";
      utterance.rate = 0.9;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [locale],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Auto-read short AI responses (practice mode)
  useEffect(() => {
    if (aiResponse && !isSpeaking && aiResponse.length < 500 && aiResponse.length > 10) {
      speakResponse(aiResponse);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiResponse]);

  if (!isSupported) return null;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        disabled={isAiResponding}
        className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
          isListening
            ? "bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/30"
            : "bg-dark-100 text-ink-soft hover:bg-dark-200"
        } ${isAiResponding ? "opacity-40 cursor-not-allowed" : ""}`}
        aria-label={isListening ? "Stop listening" : "Start voice input"}
        title={isListening ? "Stop listening" : "Speak your question"}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
        </svg>
      </button>

      {isListening && transcript && (
        <span className="text-sm text-ink-faint italic truncate max-w-[200px]">{transcript}...</span>
      )}

      {aiResponse && aiResponse.length > 10 && (
        <button
          type="button"
          onClick={isSpeaking ? stopSpeaking : () => speakResponse(aiResponse)}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isSpeaking ? "text-neon-600 bg-neon-50" : "text-ink-faint hover:text-ink-soft hover:bg-dark-100"
          }`}
          aria-label={isSpeaking ? "Stop speaking" : "Read aloud"}
          title={isSpeaking ? "Stop speaking" : "Read aloud"}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
