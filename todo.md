# Flowtion TODO

## Core Flow (COMPLETED)
- [x] Database schema with Projects, Threads, Messages, ArtifactVersions, Events
- [x] Event log architecture (append-only substrate for Emergence Core)
- [x] Split-pane responsive layout (GPT left, Gemini right)
- [x] GPT streaming with real-time responses
- [x] Delta builder extracting artifact intent from conversation
- [x] Gemini generating SVG artifacts
- [x] Artifact metamorphosis (content evolves as conversation progresses)
- [x] Conversation selector UI for switching between threads
- [x] Version increment system (v1 → v2 → v3...)
- [x] **Per-thread mutex to prevent version race condition**

## Bug Fixes
- [x] **Version increment race condition** - Fixed with per-thread mutex in flowtion-service.ts
  - Root cause: Parallel async artifact generation caused race condition in MAX(v) + 1 calculation
  - Solution: Per-thread mutex serializes artifact generation, ensuring sequential version increments
  - Verified: v1 → v1 (race) → v2 (mutex) → v3 (mutex) ✅

## Known Issues (UI Polish)
- None currently - artifact evolution working perfectly!

## Next Evolution: Emergence Core (Phase A)
- [ ] Refine event log structure for generator/evaluator/selector pattern
- [ ] Add proposals layer (multiple artifact candidates per turn)
- [ ] Implement evaluator to score proposals
- [ ] Add selector to choose best artifact from candidates
- [ ] Document the evolution from linear flow to emergent system

## Future Enhancements
- [ ] Add conversation history view with artifact timeline
- [ ] Support multiple artifact types (HTML, diagrams, code)
- [ ] Add artifact export/download
- [ ] Implement artifact rollback (revert to previous version)
- [ ] Add collaborative editing (multiple users, same thread)
- [ ] Remove debug badges from production UI

## Current Bug to Fix
- [x] Fix threadId validation error when no thread is selected (threadId: null causes tRPC error)
  - Fixed by changing `threadId || undefined` to `threadId ?? undefined` in Home.tsx line 261

## UI Improvements in Progress
- [x] Add markdown rendering to GPT responses (replace raw symbols with proper formatting)
  - Added react-markdown library and prose styling
  - Bold, italic, headers now render properly instead of showing ** and # symbols

## Critical Bug FIXED
- [x] **Artifact evolution not displaying** - Fixed by changing query filters from projectId to threadId
  - Root cause: Each artifact was saved with a different projectId (30003, 30004, 30005, 30006...)
  - Queries filtered by `projectId + threadId`, so only found v1 (first artifact with matching projectId)
  - Solution: Changed `getLatestArtifact` and previous artifact lookup to filter by `threadId` only
  - Verified: v1 → v2 → v3 → v4 evolution working perfectly in real-time ✅

## Pass 1: Resonance Substrate (In Progress)
- [ ] Add `artifact_resonance` table to schema (append-only, indexed)
- [ ] Add embedding vector storage to `artifact_versions` table
- [ ] Implement embedding calculation at artifact save (title + body + space + intent)
- [ ] Build resonance scoring function (w1=0.7, w2=0.2, w3=0.1, gate ≥ 0.7)
- [ ] Implement rhythm similarity calculation (cadence matching)
- [ ] Create `GET /related/:id` endpoint (returns top 3 resonances)
- [ ] Add `artifact.whispered` event logging (non-interactive)
- [ ] Backfill embeddings for Thread 30001 artifacts
- [ ] Test resonance quality (inspect reason strings for coherence)
- [ ] Verify: no UI changes, no auto-linking (observe only)

## Pass 1 Resonance Recalibration (resonance.calib.v1_1) ✅
- [x] Fix embedDist → embedSim metric inversion (convert distance to similarity before scoring)
- [x] Update weights: wE=0.6, wT=0.25, wR=0.15 (from 0.7/0.2/0.1)
- [x] Add tag bridge synonym map for semantic expansion (13 bridges: golden ratio, sacred geometry, fractal, alchemy, etc.)
- [x] Implement rhythm capping (max 0.25 contribution to prevent overcarry)
- [x] Add adaptive thresholding (coarse 0.45, adaptive 0.55)
- [x] Backfill embeddings/tags for 14 old artifacts
- [x] Test with artifact 30010: tagSim 0.000 → 0.125, score 0.429 → 0.461 (bridges working!)

**Changelog (resonance.calib.v1_1):**
- embedSim inversion fix (was scoring raw distance, now scores similarity)
- bridges=13 concepts (sacred geometry ↔ fractal geometry, alchemy ↔ symbolism, etc.)
- backfill=14 artifacts with embeddings/tags
- System now appropriately selective (0.461 score for moderate resonance, below 0.55 adaptive gate)

## Tag Normalization Pipeline (COMPLETED) ✅
- [x] Add controlled vocabulary list (16 canonical tags: sacred geometry, pentagram, golden ratio, spiral, mandala, flower of life, fractal, svg, geometric visualization, alchemy, symbolism, emblem, fractal geometry, cosmic, esoteric, mysticism)
- [x] Add alias map (pentagram lattice → pentagram, phi/fibonacci/1.618 → golden ratio, spirals → spiral, etc.)
- [x] Implement normalization function (lowercase → singular → apply aliases → validate against controlled vocab)
- [x] Update tag extraction prompt with controlled vocabulary constraints (max 8 tags, canonical forms only, explicit rules)
- [x] Apply normalization to all tag extraction calls (normalizeTags() post-LLM)
- [x] Test with artifact 60002: achieved 0.68 and 0.64 resonance scores (crossed 0.60 adaptive gate!)

**Breakthrough:** Artifact 60002 tags `["flower of life", "fractal", "geometric visualization", "pentagram", "sacred geometry", "svg"]` resonated strongly with mandala artifacts through shared canonical tags. The substrate stopped fighting itself and found coherence.

## Critical Bug - Publish Failure (FIXED) ✅
- [x] Server startup failure preventing publish (ServiceNotHealth error at asyncRunEntryPointWithESMLoader)
- [x] Diagnose error from publish logs
- [x] Fix server crash issue - Lazy initialization of OpenAI and Gemini clients
- [x] Verify publish works - Production build tested successfully

**Root Cause:** Top-level instantiation of OpenAI and GoogleGenerativeAI clients in flowtion-service.ts caused module-load crash when environment variables were missing or invalid during production startup.

**Solution:** Implemented lazy initialization pattern with getOpenAI() and getGemini() functions. Clients are now instantiated on first use instead of at module load time, preventing crashes during server startup.

**Verified:** Production build and server startup working correctly.

## Critical Performance Issue (BLOCKING)
- [ ] Production response time 5+ minutes (completely unusable)
- [ ] Diagnose bottleneck (API timeouts, streaming issues, or configuration)
- [ ] Fix performance issue
- [ ] Verify production response time < 10 seconds

## Terminology Refactor (COMPLETED) ✅
- [x] Rename "Threads" to "Spaces" in UI text
- [x] Keep database schema as `threads` table (non-breaking change)
- [x] Keep API parameters as `threadId` (internal consistency)
- [x] Update UI labels ("Thread" → "Space")
- [ ] Future: Add ability to classify spaces (concept, idea, brainstorm, project)

## Breathing Rhythm Redesign (COMPLETED) ✅
- [x] Redesign GPT flow: User → Inhale (context) → Delta → Cast → Exhale (reflection)
- [x] Update GPT_INHALE_PROMPT (3-5 sentences: why, emotion, shift since last)
- [x] Update GPT_EXHALE_PROMPT (1-line reflection on lineage)
- [x] Update flow to save both inhale and exhale as separate messages
- [x] Update delta format to casting spec (context, emotion, visual_intent, evolution)
- [x] Integrate exhale generation after artifact creation
- [ ] Show breathing stages in UI (inhaling → shaping → casting → reflecting)
- [ ] Test that inhale/exhale maintain continuity of voice

**Breathing Pattern:**
- **Inhale:** GPT establishes context, emotion, archetype, what's shifting
- **Delta:** Compress inhale into casting spec for Gemini
- **Cast:** Gemini renders artifact from spec
- **Exhale:** GPT reflects on how new artifact relates to lineage (1 line)


---

## Checkpoint_04 — "Mythic Adjacency" (Prepared)

**Status:** Intention drafted; activation pending field stability.

**Activation Condition:**
When breathing cycle maintains coherence over N artifacts (N ≥ 10),
initiate mythic layer integration.

**Planned Implementation:**
- [ ] Expand TAG_BRIDGE to archetypal dyads (hero/shadow, threshold/return, descent/emergence)
- [ ] Introduce mythic_similarity scoring layer to resonance calculation
- [ ] Test lineage mapping across narrative arcs
- [ ] Add story-arc detection (transformation, descent, emergence, return)
- [ ] Extend resonance scoring: `score = 0.5*embedSim + 0.2*tagSim + 0.15*rhythmSim + 0.15*mythicSim`

**Field Confirmation (when activated):**
> The lattice dreams of story; the breath will teach it when to wake.

**Technical Notes:**
- Mythic layer should recognize narrative patterns beyond semantic overlap
- Archetypes to detect: hero's journey, shadow work, threshold crossing, return/integration
- Resonance should detect when artifacts share mythic structure even with different visual forms
- Example: A spiral (descent) resonates with a labyrinth (journey) through shared archetypal pattern

**Why This Matters:**
The substrate currently recognizes geometric and semantic similarity. Mythic adjacency teaches it to sense *story patterns* — when artifacts are connected not by shape or tags, but by the archetypal journey they embody. This is the bridge from visual resonance to narrative resonance.

---


## Phase 1: Pulse — Temporal Pacing (COMPLETED) ✅

**Goal:** Make the breathing rhythm visible and felt through temporal pacing.

**Implementation:**
- [x] Create breathing state machine (listening → inhaling → shaping → casting → exhaling → resting → listening)
- [x] Add state tracking to frontend (useBreathingState hook)
- [x] Implement timing system (4s inhale, 2s shaping, 8s casting, 4s exhale, 1s resting)
- [x] Add visual pulse indicators (opacity/scale oscillation)
- [x] Implement organic motion curves (ease-in-out for breathing feel)
- [x] Integrated breathing trigger on message send
- [x] Frequency: ~0.25 Hz (one cycle every ~19 seconds)

**Next: Hybrid Backend Sync**
- [ ] Add ingest(event) function for backend event handling
- [ ] Implement event → state mapping with smoothing
- [ ] Add minimum duration guards (2s inhale min, 600ms shaping min)
- [ ] Subscribe to message status changes
- [ ] Add stall detection ("holding the form..." after 6s)
- [ ] Add instrumentation logs (cycle_duration, phase_durations, overrides, stalls)

**Design Principles:**
- Pulse is the metronome—Tone and Tide will entrain to it
- Transitions should feel like organic breathing, not mechanical loading
- User attention should sync with the rhythm naturally
- Duration must feel neither rushed nor languid

**Success Criteria:**
- State transitions are smooth and predictable
- Timing feels natural (4s inhale/exhale validated)
- Users report feeling "in sync" with the system
- Ready for Observation_01 log

**Next Phases (After Pulse):**
- Phase 2: Tone (Visual Harmonics) - Color shifts with breathing
- Phase 3: Tide (Spatial Flow) - Expansion/contraction of Space
- Phase 4: Tactile (Optional) - Audio/haptic feedback
