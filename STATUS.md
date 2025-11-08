# Flowtion Migration Status

## Completed

### Phase 1: Database Schema ✅
- Migrated all tables: projects, threads, messages, messageChunks, artifactVersions, events, artifactResonance
- Schema pushed to database successfully
- All Drizzle types generated

### Phase 2: Backend Services ✅
- Copied flowtion-service.ts (breathing cycle implementation)
- Created complete resonance-service.ts (embeddings, tag extraction, resonance scoring)
- Copied ai.ts helper
- Created flowtion-router.ts with all tRPC procedures
- Integrated router into main routers.ts
- API keys configured (OPENAI_API_KEY, GEMINI_API_KEY)
- No TypeScript errors

### Phase 3: Frontend Components ✅
- Copied useBreathingState.ts hook
- Copied BreathingIndicator.tsx component
- Created Workspace.tsx with split-pane layout
- Conversation panel with message display
- Artifact panel with SVG/HTML rendering
- Input area with send functionality

## Current Issue

### API 400 Errors
The frontend is making tRPC calls but receiving 400 errors. The spinner shows indefinitely because the createProject mutation is failing.

**Possible causes:**
1. tRPC batch link configuration issue
2. SuperJSON transformer mismatch
3. Auth context not properly initialized
4. Database connection issue in protected procedures

**Next steps to debug:**
1. Check server logs for detailed error messages
2. Test API endpoints directly with curl/Postman
3. Verify database connection in getDb()
4. Check if protectedProcedure auth middleware is working
5. Test with publicProcedure to isolate auth vs data issues

## Architecture

### Backend
- **Framework**: Express + tRPC
- **Database**: MySQL/TiDB via Drizzle ORM
- **AI Services**: 
  - OpenAI GPT-4o (conversation, context)
  - Google Gemini (artifact generation)
  - OpenAI Embeddings (resonance system)

### Frontend
- **Framework**: React 19
- **Routing**: Wouter
- **State**: TanStack Query (React Query)
- **UI**: Tailwind CSS + shadcn/ui
- **Theme**: Dark mode

### Key Features Implemented
1. **Breathing Cycle**: Inhale (GPT context) → Delta (spec extraction) → Cast (Gemini artifact) → Exhale (GPT reflection)
2. **Resonance System**: Embedding-based similarity, tag overlap, rhythm detection
3. **Artifact Evolution**: Version tracking with delta descriptions
4. **Event Log**: Append-only audit trail

## Files Modified/Created

### Server
- `drizzle/schema.ts` - Database schema
- `server/flowtion-service.ts` - Main breathing cycle logic
- `server/resonance-service.ts` - Resonance computation
- `server/flowtion-router.ts` - tRPC API routes
- `server/routers.ts` - Router integration

### Client
- `client/src/pages/Workspace.tsx` - Main UI
- `client/src/hooks/useBreathingState.ts` - Breathing state management
- `client/src/components/BreathingIndicator.tsx` - Visual breathing indicator
- `client/src/App.tsx` - Route configuration

### Dependencies Added
- `@google/generative-ai` - Gemini SDK
