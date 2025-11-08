import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { artifactVersions } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

console.log('\n=== Thread 5 Artifacts ===\n');
const artifacts = await db.select()
  .from(artifactVersions)
  .where(eq(artifactVersions.threadId, 5))
  .orderBy(artifactVersions.id);

artifacts.forEach(art => {
  console.log(`ID: ${art.id} | v${art.v} | ${art.kind} | ${art.summary?.substring(0, 50)}...`);
  console.log(`  Created: ${art.createdAt}\n`);
});

console.log(`\nTotal artifacts: ${artifacts.length}`);
console.log(`Version sequence: ${artifacts.map(a => `v${a.v}`).join(' → ')}\n`);

process.exit(0);
