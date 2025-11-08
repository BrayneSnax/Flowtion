import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { projects, threads, messages, artifactVersions, events } from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { streamGPTReply, buildDelta, generateArtifactWithGemini, generateExhale, loadMessages, logEvent } from "./flowtion-service";

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
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      
      // Create or get project
      let projectId = input.projectId;
      if (!projectId) {
        console.log('[Flowtion] Creating new project');
        const result = await db.insert(projects).values({
          name: "Untitled Project",
          userId: 1,
        });
        projectId = Number((result as any).insertId);
        console.log('[Flowtion] Created project:', projectId);
      }
      
      // Create or get thread
      let threadId = input.threadId;
      if (!threadId) {
        console.log('[Flowtion] Creating new thread');
        const result = await db.insert(threads).values({
          projectId,
        });
        threadId = Number((result as any).insertId);
        console.log('[Flowtion] Created thread:', threadId);
      }
      
      // Log user message event
      await logEvent(projectId, threadId, "user.msg", { text: input.text });
      
      // Save user message
      const msgResult = await db.insert(messages).values({
        threadId,
        role: "user",
        text: input.text,
      });
      
      console.log('[Flowtion] User message saved, starting async breathing cycle');
      
      // Start async breathing cycle (don't await - return immediately)
      (async () => {
        try {
          console.log("[Flowtion] Starting GPT stream for thread", threadId);
          
          // Load message history
          const messageHistory = await loadMessages(threadId);
          
          // Stream GPT response
          const { messageId, fullResponse } = await streamGPTReply(projectId, threadId, messageHistory, (chunk) => {
            // Chunks are logged internally
          });
          
          console.log("[Flowtion] GPT response complete, building delta");
          
          // Update message status to shaping
          let db = await getDb();
          if (!db) throw new Error("Database not available");
          
          await db.update(messages)
            .set({ status: "shaping", updatedAt: new Date() })
            .where(eq(messages.id, messageId));
          
          // Build delta from inhale
          const delta = await buildDelta(fullResponse);
          await logEvent(projectId, threadId, "delta.created", delta);
          
          console.log("[Flowtion] Delta created:", delta);
          
          // Update message status to casting
          await db.update(messages)
            .set({ status: "casting", updatedAt: new Date() })
            .where(eq(messages.id, messageId));
          
          // Get previous artifact if exists
          const prevArtifacts = await db
            .select()
            .from(artifactVersions)
            .where(eq(artifactVersions.threadId, threadId))
            .orderBy(desc(artifactVersions.v))
            .limit(1);
          
          const prevArtifact = prevArtifacts.length > 0 ? prevArtifacts[0] : null;
          
          // Generate artifact with Gemini
          console.log("[Flowtion] Generating artifact with Gemini");
          const artifactData = await generateArtifactWithGemini(
            projectId,
            threadId,
            delta,
            prevArtifact?.uri ?? null
          );
          
          console.log("[Flowtion] Artifact generated, creating exhale");
          
          // Update message status to done (skip exhaling for now)
          // await db.update(messages)
          //   .set({ status: "exhaling", updatedAt: new Date() })
          //   .where(eq(messages.id, messageId));
          
          // Generate exhale (GPT reflects on the artifact)
          const prevArtifactCount = prevArtifacts.length;
          await generateExhale(projectId, threadId, artifactData.summary, prevArtifactCount);
          
          // Mark message as done
          await db.update(messages)
            .set({ status: "done", updatedAt: new Date() })
            .where(eq(messages.id, messageId));
          
          console.log("[Flowtion] Breathing cycle complete for thread", threadId);
        } catch (error) {
          console.error("[Flowtion] Breathing cycle failed:", error);
          // Mark message as failed
          const db = await getDb();
          if (db) {
            await db.update(messages)
              .set({ status: "error", updatedAt: new Date() })
              .where(eq(messages.threadId, threadId))
              .orderBy(desc(messages.createdAt))
              .limit(1);
          }
        }
      })();
      
      // Return immediately
      return { projectId, threadId };
    }),

  // Get messages for a thread
  getMessages: publicProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      
      return await db
        .select()
        .from(messages)
        .where(eq(messages.threadId, input.threadId))
        .orderBy(messages.createdAt);
    }),

  // Get latest artifact for a thread
  getLatestArtifact: publicProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      
      const artifacts = await db
        .select()
        .from(artifactVersions)
        .where(eq(artifactVersions.threadId, input.threadId))
        .orderBy(desc(artifactVersions.v))
        .limit(1);
      
      return artifacts.length > 0 ? artifacts[0] : null;
    }),

  // List all threads (for conversation selector)
  listThreads: publicProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return [];
      
      // Get all threads with their latest message
      const allThreads = await db
        .select()
        .from(threads)
        .orderBy(desc(threads.createdAt))
        .limit(50);
      
      return allThreads;
    }),
});
