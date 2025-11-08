import { findResonances } from "./server/resonance-service";

console.log("=== Manual Resonance Test ===\n");
console.log("Calling findResonances for artifact 30010...\n");

findResonances(30010)
  .then(count => {
    console.log(`\n✓ findResonances completed: found ${count} resonances`);
    process.exit(0);
  })
  .catch(err => {
    console.error("\n✗ findResonances failed:", err);
    process.exit(1);
  });
