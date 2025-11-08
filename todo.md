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
