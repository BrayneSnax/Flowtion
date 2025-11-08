import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ArtifactRequest {
  description: string;
  previousArtifact?: string;
  conversationContext: string;
}

/**
 * GPT conversation - the primary dialogue partner
 */
export async function chatWithGPT(
  messages: ConversationMessage[],
  stream: boolean = false
) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: 0.7,
      stream,
    });

    return response;
  } catch (error) {
    console.error("GPT API error:", error);
    throw new Error("Failed to get response from GPT");
  }
}

/**
 * Gemini artifact generation - creates/updates visualizations
 */
export async function generateArtifact(request: ArtifactRequest) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = buildArtifactPrompt(request);
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    return {
      artifact: text,
      type: detectArtifactType(text),
    };
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error("Failed to generate artifact with Gemini");
  }
}

/**
 * Build prompt for Gemini artifact generation
 */
function buildArtifactPrompt(request: ArtifactRequest): string {
  const { description, previousArtifact, conversationContext } = request;

  let prompt = `You are an artifact creator. Based on the conversation context, create a visual representation (diagram, graph, or structured visualization).

Conversation context:
${conversationContext}

Current request: ${description}

`;

  if (previousArtifact) {
    prompt += `Previous artifact (evolve this):
${previousArtifact}

`;
  }

  prompt += `Create a Mermaid diagram, D2 diagram, or structured markdown that visualizes the concept being discussed. 

Output ONLY the diagram code, nothing else. Start with the diagram type (mermaid/d2/markdown).`;

  return prompt;
}

/**
 * Detect artifact type from content
 */
function detectArtifactType(content: string): "mermaid" | "d2" | "markdown" | "text" {
  const trimmed = content.trim().toLowerCase();
  
  if (trimmed.startsWith("mermaid") || trimmed.includes("```mermaid")) {
    return "mermaid";
  }
  if (trimmed.startsWith("d2") || trimmed.includes("```d2")) {
    return "d2";
  }
  if (trimmed.includes("```") || trimmed.includes("#")) {
    return "markdown";
  }
  
  return "text";
}

/**
 * Streaming GPT response for real-time conversation
 */
export async function* streamGPTResponse(messages: ConversationMessage[]) {
  const stream = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    })),
    temperature: 0.7,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      yield content;
    }
  }
}
