/**
 * Class recording processor.
 *
 * Two paths:
 *   1. Audio file → Groq Whisper API → transcript
 *   2. Manual transcript pasted by teacher → use directly
 *
 * Then: chunk → embed → store in DocumentChunk with sourceType = 'RECORDING'.
 * Future RAG queries can search class recordings the same way they search materials.
 *
 * Re-uploading a recording REPLACES that session's chunks (shared
 * ingestDocument → replaceChunksForSource). The old insert-only path left the
 * tail chunks of a longer earlier transcript behind as stale search results.
 */

import { aiConfig } from "../config";
import { ingestDocument } from "../ingest";

const WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3";

/** Groq's free tier rejects audio files over 25 MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/aac": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/flac": "flac",
  "audio/x-flac": "flac",
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
};
const KNOWN_EXTENSIONS = new Set(["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"]);

/**
 * Whisper picks the decoder from the FILE NAME's extension, so "recording.audio"
 * was rejected for every upload. Use the original name's extension when it is a
 * known audio type, else derive one from the MIME type (mp3 as a last resort).
 */
export function whisperFilename(mimeType?: string | null, originalName?: string | null): string {
  const fromName = (originalName ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (originalName && originalName.includes(".") && KNOWN_EXTENSIONS.has(fromName)) {
    return `recording.${fromName}`;
  }
  const mime = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  return `recording.${AUDIO_EXTENSIONS[mime] ?? "mp3"}`;
}

export interface IngestRecordingParams {
  sessionId: string;
  classId: string;
  className: string;
  sessionDate: Date;
  // Provide ONE of these:
  transcript?: string;
  audioFile?: Blob;
  audioMimeType?: string;
  /** Original upload name — its extension tells Whisper the format. */
  audioFileName?: string;
  language?: "en" | "fa";
}

export interface IngestResult {
  chunksCreated: number;
  transcriptLength: number;
}

export async function transcribeWithGroq(
  audio: Blob,
  language: "en" | "fa" = "en",
  fileName?: string,
): Promise<string> {
  if (!aiConfig.groq.configured) {
    throw new Error("GROQ_API_KEY required for audio transcription");
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    throw new Error("Audio file is larger than the 25 MB transcription limit");
  }

  const formData = new FormData();
  formData.append("file", audio, whisperFilename(audio.type, fileName));
  formData.append("model", WHISPER_MODEL);
  formData.append("language", language);
  formData.append("response_format", "json");

  const response = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiConfig.groq.apiKey}` },
    body: formData,
    signal: AbortSignal.timeout(5 * 60 * 1000), // long audio takes a while
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper transcription failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.text || "";
}

/**
 * Ingest a class recording into the vector store.
 * Returns the number of chunks created.
 */
export async function ingestRecording(params: IngestRecordingParams): Promise<IngestResult> {
  let transcript = params.transcript;

  // Transcribe if audio was provided
  if (!transcript && params.audioFile) {
    transcript = await transcribeWithGroq(params.audioFile, params.language || "en", params.audioFileName);
  }

  if (!transcript || transcript.trim().length < 50) {
    throw new Error("No usable transcript content");
  }

  const dateStr = params.sessionDate.toISOString().split("T")[0];
  const sourceTitle = `Class Recording: ${params.className} — ${dateStr}`;
  const sourceId = `recording_${params.sessionId}`;

  const result = await ingestDocument({
    content: transcript,
    sourceType: "RECORDING",
    sourceId,
    sourceTitle,
    classId: params.classId,
  });
  const inserted = result.chunksCreated;

  return {
    chunksCreated: inserted,
    transcriptLength: transcript.length,
  };
}
