import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { chatWithGPT, generateArtifact, streamGPTResponse, type ConversationMessage } from "./ai";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Chat with GPT endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body as { messages: ConversationMessage[] };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      const response = await chatWithGPT(messages);
      const assistantMessage = response.choices[0]?.message?.content;

      res.json({ 
        message: assistantMessage,
        shouldGenerateArtifact: true // Always trigger Gemini
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to process chat" });
    }
  });

  // Stream GPT response endpoint
  app.post("/api/chat/stream", async (req, res) => {
    try {
      const { messages } = req.body as { messages: ConversationMessage[] };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages format" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of streamGPTResponse(messages)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Stream error:", error);
      res.status(500).json({ error: "Failed to stream chat" });
    }
  });

  // Generate artifact with Gemini endpoint
  app.post("/api/artifact", async (req, res) => {
    try {
      const { description, previousArtifact, conversationContext } = req.body;

      if (!description || !conversationContext) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await generateArtifact({
        description,
        previousArtifact,
        conversationContext,
      });

      res.json(result);
    } catch (error) {
      console.error("Artifact generation error:", error);
      res.status(500).json({ error: "Failed to generate artifact" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
