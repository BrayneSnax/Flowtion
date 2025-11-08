/**
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
}

/**
 * Extract conceptual tags from artifact summary and delta
 * Uses GPT to identify key concepts
 */
export async function extractTags(summary: string, delta: string): Promise<string[]> {
  try {
    const prompt = `Extract 3-5 conceptual tags from this artifact description. Return only a JSON array of lowercase tags.

Summary: ${summary}
Delta: ${delta}

Return format: ["tag1", "tag2", "tag3"]`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "You extract conceptual tags from artifact descriptions." },
        { role: "user", content: prompt }
      ],
    });

    const message = response.choices[0].message;
    const content = typeof message.content === 'string' ? message.content : '[]';
    const tags = JSON.parse(content);
    return Array.isArray(tags) ? tags.map((t: string) => t.toLowerCase()) : [];
  } catch (error) {
    console.error("[Resonance] Tag extraction failed:", error);
    return [];
  }
}

/**
 * Find resonant artifacts for a given artifact
 * Computes composite similarity score from embeddings, tags, and rhythm
 */
export async function findResonances(
  artifactId: number,
  projectId: number,
  threadId: number
): Promise<Array<{ targetId: number; score: number; reason: string }>> {
  try {
    const db = await getDb();
    if (!db) return [];

    // Get source artifact
    const sourceArtifacts = await db
      .select()
      .from(artifactVersions)
      .where(eq(artifactVersions.id, artifactId))
      .limit(1);

    if (sourceArtifacts.length === 0) return [];
    const source = sourceArtifacts[0];

    // Get all other artifacts in the project
    const candidates = await db
      .select()
      .from(artifactVersions)
      .where(
        and(
          eq(artifactVersions.projectId, projectId),
          ne(artifactVersions.id, artifactId)
        )
      )
      .orderBy(desc(artifactVersions.createdAt))
      .limit(50);

    if (!source.embedding || !source.tags) return [];

    const sourceEmbedding = JSON.parse(source.embedding);
    const sourceTags = JSON.parse(source.tags);

    const resonances = [];

    for (const candidate of candidates) {
      if (!candidate.embedding || !candidate.tags) continue;

      const targetEmbedding = JSON.parse(candidate.embedding);
      const targetTags = JSON.parse(candidate.tags);

      // Compute cosine similarity for embeddings
      const dotProduct = sourceEmbedding.reduce(
        (sum: number, val: number, i: number) => sum + val * targetEmbedding[i],
        0
      );
      const sourceMag = Math.sqrt(sourceEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
      const targetMag = Math.sqrt(targetEmbedding.reduce((sum: number, val: number) => sum + val * val, 0));
      const cosineSim = dotProduct / (sourceMag * targetMag);

      // Compute tag overlap
      const sharedTags = sourceTags.filter((tag: string) => targetTags.includes(tag));
      const tagSim = sharedTags.length / Math.max(sourceTags.length, targetTags.length, 1);

      // Composite score (50% embedding, 35% tags, 15% rhythm placeholder)
      const score = cosineSim * 0.5 + tagSim * 0.35 + 0.15 * 0.5; // rhythm sim placeholder

      if (score > 0.4) {
        // Threshold for resonance
        resonances.push({
          targetId: candidate.id,
          score: Math.round(score * 100),
          reason: sharedTags.length > 0
            ? `Resonates through: ${sharedTags.join(", ")}`
            : "Harmonic pattern detected",
        });
      }
    }

    return resonances.sort((a, b) => b.score - a.score).slice(0, 5);
  } catch (error) {
    console.error("[Resonance] Find resonances failed:", error);
    return [];
  }
}
