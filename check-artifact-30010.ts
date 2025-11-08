import { drizzle } from "drizzle-orm/mysql2";
import { artifactVersions, artifactResonance, events } from "./drizzle/schema";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

console.log("=== Artifact 30010 Resonance Check ===\n");

// Check artifact 30010
const artifact = await db
  .select()
  .from(artifactVersions)
  .where(eq(artifactVersions.id, 30010));

if (artifact.length > 0) {
  const art = artifact[0];
  console.log("✓ Artifact 30010 found");
  console.log("  Thread:", art.threadId, "| v:", art.v);
  console.log("  Tags:", art.tags);
  console.log("  Embedding:", art.embedding ? `Present (${art.embedding.length} chars)` : "NULL");
}

// Check resonances FROM 30010
const fromArt = await db
  .select()
  .from(artifactResonance)
  .where(eq(artifactResonance.sourceId, 30010));

console.log(`\nResonances FROM 30010: ${fromArt.length}`);
fromArt.forEach((res, i) => {
  console.log(`  ${i + 1}. → ${res.targetId} | score: ${res.score/100} | ${res.reason}`);
});

// Check whisper events
const whispers = await db
  .select()
  .from(events)
  .where(eq(events.kind, "artifact.whispered"));

console.log(`\nTotal whisper events: ${whispers.length}`);

process.exit(0);
