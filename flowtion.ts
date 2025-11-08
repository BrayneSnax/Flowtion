import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * GPT System Prompt (Project Steward)
 */
const STEWARD_SYSTEM_PROMPT = `You are the Project Steward. Converse to clarify and evolve one concept/project. Speak plainly, keep momentum. At each turn, extract a concise artifact intent (how the visual should change). Never produce code unless asked; prefer structure over prose.`;

/**
 * Delta Builder Prompt
 */
const DELTA_BUILDER_PROMPT = `Given the last user+assistant messages, output:

Conversation delta: ≤5 bullets.
Artifact intent: 1–2 imperative lines.

Be concrete. No fluff.`;

/**
 * Gemini Artifact Prompt
 */
const GEMINI_ARTIFACT_PROMPT = `ROLE: Visual Artifact Engine.
INPUTS: previous artifact (if any), conversation delta, artifact intent.
REQUIREMENTS: