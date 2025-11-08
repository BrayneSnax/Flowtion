import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Flowtion Data Model

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  userId: int("userId").notNull(),
  activeThreadId: int("activeThreadId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const threads = mysqlTable("threads", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const messages = mysqlTable("messages", {
  id: int("id").autoincrement().primaryKey(),
  threadId: int("threadId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  text: text("text").notNull(),
  status: mysqlEnum("status", ["streaming", "shaping", "casting", "done", "error"]).default("done").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const messageChunks = mysqlTable("message_chunks", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  seq: int("seq").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const artifactVersions = mysqlTable("artifact_versions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  threadId: int("threadId").notNull(),
  v: int("v").notNull(),
  kind: mysqlEnum("kind", ["image", "svg", "html", "pdf"]).notNull(),
  uri: text("uri").notNull(),
  summary: text("summary").notNull(),
  delta: text("delta").notNull(),
  createdBy: varchar("createdBy", { length: 64 }).notNull().default("gemini"),
  embedding: text("embedding"),
  tags: text("tags"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const events = mysqlTable("events", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  threadId: int("threadId").notNull(),
  kind: varchar("kind", { length: 64 }).notNull(),
  payload: text("payload").notNull(),
  tags: text("tags"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const artifactResonance = mysqlTable("artifact_resonance", {
  id: int("id").autoincrement().primaryKey(),
  sourceId: int("sourceId").notNull(),
  targetId: int("targetId").notNull(),
  score: int("score").notNull(),
  embedDistance: int("embedDistance").notNull(),
  sharedTags: text("sharedTags").notNull(),
  rhythmSim: int("rhythmSim").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

export type Thread = typeof threads.$inferSelect;
export type InsertThread = typeof threads.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = typeof messages.$inferInsert;

export type MessageChunk = typeof messageChunks.$inferSelect;
export type InsertMessageChunk = typeof messageChunks.$inferInsert;

export type ArtifactVersion = typeof artifactVersions.$inferSelect;
export type InsertArtifactVersion = typeof artifactVersions.$inferInsert;

export type Event = typeof events.$inferSelect;
export type InsertEvent = typeof events.$inferInsert;

export type ArtifactResonance = typeof artifactResonance.$inferSelect;
export type InsertArtifactResonance = typeof artifactResonance.$inferInsert;