import { COOKIE_NAME } from "@shared/const";

// Mutex for serializing artifact generation per thread
const artifactGenerationLocks = new Map<number, Promise<void>>();
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  logEvent,
  loadMessages,
  streamGPTReply,
  buildDelta,
  generateArtifactWithGemini,
  generateExhale,
} from "./flowtion-service";
import { getDb } from "./db";
import { projects, threads, messages, messageChunks, artifactVersions } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  flowtion: router({
    // Send message and trigger full flow: GPT → Delta → Gemini
    send: publicProcedure
      .input(z.object({
        projectId: z.number().optional(),
        threadId: z.number().optional(),
        text: z.string(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error("Database not available");
        
        // Create or get project
        let projectId = input.projectId;
        if (!projectId) {
          const [newProject] = await db.insert(projects).values({
            name: "Untitled Project",
            userId: 1, // TODO: Get from ctx.user when auth is required
          }).$returningId();
          projectId = newProject.id;
        }
        
        // Create or get thread
        let threadId = input.threadId;
        if (!threadId) {
          const [newThread] = await db.insert(threads).values({
            projectId,
          }).$returningId();
          threadId = newThread.id;
        }
        
        // Log user message event
        await logEvent(projectId, threadId, "user.msg", { text: input.text });
        
        // Save user message
        await db.insert(messages).values({
          threadId,
          role: "user",
          text: input.text,
        });
        
        // Load message history
        const messageHistory = await loadMessages(threadId);
        
        // Start async flow (don't await - return immediately)
        (async () => {
          try {
            console.log("[Flowtion] Starting GPT stream for thread", threadId);
            
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
            
            // Enqueue Gemini render
            await logEvent(projectId, threadId, "render.enqueued", { 
              emotion: delta.emotion,
              visual_intent: delta.visual_intent 
            });
            
            // Get previous artifact if exists
            const prevArtifacts = await db
              .select()
              .from(artifactVersions)
              .where(eq(artifactVersions.threadId, threadId))
              .orderBy(desc(artifactVersions.v))
              .limit(1);
            
            const previousArtifact = prevArtifacts[0]?.uri || null;
            
            console.log("[Flowtion] Starting Gemini artifact generation");
            
            // Wait for any existing generation to complete (mutex)
            const existingLock = artifactGenerationLocks.get(threadId);
            if (existingLock) {
              console.log("[Flowtion] Waiting for previous artifact generation to complete...");
              await existingLock;
            }
            
            // Create new lock for this generation
            const generationPromise = (async () => {
              const result = await generateArtifactWithGemini(projectId, threadId, delta, previousArtifact);
              
              // Generate exhale - reflection on lineage
              console.log("[Flowtion] Generating exhale reflection...");
              const exhale = await generateExhale(
                projectId, 
                threadId, 
                result.summary,
                result.version - 1
              );
              console.log("[Flowtion] Exhale:", exhale);
            })();
            
            artifactGenerationLocks.set(threadId, generationPromise);
            
            // Generate artifact + exhale
            await generationPromise;
            
            // Clean up lock
            artifactGenerationLocks.delete(threadId);
            
            console.log("[Flowtion] Breathing cycle complete (inhale → delta → cast → exhale)");
          } catch (error) {
            console.error("[Flowtion] Error in GPT → Delta → Gemini flow:", error);
            await logEvent(projectId, threadId, "flow.error", { error: String(error) });
          }
        })();
        
        return { projectId, threadId, status: "rendering" as const };
      }),
    
    // Get thread messages
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
    
    // Get message chunks for streaming display
    getMessageChunks: publicProcedure
      .input(z.object({ messageId: z.number(), sinceSeq: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        
        const query = input.sinceSeq !== undefined
          ? db.select()
              .from(messageChunks)
              .where(and(
                eq(messageChunks.messageId, input.messageId),
                // @ts-ignore - drizzle typing issue with gt
                desc(messageChunks.seq)
              ))
              .orderBy(messageChunks.seq)
          : db.select()
              .from(messageChunks)
              .where(eq(messageChunks.messageId, input.messageId))
              .orderBy(messageChunks.seq);
        
        return await query;
      }),
    
    // List all threads with preview
    listThreads: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return [];
        
        // Get all threads with first message as preview
        const allThreads = await db.select().from(threads).orderBy(desc(threads.createdAt));
        
        const threadsWithPreview = await Promise.all(
          allThreads.map(async (thread) => {
            const firstMsg = await db
              .select()
              .from(messages)
              .where(eq(messages.threadId, thread.id))
              .orderBy(messages.createdAt)
              .limit(1);
            
            return {
              id: thread.id,
              projectId: thread.projectId,
              preview: firstMsg[0]?.text.substring(0, 60) + '...' || '(empty)'
            };
          })
        );
        
        return threadsWithPreview;
      }),
    
    // Get latest artifact
    getLatestArtifact: publicProcedure
      .input(z.object({ projectId: z.number(), threadId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        
        // Query by threadId only (projectId varies per artifact due to bug)
        const artifacts = input.threadId
          ? await db
              .select()
              .from(artifactVersions)
              .where(eq(artifactVersions.threadId, input.threadId))
              .orderBy(desc(artifactVersions.v))
              .limit(1)
          : await db
              .select()
              .from(artifactVersions)
              .where(eq(artifactVersions.projectId, input.projectId))
              .orderBy(desc(artifactVersions.v))
              .limit(1);
        
        const result = artifacts[0] || null;
        console.log('[getLatestArtifact] Query result:', {
          projectId: input.projectId,
          threadId: input.threadId,
          foundVersion: result?.v,
          foundId: result?.id
        });
        return result;
      }),
  }),

  // Resonance (Pass 1: Emergence Core)
  resonance: router({
    getRelated: publicProcedure
      .input(z.object({ artifactId: z.number() }))
      .query(async ({ input }) => {
        const { getRelated } = await import("./resonance-service");
        return await getRelated(input.artifactId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
