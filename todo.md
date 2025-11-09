# Flowtion Migration TODO

## Phase 1: Database Schema Migration
- [x] Copy schema from /home/ubuntu/Flowtion/schema.ts
- [x] Add projects, threads, messages, artifactVersions, events tables
- [x] Add artifactResonance table for resonance system
- [x] Run pnpm db:push to apply schema

## Phase 2: Backend Services Migration
- [x] Copy flowtion-service.ts (breathing cycle, GPT/Gemini integration)
- [x] Copy resonance-service.ts (embedding, tag extraction, scoring)
- [x] Copy ai.ts helper functions
- [x] Create tRPC routers for Flowtion features
- [x] Set up API key requirements (OPENAI_API_KEY, GEMINI_API_KEY)

## Phase 3: Frontend Components Migration
- [x] Copy useBreathingState.ts hook
- [x] Copy BreathingIndicator.tsx component
- [x] Create main Flowtion workspace UI
- [x] Create artifact renderer component
- [x] Create conversation panel
- [x] Set up split-pane layout

## Phase 4: Integration & Testing
- [ ] Test breathing cycle functionality
- [ ] Test artifact generation (GPT → Gemini)
- [ ] Test resonance detection
- [ ] Verify database operations
- [ ] Create checkpoint

## Phase 5: Polish & Deploy
- [ ] Update branding and theme
- [ ] Add documentation
- [ ] Final testing
- [ ] Deploy


## Debugging & Fixes
- [x] Identify cause of tRPC 400 error (auth issue with protectedProcedure)
- [x] Fix API initialization issue (changed to publicProcedure, simplified router)
- [x] Test project/thread creation (working! UI loads correctly)
- [ ] Test full breathing cycle with message (getting 500 error)
- [ ] Verify API keys are provided (OPENAI_API_KEY, GEMINI_API_KEY)
- [ ] Debug breathing cycle failure


## Supabase Integration
- [x] Install Supabase client libraries
- [x] Request SUPABASE_URL and SUPABASE_ANON_KEY from user
- [ ] Create Supabase schema with pgvector extension
- [ ] Migrate tables (projects, threads, messages, artifacts, resonance)
- [ ] Set up Row Level Security policies
- [ ] Create storage bucket for artifacts
- [ ] Update backend to use Supabase client instead of Drizzle
- [ ] Add real-time subscriptions for messages
- [ ] Add real-time subscriptions for artifacts
- [ ] Update resonance service to use pgvector for embeddings
- [ ] Test full breathing cycle with Supabase
- [ ] Verify real-time updates work


## Breathing Cycle State Machine Verification
- [x] Confirm Supabase schema is applied (tables + pgvector)
- [x] Update flowtion-router to use Supabase client
- [x] Implement proper state machine with distinct phases
- [x] Add timing for each phase (Inhale: 4s, Shaping: 2s, Cast: 8s, Exhale: 4s)
- [x] Log each phase transition to events table
- [x] Update message status at each phase
- [ ] Add real-time subscriptions for messages
- [ ] Add real-time subscriptions for artifacts
- [ ] Test complete breathing cycle end-to-end
- [ ] Verify events are logged in Supabase
- [ ] Test resonance detection between artifacts
- [ ] Verify pgvector similarity search works


## Breathing Cycle Testing
- [ ] Send test prompt: "Generate a haiku about ephemeral art"
- [ ] Monitor console logs for phase transitions
- [ ] Verify timing: Inhale (4s), Shaping (2s), Cast (8s), Exhale (4s)
- [ ] Check Supabase events table for logged transitions
- [ ] Verify artifact is created and saved
- [ ] Check if resonance detection runs
- [ ] Verify message status updates (streaming → done)


## Real-time Subscriptions
- [x] Add Supabase client to frontend
- [x] Subscribe to artifact_versions inserts for current thread
- [x] Update artifact state when new artifacts are created
- [ ] Test that artifacts appear automatically after breathing cycle
- [ ] Verify SVG rendering works correctly


## Steward of Motion + Morphic Artisan Refinements
- [x] Update GPT system prompt to Steward of Motion pattern (3-6 lines, concrete language)
- [x] Add structured output: {concept_summary}, {visual_intent}, {structure_hint}
- [x] Update Gemini prompt to Morphic Artisan pattern
- [ ] Implement embedding similarity comparison for artifacts
- [ ] Add artifact merging logic (threshold-based)
- [ ] Track lineage as delta chains (not full clones)
- [ ] Add "parent_id" field to artifacts for lineage
- [ ] Update UI to show evolution history
- [ ] Add smart casting logic (only when concept meaningfully changes)
- [ ] Implement text-only breath option (skip Gemini when delta is small)
- [ ] Add graceful fallback when Gemini fails
- [ ] Test full system with multiple messages
- [ ] Verify artifact merging works correctly
- [ ] Verify cost controls are effective


## Breathing Cycle Philosophy Refinement
- [ ] Update GPT Inhale prompt to "absorb context, synthesize what's emerging"
- [ ] Update Delta extraction to "detect change, field is refining toward..."
- [ ] Update Cast to "express form as design brief for Gemini"
- [ ] Update Exhale to "integrate lineage, this evolves from..."
- [ ] Change output format to {concept_summary, change_summary, next_manifestation_hint}
- [ ] Test full breathing cycle with example input
- [ ] Verify 3-6 line limit is enforced
- [ ] Verify product/design language (not poetic metaphor)
