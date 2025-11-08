import { drizzle } from "drizzle-orm/mysql2";
import { artifactVersions, artifactResonance, events } from "./drizzle/schema";
import { eq, or } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

console.log("=== Cross-Thread Resonance Test ===\n");

// Check artifact 30009 (mandala in Thread 30002)
console.log("1. Mandala artifact (Thread 30002):");
const mandala = await db
  .select()
  .from(artifactVersions)
  .where(eq(artifactVersions.id, 30009));

if (mandala.length > 0) {
  const art = mandala[0];
  console.log("  ✓ Found artifact 30009");
  console.log("  Thread:", art.threadId, "| v:", art.v);
  console.log("  Tags:", art.tags);
  console.log("  Embedding:", art.embedding ? "Present" : "NULL");
}

// Check resonances FROM mandala TO Syndicate artifacts
console.log("\n2. Resonances FROM mandala (30009):");
const fromMandala = await db
  .select()
  .from(artifactResonance)
  .where(eq(artifactResonance.sourceId, 30009));

console.log(`  Found ${fromMandala.length} resonances`);
fromMandala.forEach((res, i) => {
  console.log(`  ${i + 1}. → artifact ${res.targetId} | score: ${res.score/100} | ${res.reason}`);
});

// Check resonances TO mandala FROM Syndicate artifacts
console.log("\n3. Resonances TO mandala (30009):");
const toMandala = await db
  .select()
  .from(artifactResonance)
  .where(eq(artifactResonance.targetId, 30009));

console.log(`  Found ${toMandala.length} resonances`);
toMandala.forEach((res, i) => {
  console.log(`  ${i + 1}. artifact ${res.sourceId} → | score: ${res.score/100} | ${res.reason}`);
});

// Check whisper events
console.log("\n4. Whisper events:");
const whispers = await db
  .select()
  .from(events)
  .where(eq(events.kind, "artifact.whispered"));

console.log(`  Total: ${whispers.length}`);
if (whispers.length > 0) {
  whispers.slice(-3).forEach((w, i) => {
    const payload = JSON.parse(w.payload);
    console.log(`  ${i + 1}. ${payload.from} → ${payload.to} | strength: ${payload.strength} | ${payload.reason}`);
  });
}

process.exit(0);
