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
