import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { supabase } from "./supabase";
import { streamGPTReply, buildDelta, generateArtifactWithGemini, generateExhale, loadMessagesFromSupabase, logEventToSupabase } from "./flowtion-service";

export const flowtionRouter = router({
  // Main send procedure - creates project/thread if needed, then processes message
  send: publicProcedure
    .input(z.object({
      projectId: z.number().optional(),
      threadId: z.number().optional(),
      text: z.string(),
    }))
    .mutation(async ({ input }) => {
      console.log('[Flowtion] send called:', input);
      
      // Create or get project
      let projectId = input.projectId;
      if (!projectId) {
        console.log('[Flowtion] Creating new project');
        const { data, error } = await supabase
          .from('projects')
          .insert({ name: "Untitled Project", user_id: 1 })
          .select()
          .single();
        
        if (error) throw new Error(`Failed to create project: ${error.message}`);
        projectId = data.id;
        console.log('[Flowtion] Created project:', projectId);
      }
      
      // Create or get thread
      let threadId = input.threadId;
      if (!threadId) {
        console.log('[Flowtion] Creating new thread');
        const { data, error } = await supabase
          .from('threads')
          .insert({ project_id: projectId })
          .select()
          .single();
        
        if (error) throw new Error(`Failed to create thread: ${error.message}`);
        threadId = data.id;
        console.log('[Flowtion] Created thread:', threadId);
      }
      
      // Capture final IDs for async block
      const finalProjectId = projectId as number;
      const finalThreadId = threadId as number;
      
      // Log user message event
      await logEventToSupabase(finalProjectId, finalThreadId, "user.msg", { text: input.text });
      
      // Save user message
      const { data: userMsg, error: msgError } = await supabase
        .from('messages')
        .insert({
          thread_id: threadId,
          role: "user",
          text: input.text,
        })
        .select()
        .single();
      
      if (msgError) throw new Error(`Failed to save message: ${msgError.message}`);
      
      console.log('[Flowtion] User message saved, starting async breathing cycle');
      
      // Start async breathing cycle (don't await - return immediately)
      (async () => {
        try {
          console.log("[Flowtion] === BREATHING CYCLE START ===");
          console.log("[Flowtion] Thread:", finalThreadId);
          
          // PHASE 1: INHALE (4 seconds) - GPT establishes context
          console.log("[Flowtion] PHASE 1: INHALE - GPT establishing context");
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.inhale.start", {});
          
          const messageHistory = await loadMessagesFromSupabase(finalThreadId);
          
          const { messageId, fullResponse } = await streamGPTReply(
            finalProjectId,
            finalThreadId,
            messageHistory,
            (chunk) => console.log('[Inhale chunk]', chunk)
          );
          
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.inhale.complete", { 
            messageId,
            responseLength: fullResponse.length 
          });
          console.log("[Flowtion] INHALE complete");
          
          // Artificial 4s delay for inhale phase
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          // PHASE 2: SHAPING (2 seconds) - Extract delta
          console.log("[Flowtion] PHASE 2: SHAPING - Extracting delta");
          await supabase
            .from('messages')
            .update({ status: 'shaping', updated_at: new Date().toISOString() })
            .eq('id', messageId);
          
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.shaping.start", {});
          
          const delta = await buildDelta(fullResponse);
          
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.shaping.complete", delta);
          console.log("[Flowtion] SHAPING complete:", delta);
          
          // Artificial 2s delay for shaping phase
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // PHASE 3: CASTING (8 seconds) - Gemini generates artifact
          console.log("[Flowtion] PHASE 3: CASTING - Gemini generating artifact");
          await supabase
            .from('messages')
            .update({ status: 'casting', updated_at: new Date().toISOString() })
            .eq('id', messageId);
          
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.casting.start", {
            concept_summary: delta.concept_summary,
            change_summary: delta.change_summary,
            next_manifestation_hint: delta.next_manifestation_hint
          });
          
          // Get previous artifact if exists
          const { data: prevArtifacts } = await supabase
            .from('artifact_versions')
            .select('*')
            .eq('thread_id', finalThreadId)
            .order('v', { ascending: false })
            .limit(1);
          
          const prevArtifact = prevArtifacts && prevArtifacts.length > 0 ? prevArtifacts[0] : null;
          
          const artifactData = await generateArtifactWithGemini(
            finalProjectId,
            finalThreadId,
            delta,
            prevArtifact?.uri ?? null
          );
          
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.casting.complete", {
            version: artifactData.version,
            summary: artifactData.summary
          });
          console.log("[Flowtion] CASTING complete");
          
          // Artificial 8s delay for casting phase
          await new Promise(resolve => setTimeout(resolve, 8000));
          
          // PHASE 4: EXHALE (4 seconds) - GPT reflects on lineage
          console.log("[Flowtion] PHASE 4: EXHALE - GPT reflecting on lineage");
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.exhale.start", {});
          
          const prevArtifactCount = (prevArtifacts && prevArtifacts.length > 0) ? prevArtifacts.length : 0;
          await generateExhale(finalProjectId, finalThreadId, artifactData.summary, prevArtifactCount);
          
          await logEventToSupabase(finalProjectId, finalThreadId, "phase.exhale.complete", {});
          console.log("[Flowtion] EXHALE complete");
          
          // Artificial 4s delay for exhale phase
          await new Promise(resolve => setTimeout(resolve, 4000));
          
          // Mark message as done
          await supabase
            .from('messages')
            .update({ status: 'done', updated_at: new Date().toISOString() })
            .eq('id', messageId);
          
          await logEventToSupabase(finalProjectId, finalThreadId, "breathing.cycle.complete", {
            totalPhases: 4,
            duration: "~19 seconds"
          });
          
          console.log("[Flowtion] === BREATHING CYCLE COMPLETE ===");
        } catch (error) {
          console.error("[Flowtion] Breathing cycle failed:", error);
          await logEventToSupabase(finalProjectId, finalThreadId, "breathing.cycle.error", {
            error: error instanceof Error ? error.message : String(error)
          });
          
          // Mark message as error
          await supabase
            .from('messages')
            .update({ status: 'error', updated_at: new Date().toISOString() })
            .eq('thread_id', finalThreadId)
            .order('created_at', { ascending: false })
            .limit(1);
        }
      })();
      
      // Return immediately
      return { projectId, threadId };
    }),

  // Get messages for a thread
  getMessages: publicProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', input.threadId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[Flowtion] Error fetching messages:', error);
        return [];
      }
      
      return data || [];
    }),

  // Get latest artifact for a thread
  getLatestArtifact: publicProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('artifact_versions')
        .select('*')
        .eq('thread_id', input.threadId)
        .order('v', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('[Flowtion] Error fetching artifact:', error);
      }
      
      return data || null;
    }),

  // List all threads (for conversation selector)
  listThreads: publicProcedure
    .query(async () => {
      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('[Flowtion] Error fetching threads:', error);
        return [];
      }
      
      return data || [];
    }),

  // Get events for a thread (for debugging breathing cycle)
  getEvents: publicProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('thread_id', input.threadId)
        .order('created_at', { ascending: true });
      
      if (error) {
        console.error('[Flowtion] Error fetching events:', error);
        return [];
      }
      
      return data || [];
    }),
});
