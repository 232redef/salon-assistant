import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ollama } from "ai-sdk-ollama";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная ${name} в web/.env.local`);
  }
  return value;
}

export function chatModel() {
  if (process.env.LLM_PROVIDER === "openai-compatible") {
    const provider = createOpenAICompatible({
      name: "llm",
      baseURL: requireEnv("LLM_BASE_URL"),
      apiKey: requireEnv("LLM_API_KEY"),
    });
    return provider.chatModel(requireEnv("LLM_MODEL"));
  }
  return ollama(process.env.LLM_MODEL ?? "qwen3:4b-instruct");
}
