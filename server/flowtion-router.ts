import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { projects, threads, messages, artifactVersions } from "../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { processUserMessage } from "./flowtion-service";

export const flowtionRouter = router({
  // Get all projects for current user
  listProjects: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    
    return await db
      .select()
      .from(projects)
      .where(eq(projects.userId, ctx.user.id))
      .orderBy(desc(projects.createdAt));
  }),

  // Create new project
  createProject: protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(projects).values({
        name: input.name,
        userId: ctx.user.id,
      });

      return { id: Number((result as any).insertId) };
    }),

  // Get threads for a project
  listThreads: protectedProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return await db
        .select()
        .from(threads)
        .where(eq(threads.projectId, input.projectId))
        .orderBy(desc(threads.createdAt));
    }),

  // Create new thread
  createThread: protectedProcedure
    .input(z.object({ projectId: z.number(), title: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const result = await db.insert(threads).values({
        projectId: input.projectId,
        title: input.title || "New Space",
      });

      return { id: Number((result as any).insertId) };
    }),

  // Get messages for a thread
  listMessages: protectedProcedure
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

  // Send user message and trigger breathing cycle
  sendMessage: protectedProcedure
    .input(z.object({
      projectId: z.number(),
      threadId: z.number(),
      text: z.string(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Insert user message
      const result = await db.insert(messages).values({
        threadId: input.threadId,
        role: "user",
        text: input.text,
        status: "done",
      });

      const messageId = Number((result as any).insertId);

      // Process message through breathing cycle (async)
      processUserMessage(input.projectId, input.threadId, input.text).catch((err: unknown) => {
        console.error("[Flowtion Router] Message processing failed:", err);
      });

      return { messageId };
    }),

  // Get artifacts for a thread
  listArtifacts: protectedProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      return await db
        .select()
        .from(artifactVersions)
        .where(eq(artifactVersions.threadId, input.threadId))
        .orderBy(desc(artifactVersions.createdAt));
    }),

  // Get latest artifact for a thread
  getLatestArtifact: protectedProcedure
    .input(z.object({ threadId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const artifacts = await db
        .select()
        .from(artifactVersions)
        .where(eq(artifactVersions.threadId, input.threadId))
        .orderBy(desc(artifactVersions.createdAt))
        .limit(1);

      return artifacts.length > 0 ? artifacts[0] : null;
    }),
});
