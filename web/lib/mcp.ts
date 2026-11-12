import "server-only";
import { createMCPClient } from "@ai-sdk/mcp";

function requireEnv(name: "MCP_URL" | "MCP_TOKEN"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Не задана переменная ${name} в web/.env.local`);
  }
  return value;
}

// Один клиент на один запрос: открыть, поработать, закрыть.
export async function openMcp() {
  const url = requireEnv("MCP_URL");
  const token = requireEnv("MCP_TOKEN");
  return createMCPClient({
    transport: {
      type: "http",
      url,
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}
