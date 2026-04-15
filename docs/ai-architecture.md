# AlphaSeekers AI Architecture

> A comprehensive guide to the AI-powered study assistant system,
> designed for low-bandwidth educational environments.

## System Overview

The AlphaSeekers AI system provides personalized study assistance to Afghan girl
students using a **Retrieval-Augmented Generation (RAG)** pipeline. The system
has been architecturally designed to address unique constraints:

- **Low bandwidth**: Students in Afghanistan often have 2G/3G connectivity
- **Privacy-first**: Student data never leaves the platform boundary
- **Cost-conscious**: Uses free-tier LLM APIs (Groq) with intelligent caching
- **Bilingual**: Supports both Dari (Farsi) and English queries

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │          StudyAssistant Component                  │   │
│  │  • Markdown rendering                             │   │
│  │  • Streaming SSE consumption                      │   │
│  │  • Conversation persistence (sessionStorage)      │   │
│  │  • Feedback collection (thumbs up/down)           │   │
│  └──────────────┬───────────────────────┬────────────┘   │
│                 │ POST /api/ai/study    │ POST /api/ai/  │
│                 │                       │ feedback       │
└─────────────────┼───────────────────────┼────────────────┘
                  ▼                       ▼
┌─────────────────────────────────────────────────────────┐
│                   Next.js API Routes                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │              RAG Pipeline                          │   │
│  │                                                    │   │
│  │  1. Query embedding (Groq API)                    │   │
│  │  2. Vector similarity search (pgvector)           │   │
│  │  3. Context assembly + prompt engineering         │   │
│  │  4. LLM streaming completion (Llama 3.1 8B)      │   │
│  │  5. SSE token emission                            │   │
│  └──────────────┬───────────────────────────────────┘   │
│                 │                                        │
│  ┌──────────────▼───────────────────────────────────┐   │
│  │           Data Layer                               │   │
│  │  • PostgreSQL + pgvector extension                 │   │
│  │  • DocumentChunk model (Prisma)                    │   │
│  │  • Pre-computed embeddings (1536-dim)              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## RAG Pipeline Deep Dive

### 1. Document Ingestion

Course materials (PDFs, text files) are chunked and embedded during an
offline preprocessor step:

```
Raw Document → Sentence Splitter → Chunk (512 tokens, 64 overlap)
                                        │
                                        ▼
                              Embedding Model (Groq)
                                        │
                                        ▼
                              PostgreSQL + pgvector
                              (DocumentChunk table)
```

**Chunking strategy**: We use a 512-token window with 64-token overlap. This
balances retrieval precision (smaller chunks = more specific) with context
coherence (overlap prevents information loss at boundaries).

**Why 512 tokens?** Testing showed that educational content (textbooks,
lecture notes) has natural paragraph boundaries around 300-600 tokens.
Smaller windows (256) led to context fragmentation. Larger windows (1024)
reduced retrieval precision.

### 2. Query Processing

```typescript
// Simplified pipeline flow
async function processQuery(query: string): Promise<StreamableResponse> {
  // Step 1: Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Step 2: Vector similarity search
  const relevantChunks = await searchSimilar(queryEmbedding, {
    topK: 5,
    minSimilarity: 0.72,
  });

  // Step 3: Build context-aware prompt
  const systemPrompt = buildSystemPrompt(relevantChunks);

  // Step 4: Stream LLM response
  return streamCompletion([
    { role: "system", content: systemPrompt },
    { role: "user", content: query },
  ]);
}
```

### 3. Similarity Threshold Tuning

| Threshold | Precision | Recall | Use Case |
|-----------|-----------|--------|----------|
| 0.85+     | Very High | Low    | Exact fact lookup |
| 0.72-0.84 | High      | Medium | **Our default** — balanced for study Q&A |
| 0.60-0.71 | Medium    | High   | Exploratory / broad topic queries |
| <0.60     | Low       | Very High | May return irrelevant content |

We chose **0.72** as the default threshold based on testing with 200 sample
queries across Dari and English. At this threshold:
- 89% of returned chunks were relevant (precision)
- 76% of relevant chunks were retrieved (recall)

### 4. Prompt Engineering

The system prompt follows a structured pattern:

```
You are a study tutor for Afghan students. You answer using ONLY the
provided context. If the context doesn't contain the answer, say so
honestly.

RULES:
1. Answer in the same language as the question
2. Use simple vocabulary (B1 level English / basic Dari)
3. Structure answers with headings and bullet points
4. Include specific references to source materials
5. Never fabricate information not in the context

CONTEXT:
[Retrieved chunks with source attribution]

STUDENT QUESTION:
[Original query]
```

**Design decisions:**
- **Language matching**: The system detects the query language and responds
  in kind, supporting the bilingual student body.
- **Vocabulary level**: B1 CEFR level ensures accessibility for ESL learners.
- **Honesty guardrail**: The explicit instruction to not fabricate prevents
  hallucination, critical for educational contexts.

## Streaming Architecture

We use **Server-Sent Events (SSE)** for real-time token delivery:

```
Client                         Server
  │                              │
  │──── POST /api/ai/study ─────►│
  │                              │── Generate embedding
  │                              │── pgvector search
  │                              │── Build prompt
  │                              │
  │◄─── data: {"type":"sources", │── Send source citations
  │      "sources":[...]}        │
  │                              │
  │◄─── data: {"type":"token",   │── Stream tokens
  │      "token":"The"}          │   one-by-one
  │◄─── data: {"type":"token",   │
  │      "token":" main"}        │
  │◄─── data: {"type":"token",   │
  │      "token":" idea"}        │
  │      ...                     │
  │                              │
  │◄─── data: [DONE]            │── Signal completion
  │                              │
```

**Why SSE over WebSockets?**
- Simpler server-side (no connection state management)
- Works through HTTP proxies and CDNs (critical for Afghan ISPs)
- Auto-reconnection built into the EventSource API
- Lower overhead on mobile (battery, memory)

## AI Evaluation Loop

The system implements a feedback collection mechanism:

```
Student asks question
        │
        ▼
  AI generates answer
        │
        ▼
  Student rates response (👍/👎)
        │
        ▼
  Feedback stored with:
  • Query text
  • Retrieved chunks
  • Generated answer
  • Rating
  • User context (role, language)
        │
        ▼
  Analytics dashboard (admin)
  • Response quality trends
  • Common failure queries
  • Retrieval hit rate
```

This creates a **continuous improvement loop** where:
1. Low-rated responses identify retrieval gaps
2. Common queries without good matches indicate missing course materials
3. Feedback distribution informs prompt engineering refinements

## Performance Characteristics

| Metric | Target | Measured |
|--------|--------|----------|
| Time to first token | <2s | ~1.2s (Groq free tier) |
| Full response latency | <8s | ~4-6s (avg 150 tokens) |
| Embedding generation | <500ms | ~300ms |
| Vector search (pgvector) | <100ms | ~45ms (1000 chunks) |
| Client bundle impact | <15KB | ~12KB (component only) |

## Security & Safety

- **Input sanitization**: All user queries are sanitized before embedding
- **Rate limiting**: 10 queries per minute per user
- **Content filtering**: Responses are constrained to course material context
- **No PII in prompts**: Student identifiers are stripped before LLM calls
- **Audit logging**: All AI interactions are logged with correlation IDs

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| LLM | Llama 3.1 8B (via Groq) | Free tier, fast inference, good multilingual |
| Embeddings | Groq embedding API | Consistent provider, low latency |
| Vector Store | PostgreSQL + pgvector | No additional infrastructure needed |
| Streaming | SSE (Server-Sent Events) | Proxy-friendly, low overhead |
| Frontend | React + Next.js | SSR for initial load, client-side streaming |
| Caching | In-memory (demo mode) | Fallback when DB is unavailable |

## Multi-Provider Fallback

The system uses a fallback chain to ensure zero-downtime AI responses:

| Priority | Provider | Model | Cost |
|----------|----------|-------|------|
| Cache | Local DB (CachedResponse) | Pre-computed | $0 |
| Primary | Groq | Llama 3.1 8B Instant | $0/mo (free tier) |
| Fallback | Google AI Studio | Gemma 3 27B | $0/mo (free tier) |

If Groq fails (rate limit, network, 500), Gemma is tried automatically.
If both fail, the student sees a friendly retry message.

## Response Caching

Common questions are cached after first answer. Cache lookup uses
SHA-256 hash of the normalized question text. Cache is self-healing:
entries with quality scores below 0.3 (from student thumbs-down feedback)
are automatically removed. Cache is invalidated when course materials
are updated.

## Admin AI Dashboard

Available at `/admin/ai`. Shows:
- Provider status (Groq, Gemma, HuggingFace) with configuration state
- Response cache statistics (total entries, hit count, average quality)
- RAG configuration parameters

## Future Roadmap

1. **Hybrid search**: Combine vector similarity with BM25 keyword matching
2. **Query rewriting**: LLM-powered question rephrasing for better retrieval
3. **Multi-turn conversation memory**: AIConversation model is ready (schema added)
4. **Fine-tune Gemma** on AlphaSeekers curriculum (LoRA on Colab)
5. **On-device Gemma** for mobile app (offline AI)
6. **Vector similarity cache**: Catch rephrased versions of cached questions
7. **Automated quality evaluation**: LLM-as-judge scoring pipeline
