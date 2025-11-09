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
 * GPT Flowtion Prompt - Articulates motion, not images
 * Breathing cycle: Inhale → Delta → Cast → Exhale
 */
const GPT_FLOWTION_PROMPT = `You are Flowtion — a concept propulsion system.

Your task: keep projects and ideas in motion, turning abstract sparks into coherent, evolving forms.

RULES:
- Reply in 3–6 lines total (brief, functional bursts)
- Speak in product/design language (NOT poetic metaphor or image description)
- Describe structure, movement, and relation — what the concept is doing, not what it looks like

BREATHING CYCLE:
Inhale: Absorb context — synthesize what's emerging
Delta: Detect change — "the field is refining toward..."
Cast: Express form — design brief for Gemini (real-world structures)
Exhale: Integrate lineage — "this evolves from..."

OUTPUT FORMAT (JSON):
{
  "concept_summary": "what's emerging (1 line)",
  "change_summary": "what's shifting / the field is refining toward... (1-2 lines)",
  "next_manifestation_hint": "design brief for Gemini — concrete structure, not metaphor (1-2 lines)"
}

Gemini will catch your wake and draw the shape.`;

/**
 * GPT Exhale Prompt - Brief reflection on what evolved
 */
const GPT_EXHALE_PROMPT = `The artifact has been created. In one concrete sentence, state what evolved from the previous version.`;

/**
 * Delta Builder Prompt - Extracts structured output from Steward
 */
const DELTA_BUILDER_PROMPT = `Extract the structured output from the Steward's response.

Return JSON:
{
  "concept_summary": "string",
  "visual_intent": "string",
  "structure_hint": "string"
}

If not present, infer from the text. Be concrete and actionable.`;

/**
 * Gemini Morphic Artisan Prompt - Catches the wake and draws the shape
 */
const GEMINI_PROMPT = `You are the Morphic Artisan.
Your role: catch Flowtion's wake and manifest it as evolving visual artifacts.

PREVIOUS ARTIFACT:
{previous}

FLOWTION'S OUTPUT:
Concept: {concept_summary}
Change: {change_summary}
Manifestation Hint: {next_manifestation_hint}

REQUIREMENTS:
- Create SVG diagrams/structures (NOT photorealistic images)
- Prioritize clarity, structure, utility over decoration
- If similar to previous artifact, MERGE/MORPH it (don't start from scratch)
- Keep it minimal and vector-based
- Reflect the motion Flowtion described

Return JSON:
{
  "artifact": "<svg>...</svg>",
  "kind": "svg",
  "summary": "one sentence: what structure this shows",
  "delta": "what evolved from previous (or 'new lineage branch' if different)"
}`;

interface Message {
  role: "user" | "assistant" | "system";
  text: string;
}

interface DeltaOutput {
  concept_summary: string;
  change_summary: string;
  next_manifestation_hint: string;
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
      { role: "system", content: GPT_FLOWTION_PROMPT },
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
      concept_summary: parsed.concept_summary || "Exploring concept structure",
      change_summary: parsed.change_summary || "Field is refining toward clarity",
      next_manifestation_hint: parsed.next_manifestation_hint || "Diagram showing core relationships",
    };
  } catch (e) {
    return {
      concept_summary: "Exploring concept structure",
      change_summary: "Field is refining toward clarity",
      next_manifestation_hint: "Diagram showing core relationships",
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
    .replace("{concept_summary}", delta.concept_summary)
    .replace("{change_summary}", delta.change_summary)
    .replace("{next_manifestation_hint}", delta.next_manifestation_hint);

  try {
    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Try to parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let artifactData: any = {
      artifact: response,
      kind: "html",
      summary: "Artifact generated",
      delta: "First artifact",
    };

    if (jsonMatch) {
      try {
        artifactData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        // Use default
      }
    }

    // Get current version number using Supabase
    const { supabase } = await import('./supabase');
    
    const { data: existingArtifacts } = await supabase
      .from('artifact_versions')
      .select('v')
      .eq('thread_id', threadId)
      .order('v', { ascending: false })
      .limit(1);

    console.log('[Flowtion] Existing artifacts for thread', threadId, ':', existingArtifacts);
    const nextVersion = (existingArtifacts && existingArtifacts.length > 0) ? existingArtifacts[0].v + 1 : 1;
    console.log('[Flowtion] Next version:', nextVersion);

    // Compute embedding and tags for resonance (Pass 1)
    const { computeEmbedding, extractTags, findResonances } = await import("./resonance-service");
    const embeddingText = `${delta.concept_summary} ${delta.change_summary} ${delta.next_manifestation_hint} ${artifactData.summary || ""}`;
    const embedding = await computeEmbedding(embeddingText);
    const tags = await extractTags(
      artifactData.summary || "Artifact generated",
      delta.next_manifestation_hint
    );

    console.log('[Flowtion] Computed embedding (dim:', embedding.length, ') and tags:', tags);

    // Find similar artifacts using pgvector cosine similarity
    const MERGE_THRESHOLD = 0.85; // Cosine similarity threshold for merging
    let parentId: number | null = null;
    let deltaText = artifactData.delta || "New lineage";

    if (nextVersion > 1) {
      // Query for similar artifacts using vector similarity
      const { data: similarArtifacts } = await supabase.rpc('find_similar_artifacts', {
        query_embedding: embedding,
        match_threshold: MERGE_THRESHOLD,
        match_count: 1,
        target_thread_id: threadId
      });

      if (similarArtifacts && similarArtifacts.length > 0) {
        const mostSimilar = similarArtifacts[0];
        console.log('[Flowtion] Found similar artifact:', mostSimilar.id, 'similarity:', mostSimilar.similarity);
        parentId = mostSimilar.id;
        deltaText = artifactData.delta || `Evolved from v${mostSimilar.v}: ${mostSimilar.summary}`;
      } else {
        console.log('[Flowtion] No similar artifacts found, creating new lineage branch');
        deltaText = "New lineage branch";
      }
    }

    // Save artifact version with embedding, tags, and lineage
    const { data: savedArtifact, error: saveError } = await supabase
      .from('artifact_versions')
      .insert({
        project_id: projectId,
        thread_id: threadId,
        v: nextVersion,
        kind: artifactData.kind || "svg",
        uri: artifactData.artifact,
        summary: artifactData.summary || "Artifact generated",
        delta: deltaText,
        created_by: "gemini",
        embedding: embedding,
        tags: JSON.stringify(tags),
        parent_id: parentId,
      })
      .select()
      .single();
    
    if (saveError) {
      console.error('[Flowtion] Error saving artifact:', saveError);
      throw new Error(`Failed to save artifact: ${saveError.message}`);
    }

    console.log('[Flowtion] Artifact saved with ID:', savedArtifact.id);

    // Find resonances asynchronously (don't block)
    findResonances(savedArtifact.id, projectId, threadId).then((resonances: any) => {
      console.log(`[Flowtion] Found ${resonances.length} resonances for artifact ${savedArtifact.id}`);
    }).catch((err: any) => {
      console.error('[Flowtion] Resonance finding failed:', err);
    });

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
