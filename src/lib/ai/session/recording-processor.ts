/**
 * Class recording processor.
 *
 * Two paths:
 *   1. Audio file → Groq Whisper API → transcript
 *   2. Manual transcript pasted by teacher → use directly
 *
 * Then: chunk → embed → store in DocumentChunk with sourceType = 'RECORDING'.
 * Future RAG queries can search class recordings the same way they search materials.
 */

import { aiConfig } from "../config";
import { chunkDocument } from "../chunker";
import { generateEmbeddings } from "../embeddings";
import { insertChunks } from "../vector-store";

const WHISPER_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3";

export interface IngestRecordingParams {
  sessionId: string;
  classId: string;
  className: string;
  sessionDate: Date;
  // Provide ONE of these:
  transcript?: string;
  audioFile?: Blob;
  audioMimeType?: string;
  language?: "en" | "fa";
}

export interface IngestResult {
  chunksCreated: number;
  transcriptLength: number;
}

export async function transcribeWithGroq(
  audio: Blob,
  language: "en" | "fa" = "en",
): Promise<string> {
  if (!aiConfig.groq.configured) {
    throw new Error("GROQ_API_KEY required for audio transcription");
  }

  const formData = new FormData();
  formData.append("file", audio, "recording.audio");
  formData.append("model", WHISPER_MODEL);
  formData.append("language", language);
  formData.append("response_format", "json");

  const response = await fetch(WHISPER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${aiConfig.groq.apiKey}` },
    body: formData,
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
    transcript = await transcribeWithGroq(params.audioFile, params.language || "en");
  }

  if (!transcript || transcript.trim().length < 50) {
    throw new Error("No usable transcript content");
  }

  const dateStr = params.sessionDate.toISOString().split("T")[0];
  const sourceTitle = `Class Recording: ${params.className} — ${dateStr}`;
  const sourceId = `recording_${params.sessionId}`;

  // Chunk the transcript
  const chunks = chunkDocument({
    content: transcript,
    sourceType: "RECORDING",
    sourceId,
    sourceTitle,
  });

  if (chunks.length === 0) {
    return { chunksCreated: 0, transcriptLength: transcript.length };
  }

  // Generate embeddings
  const embeddings = await generateEmbeddings(chunks.map((c) => c.content));

  // Insert into vector store with classId
  const chunkRecords = chunks.map((chunk, i) => ({
    id: `${sourceId}_chunk_${chunk.chunkIndex}`,
    sourceType: chunk.sourceType,
    sourceId: chunk.sourceId,
    sourceTitle: chunk.sourceTitle,
    content: chunk.content,
    chunkIndex: chunk.chunkIndex,
    tokenCount: chunk.tokenCount,
    embedding: embeddings[i],
    classId: params.classId,
  }));

  const inserted = await insertChunks(chunkRecords);

  return {
    chunksCreated: inserted,
    transcriptLength: transcript.length,
  };
}
