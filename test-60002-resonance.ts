import { getDb } from "./server/db";
import { artifactVersions, artifactResonance, events } from "./drizzle/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  const db = await getDb();
  if (!db) {
    console.log("Database not available");
    return;
  }

  // Get artifact 60002 details
  const artifacts = await db
    .select()
    .from(artifactVersions)
    .where(eq(artifactVersions.id, 60002))
    .limit(1);

  if (artifacts.length === 0) {
    console.log("Artifact 60002 not found");
    return;
  }

  const artifact = artifacts[0];
  console.log(`\nArtifact 60002:`);
  console.log(`  Summary: ${artifact.summary}`);
  console.log(`  Tags: ${artifact.tags}`);
  console.log(`  Embedding length: ${artifact.embedding ? JSON.parse(artifact.embedding).length : 0}`);

  // Get resonances
  const resonances = await db
    .select()
    .from(artifactResonance)
    .where(eq(artifactResonance.sourceId, 60002))
    .orderBy(desc(artifactResonance.score));

  console.log(`\nResonances found: ${resonances.length}`);
  for (const res of resonances) {
    console.log(`  ${res.sourceId} → ${res.targetId}: score=${res.score / 100}, reason="${res.reason}"`);
  }

  // Get whisper events
  const whispers = await db
    .select()
    .from(events)
    .where(eq(events.kind, "artifact.whispered"))
    .orderBy(desc(events.createdAt))
    .limit(10);

  console.log(`\nRecent whisper events: ${whispers.length}`);
  for (const whisper of whispers) {
    const payload = JSON.parse(whisper.payload);
    console.log(`  ${payload.from} → ${payload.to}: strength=${payload.strength}, reason="${payload.reason}"`);
  }

  // Check if score crosses 0.60 threshold
  const strongResonances = resonances.filter(r => r.score >= 60);
  console.log(`\n🎯 Strong resonances (≥0.60): ${strongResonances.length}`);
  if (strongResonances.length > 0) {
    console.log(`✅ SUCCESS! Strong Positive probe crosses adaptive gate!`);
  } else if (resonances.length > 0) {
    console.log(`⚠️  Best score: ${resonances[0].score / 100} (below 0.60 threshold)`);
  } else {
    console.log(`❌ No resonances found`);
  }
}

main();
