import { drizzle } from "drizzle-orm/mysql2";
import { artifactVersions, artifactResonance, events } from "./drizzle/schema";
import { eq } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

console.log("=== Strong Positive Probe Test (Artifact 60001) ===\n");

// Get artifact 60001
const artifact = await db
  .select()
  .from(artifactVersions)
  .where(eq(artifactVersions.id, 60001))
  .limit(1);

if (artifact.length === 0) {
  console.log("❌ Artifact 60001 not found!");
  process.exit(1);
}

const art = artifact[0];
console.log(`✓ Artifact 60001 found:`);
console.log(`  Thread: ${art.threadId}, Version: ${art.v}`);
console.log(`  Embedding: ${art.embedding ? JSON.parse(art.embedding as string).length + " dims" : "MISSING"}`);
console.log(`  Tags: ${art.tags || "MISSING"}\n`);

// Get resonances for this artifact
const resonances = await db
  .select()
  .from(artifactResonance)
  .where(eq(artifactResonance.sourceId, 60001));

console.log(`Found ${resonances.length} resonances:\n`);

if (resonances.length > 0) {
  // Sort by score descending
  const sorted = resonances.sort((a, b) => b.score - a.score);
  
  for (const res of sorted.slice(0, 10)) {
    console.log(`  ${res.sourceId} → ${res.targetId}: score=${res.score.toFixed(3)}`);
    console.log(`    Reason: ${res.reason}`);
    console.log();
  }
  
  // Check if any cross the 0.60 threshold
  const strongResonances = sorted.filter(r => r.score >= 0.60);
  console.log(`\n🎯 Strong resonances (≥0.60): ${strongResonances.length}`);
  
  if (strongResonances.length > 0) {
    console.log("✅ SUCCESS! Strong Positive probe crosses adaptive gate!");
  } else {
    const best = sorted[0];
    console.log(`❌ Best score: ${best.score.toFixed(3)} (below 0.60 threshold)`);
  }
} else {
  console.log("❌ No resonances found! Check if findResonances was called.");
}

// Check whisper events
const whispers = await db
  .select()
  .from(events)
  .where(eq(events.type, "artifact.whispered"));

console.log(`\n📢 Total whisper events in system: ${whispers.length}`);

process.exit(0);
