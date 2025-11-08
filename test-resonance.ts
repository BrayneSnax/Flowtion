import { drizzle } from "drizzle-orm/mysql2";
import { artifactVersions, artifactResonance, events } from "./drizzle/schema";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

console.log("=== Testing Resonance Layer ===\n");

// Check artifact 30008
console.log("1. Checking artifact 30008:");
const artifacts = await db
  .select()
  .from(artifactVersions)
  .where(eq(artifactVersions.id, 30008));

if (artifacts.length > 0) {
  const art = artifacts[0];
  console.log("  ✓ Artifact found");
  console.log("  ID:", art.id, "| v:", art.v);
  console.log("  Summary:", art.summary);
  console.log("  Embedding:", art.embedding ? `Present (${art.embedding.length} chars)` : "❌ NULL");
  console.log("  Tags:", art.tags || "❌ NULL");
} else {
  console.log("  ❌ Artifact not found");
}

console.log("\n2. Checking resonances for artifact 30008:");
const resonances = await db
  .select()
  .from(artifactResonance)
  .where(eq(artifactResonance.sourceId, 30008));

console.log(`  Found ${resonances.length} resonances`);
resonances.forEach((res, i) => {
  console.log(`  ${i + 1}. Target: ${res.targetId} | Score: ${res.score/100} | Reason: ${res.reason}`);
});

console.log("\n3. Checking whisper events:");
const whisperEvents = await db
  .select()
  .from(events)
  .where(eq(events.kind, "artifact.whispered"));

console.log(`  Total whisper events: ${whisperEvents.length}`);
if (whisperEvents.length > 0) {
  const latest = whisperEvents[whisperEvents.length - 1];
  console.log(`  Latest: ${latest.payload}`);
}

process.exit(0);
