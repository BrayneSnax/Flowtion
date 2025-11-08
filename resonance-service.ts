 * Resonance Service (Pass 1: Emergence Core)
 * 
 * Observes artifact relationships without changing behavior.
 * Computes embeddings, scores resonance, logs whispers.
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import { artifactVersions, artifactResonance, events } from "../drizzle/schema";
import { eq, desc, and, sql, ne } from "drizzle-orm";

/**
 * Compute embedding vector for artifact content
 * Uses OpenAI text-embedding-3-small model
 */
export async function computeEmbedding(text: string): Promise<number[]> {
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error("[Resonance] Embedding computation failed:", error);
    return [];
  }