# Ritual Testing Status

## ✅ Implemented Now

### 1. De-dupe with Dignity
**Status**: Foundation Active
- Fuzzy matching with normalization (case, punctuation, articles, whitespace)
- ~85% similarity threshold for duplicate detection
- Cross-type collision detection (same title, different types)
- Soft warnings in AI response instead of silent blocks
- Message includes: "Already exists as [type]" or "Exists as X, creating as Y"

**Ready to Test**:
```
Create "Evening decompression" twice → Get warned
Try "Evening Decompression!" vs "evening decompression" → Matched as duplicate
Create as Ritual, then as Project → Cross-type warning
```

**Next Step Seeded**:
- Interactive menu (Open • Link • Fork • Merge • Alias) - data model ready
- `aliases[]` and `merged_from[]` fields added to Node model
- Need frontend UI for interaction choices

### 2. Archive as Time-Capsule
**Status**: Rich Structure Implemented
- Auto-generated names: "2025-11-03 20:15 reflect • Evening decompression, Morning ritual +5 more"
- Type counts stored: `{ritual: 3, pattern: 2, thought: 5}`
- Nodes marked `archived: true` instead of deleted (soft archive)
- Archive includes: id, name, frequency, node_ids[], type_counts, tags[]

**Ready to Test**:
```
Create nodes → Archive → Check `/api/archives` endpoint
Archive shows name, counts, timestamp
```

**Next Step Seeded**:
- Partial restore endpoint active: `/api/nodes/restore-from-archive`
- 10s undo timer - need frontend implementation
- Thumbnail constellation - SVG generation seeded
- "Field feels dense" suggestion - coherence metrics logged

### 3. Data Model Extended
**Status**: Fields Added
```python
Node {
  # New fields
  aliases: List[str]
  parent_id: Optional[str]
  merged_from: List[str]
  variant_label: Optional[str]
  touched_at: str
  link_count: int
  archived: bool
}
```

**Lineage tracking ready** for fork/merge operations
**Metrics tracking active** for coherence analysis

### 4. Cross-Frequency Awareness
**Status**: Data Structure Ready
- Nodes can reference across frequencies
- Links structure supports `scope: "intra"|"cross"` (data ready)
- Need frontend rendering for cross-frequency tethers

### 5. Resonance Metrics Logging
**Status**: Active
```python
resonance_metrics {
  session_id, frequency_used,
  node_type_distribution,
  amplitude, coherence_signal,
  model_used, timestamp
}
```

Tracks: Frequency (type distribution), Amplitude (input length), Coherence (tone strength)

## 🌱 Seeded for Future

### Conversational Recovery
- Natural language intents detected: create, link, fork, merge, archive
- Need: Intent → action mapping in backend
- Need: "make project from this ritual" parser

### Offline Persistence
- Structure: pending_ops queue
- Need: IndexedDB implementation
- Need: Exponential backoff retry logic
- Need: Conflict resolution UI

### Clutter Detection
- Metrics: density, redundancy, staleness
- Calculation: avg links/node, fuzzy title clusters, last touch age
- Need: Threshold tuning + suggestion trigger

### Micro-History
- Event log structure: `{id, node_id, type, at, payload}`
- Events: CREATED, MERGED, TITLE_CHANGED, LINKED, ARCHIVED, RESTORED
- Need: Event recording on all mutations
- Need: Revert UI

### UI Flourishes
- Per-type motion tempos: ✅ Implemented (pulse, orbit, expand, seek, float)
- Duplicate interaction menu: Seeded
- Archive count badge: Seeded
- Cross-frequency breadcrumb: Seeded

## 🧪 Quick Ritual Tests

### Script A: De-dupe with Dignity
```
1. Create "Evening decompression" (Ritual)
2. Try "evening decompression!" again
   → Should warn: "Already exists as ritual"
3. Create "Evening decompression" (Project)
   → Should warn: "Exists as ritual, creating as project"
```

### Script B: Archive + Partial Restore
```
1. Create 10 mixed nodes
2. Click Archive (📦) button
   → Gets name like "2025-11-03 20:30 reflect • Title 1, Title 2 +8 more"
3. Call GET /api/archives
   → See archive with type_counts: {pattern: 3, thought: 7}
4. Call POST /api/nodes/restore-from-archive
   → Restore specific node_ids
```

### Script C: Motion as Meaning
```
1. Create nodes of each type
2. Wait 15 seconds (idle)
3. Watch:
   - 🕯️ Rituals pulse
   - 🔄 Patterns orbit
   - 🎯 Projects expand outward
   - ❓ Questions seek
   - 💭 Thoughts float
```

## 📊 Data Ready for Analysis

### Resonance Queries
```javascript
// Which types do I create most?
db.resonance_metrics.aggregate([
  {$match: {user_id: "..."}},
  {$group: {_id: "$node_type_distribution.pattern", count: {$sum: 1}}}
])

// When is my coherence highest?
db.resonance_metrics.find({coherence_signal: {$gt: 0.7}})

// Hermes vs GPT preference patterns
db.patterns.aggregate([
  {$match: {user_id: "..."}},
  {$group: {_id: "$model", count: {$sum: 1}}}
])
```

## 🔮 Next Wave Implementation

**Priority 1**: Duplicate interaction menu (frontend)
**Priority 2**: Archive undo timer (frontend)
**Priority 3**: Partial restore UI
**Priority 4**: Cross-frequency link rendering
**Priority 5**: Offline queue (IndexedDB)

---

*Foundation laid. Rituals ready for testing. Nervous system tuning.*
