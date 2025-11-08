import { drizzle } from "drizzle-orm/mysql2";
import { artifactVersions } from "./drizzle/schema";
import { eq, isNull } from "drizzle-orm";
import { computeEmbedding, extractTags } from "./server/resonance-service";

const db = drizzle(process.env.DATABASE_URL!);

console.log("=== Backfilling Embeddings and Tags ===\n");

// Get artifacts without embeddings or tags
const artifacts = await db
  .select()
  .from(artifactVersions)
  .where(isNull(artifactVersions.embedding));

console.log(`Found ${artifacts.length} artifacts to backfill\n`);

for (const art of artifacts) {
  console.log(`Processing artifact ${art.id}...`);
  
  // Compute embedding
  const embeddingText = `${art.summary}\n\n${art.body}`;
  const embedding = await computeEmbedding(embeddingText);
  
  // Extract tags
  const tags = await extractTags(art.summary, art.delta || "");
  
  // Update artifact
  await db
    .update(artifactVersions)
    .set({
      embedding: JSON.stringify(embedding),
      tags: JSON.stringify(tags),
    })
    .where(eq(artifactVersions.id, art.id));
  
  console.log(`  ✓ Embedding: ${embedding.length} dims, Tags: ${JSON.stringify(tags)}`);
}

console.log(`\n✓ Backfill complete!`);
process.exit(0);
