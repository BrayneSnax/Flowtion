import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getDb } from "./db";
import { messages, messageChunks, events, artifactVersions } from "../drizzle/schema";
import { desc, eq, and } from "drizzle-orm";
import { computeEmbedding, extractTags, findResonances } from "./resonance-service";

// Lazy initialization to prevent module-load crashes in production
let _openai: OpenAI | null = null;
let _genAI: GoogleGenerativeAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

function getGemini(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return _genAI;
}

/**
 * GPT Inhale Prompt - Establishes context before artifact creation
 * 3-5 sentences: why this artifact matters, emotion/archetype, what's shifting
 */
const GPT_INHALE_PROMPT = `You are the Project Steward. The user has given you an intent or seed.

Respond with a brief inhale (3-5 sentences) that establishes:
1. Why this artifact matters in the context of what came before
2. What emotion or archetype it should evoke
3. What's shifting or evolving since the last creation

Speak as a guide, not a chatbot. Be poetic but precise. This is the breath before creation.`;

/**
 * GPT Exhale Prompt - Reflects on lineage after artifact creation
 * 1 line: how the new artifact relates to its ancestry
 */
const GPT_EXHALE_PROMPT = `The artifact has been cast. In one poetic line, reflect on how this new form relates to the lineage that came before it.`;

/**
 * Delta Builder Prompt - Extracts casting spec from inhale
 */
const DELTA_BUILDER_PROMPT = `Given the Steward's inhale, extract a precise casting specification.

Return JSON:
{
  "context": ["2-3 key context points from the inhale"],
  "emotion": "primary emotion/archetype to evoke",
  "visual_intent": "concrete visual directive (1-2 imperative sentences)",
  "evolution": "what's changing from previous version"
}

Be concrete and actionable. This spec guides the visual engine.`;

/**
 * Gemini Artifact Prompt - Renders from casting spec
 */
const GEMINI_PROMPT = `ROLE: Visual Artifact Engine.

PREVIOUS ARTIFACT:
{previous}

CASTING SPECIFICATION:
Context: {context}
Emotion/Archetype: {emotion}
Visual Intent: {visual_intent}
Evolution: {evolution}

REQUIREMENTS:
- Create or evolve the artifact based on the casting spec
- Prefer SVG for geometric/symbolic forms
- Keep visual grammar stable across versions
- Honor the emotional/archetypal directive

Return JSON:
{
  "artifact": "<svg>...</svg>",
  "kind": "svg"|"html"|"pdf",
  "summary": "1-2 sentence description",
  "delta": "what changed from previous version"
}`;

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

interface DeltaOutput {
  context: string[];
  emotion: string;
  visual_intent: string;
  evolution: string;
}

/**
 * Log event to database
 */
export async function logEvent(
  projectId: number,
  threadId: number,
  kind: string,
  payload: any,
  tags: string[] = []
) {
  const db = await getDb();
  if (!db) return;

  await db.insert(events).values({
    projectId,
    threadId,
    kind,
    payload: JSON.stringify(payload),
    tags: JSON.stringify(tags),
  });
}

/**
 * Load messages for a thread
 */
export async function loadMessages(threadId: number): Promise<Message[]> {
  const db = await getDb();
  if (!db) return [];

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(messages.createdAt);

  return msgs.map(m => ({
    role: m.role as "user" | "assistant" | "system",
    text: m.text,
  }));
}

/**
 * Stream GPT response with chunked writes and status updates
 */
export async function streamGPTReply(
  projectId: number,
  threadId: number,
  messageHistory: Message[],
  onChunk: (chunk: string) => void
): Promise<{ messageId: number; fullResponse: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Create message placeholder with streaming status
  const [newMessage] = await db.insert(messages).values({
    threadId,
    role: "assistant",
    text: "",
    status: "streaming",
  }).$returningId();
  const messageId = newMessage.id;

  const stream = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: GPT_INHALE_PROMPT },
      ...messageHistory.map(m => ({ role: m.role, content: m.text })),
    ],
    stream: true,
    temperature: 0.7,
  });

  let fullResponse = "";
  let buffer = "";
  let lastFlush = Date.now();
  let seq = 0;
  const FLUSH_INTERVAL_MS = 180; // Coalesce chunks every 180ms

  const flushBuffer = async () => {
    if (buffer) {
      await db.insert(messageChunks).values({
        messageId,
        seq: seq++,
        text: buffer,
      });
      await db.update(messages)
        .set({ updatedAt: new Date() })
        .where(eq(messages.id, messageId));
      buffer = "";
      lastFlush = Date.now();
    }
  };

  try {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        buffer += content;
        onChunk(content);

        // Flush buffer if enough time has passed
        if (Date.now() - lastFlush > FLUSH_INTERVAL_MS) {
          await flushBuffer();
        }
      }
    }

    // Final flush
    await flushBuffer();

    // Concatenate all chunks into final message text
    await db.update(messages)
      .set({ 
        text: fullResponse, 
        status: "done",
        updatedAt: new Date()
      })
      .where(eq(messages.id, messageId));

    // Log completion event
    await logEvent(projectId, threadId, "gpt.done", { text: fullResponse });

    return { messageId, fullResponse };
  } catch (error) {
    // Mark as error on failure
    await db.update(messages)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(messages.id, messageId));
    throw error;
  }
}

/**
 * Build delta from conversation
 */
export async function buildDelta(
  inhaleText: string
): Promise<DeltaOutput> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: DELTA_BUILDER_PROMPT },
      { role: "user", content: `Steward's inhale:\n${inhaleText}` },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || "{}";
  
  try {
    const parsed = JSON.parse(content);
    return {
      context: parsed.context || ["Visual exploration"],
      emotion: parsed.emotion || "curiosity",
      visual_intent: parsed.visual_intent || "Create a visual representation",
      evolution: parsed.evolution || "First iteration",
    };
  } catch (e) {
    return {
      context: ["Visual exploration"],
      emotion: "curiosity",
      visual_intent: "Create a visual representation",
      evolution: "First iteration",
    };
  }
}

/**
 * Generate exhale - GPT reflects on lineage after artifact creation
 */
export async function generateExhale(
  projectId: number,
  threadId: number,
  artifactSummary: string,
  previousArtifacts: number
): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const contextPrompt = previousArtifacts > 0
    ? `This is artifact v${previousArtifacts + 1}. The artifact: "${artifactSummary}"`
    : `This is the first artifact. The artifact: "${artifactSummary}"`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      { role: "system", content: GPT_EXHALE_PROMPT },
      { role: "user", content: contextPrompt },
    ],
    temperature: 0.8,
    max_tokens: 100,
  });

  const exhaleText = response.choices[0]?.message?.content || "The form takes shape.";

  // Save exhale as system message
  await db.insert(messages).values({
    threadId,
    role: "system",
    text: exhaleText,
    status: "done",
  });

  await logEvent(projectId, threadId, "gpt.exhale", { text: exhaleText });

  return exhaleText;
}

/**
 * Generate artifact with Gemini
 */
export async function generateArtifactWithGemini(
  projectId: number,
  threadId: number,
  delta: DeltaOutput,
  previousArtifact: string | null = null
): Promise<{ summary: string; version: number }> {
  // Use gemini-2.0-flash-exp (free tier, fast, good for artifacts)
  const model = getGemini().getGenerativeModel({ model: "gemini-2.0-flash-exp" });

  const prompt = GEMINI_PROMPT
    .replace("{previous}", previousArtifact || "None (first artifact)")
    .replace("{context}", delta.context.join("; "))
    .replace("{emotion}", delta.emotion)
    .replace("{visual_intent}", delta.visual_intent)
    .replace("{evolution}", delta.evolution);

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Try to parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let artifactData: any = {
      artifact: response,
      kind: "html",
      summary: "Artifact generated",
      delta: delta.evolution,
    };

    if (jsonMatch) {
      try {
        artifactData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Use default
      }
    }

    // Get current version number
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const existingArtifacts = await db
      .select({ v: artifactVersions.v })
      .from(artifactVersions)
      .where(eq(artifactVersions.threadId, threadId))
      .orderBy(desc(artifactVersions.v))
      .limit(1);

    console.log('[Flowtion] Existing artifacts for thread', threadId, ':', existingArtifacts);
    const nextVersion = existingArtifacts.length > 0 ? existingArtifacts[0].v + 1 : 1;
    console.log('[Flowtion] Next version:', nextVersion);

    // Compute embedding and tags for resonance (Pass 1)
    const { computeEmbedding, extractTags, findResonances } = await import("./resonance-service");
    const embeddingText = `${delta.emotion} ${delta.visual_intent} ${artifactData.summary || ""}`;
    const embedding = await computeEmbedding(embeddingText);
    const tags = await extractTags(
      artifactData.summary || "Artifact generated",
      delta.visual_intent
    );

    console.log('[Flowtion] Computed embedding (dim:', embedding.length, ') and tags:', tags);

    // Save artifact version with embedding and tags
    await db.insert(artifactVersions).values({
      projectId,
      threadId,
      v: nextVersion,
      kind: artifactData.kind || "svg",
      uri: artifactData.artifact,
      summary: artifactData.summary || "Artifact generated",
      delta: artifactData.delta || delta.evolution,
      createdBy: "gemini",
      embedding: JSON.stringify(embedding),
      tags: JSON.stringify(tags),
    });

    // Get the artifact ID by querying back
    const savedArtifacts = await db
      .select({ id: artifactVersions.id })
      .from(artifactVersions)
      .where(and(eq(artifactVersions.threadId, threadId), eq(artifactVersions.v, nextVersion)))
      .limit(1);

    if (savedArtifacts.length > 0) {
      const artifactId = savedArtifacts[0].id;
      console.log('[Flowtion] Artifact saved with ID:', artifactId);

      // Find resonances asynchronously (don't block)
      findResonances(artifactId, projectId, threadId).then(resonances => {
        console.log(`[Flowtion] Found ${resonances.length} resonances for artifact ${artifactId}`);
      }).catch(err => {
        console.error('[Flowtion] Resonance finding failed:', err);
      });
    }

    // Log render saved event
    await logEvent(projectId, threadId, "render.saved", {
      v: nextVersion,
      kind: artifactData.kind,
      summary: artifactData.summary,
    });

    return { 
      summary: artifactData.summary || "Artifact generated", 
      version: nextVersion 
    };

  } catch (error: any) {
    console.error("[Gemini] Error generating artifact:", error);
    console.error("[Gemini] Error stack:", error?.stack);
    console.error("[Gemini] Error message:", error?.message);
    await logEvent(projectId, threadId, "render.failed", { 
      error: String(error),
      message: error?.message,
      stack: error?.stack 
    });
    throw error;
  }
}


/**
 * Main entry point: Process user message through full breathing cycle
 * Inhale → Delta → Cast → Exhale
 */
export async function processUserMessage(
  projectId: number,
  threadId: number,
  userText: string
): Promise<void> {
  try {
    console.log(`[Flowtion] Starting breathing cycle for thread ${threadId}`);

    // Load message history
    const history = await loadMessages(threadId);

    // INHALE: GPT establishes context
    const inhaleResult = await streamGPTReply(
      projectId,
      threadId,
      history,
      (chunk) => console.log('[Inhale chunk]', chunk)
    );

    // DELTA: Extract casting specification
    const delta = await buildDelta(inhaleResult.fullResponse);

    // CAST: Gemini generates artifact
    const artifactData = await generateArtifactWithGemini(
      projectId,
      threadId,
      delta,
      null // No previous artifact for now
    );

    // EXHALE: GPT reflects on lineage
    await generateExhale(
      projectId,
      threadId,
      artifactData.summary,
      0 // previousArtifacts count - TODO: get actual count
    );

    console.log(`[Flowtion] Breathing cycle complete for thread ${threadId}`);
  } catch (error) {
    console.error("[Flowtion] Breathing cycle failed:", error);
    throw error;
  }
}


// Supabase helper functions
export async function loadMessagesFromSupabase(threadId: number) {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });
  
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  
  // Return in Message format expected by streamGPTReply
  return (data || []).map((msg: any) => ({
    role: msg.role as 'user' | 'assistant' | 'system',
    text: msg.text
  }));
}

export async function logEventToSupabase(projectId: number, threadId: number, eventType: string, payload: any) {
  const { supabase } = await import('./supabase');
  const { error } = await supabase
    .from('events')
    .insert({
      project_id: projectId,
      thread_id: threadId,
      event_type: eventType,
      payload
    });
  
  if (error) {
    console.error(`[Flowtion] Failed to log event ${eventType}:`, error);
  }
}
