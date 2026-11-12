import "server-only";
import { mcpErrorText } from "@/lib/errors";
import { openMcp } from "@/lib/mcp";

export interface StatusItem {
  ok: boolean;
  title: string;
  detail: string;
}

const OLLAMA_URL = "http://127.0.0.1:11434";

export async function getMcpStatus(): Promise<StatusItem> {
  try {
    const mcp = await openMcp();
    try {
      const tools = await mcp.tools();
      return {
        ok: true,
        title: "MCP-сервер",
        detail: `Подключено, инструментов: ${Object.keys(tools).length}`,
      };
    } finally {
      await mcp.close();
    }
  } catch (error) {
    return { ok: false, title: "MCP-сервер", detail: mcpErrorText(error) };
  }
}

export async function getModelStatus(): Promise<StatusItem> {
  const title = "Модель";
  const model = process.env.LLM_MODEL ?? "qwen3:4b-instruct";

  if (process.env.LLM_PROVIDER === "openai-compatible") {
    const missing = ["LLM_BASE_URL", "LLM_MODEL", "LLM_API_KEY"].filter((name) => !process.env[name]);
    if (missing.length > 0) {
      return { ok: false, title, detail: `Не заданы переменные: ${missing.join(", ")}` };
    }
    return {
      ok: true,
      title,
      detail: `Облачная модель ${model}. Доступность проверяется при первом запросе в чате.`,
    };
  }

  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = (await response.json()) as { models?: { name: string }[] };
    const names = (data.models ?? []).map((item) => item.name);
    if (names.some((name) => name === model || name === `${model}:latest`)) {
      return { ok: true, title, detail: `Ollama запущена, модель ${model} готова` };
    }
    return {
      ok: false,
      title,
      detail: `Ollama запущена, но модель ${model} не скачана. Выполните: ollama pull ${model}`,
    };
  } catch {
    return { ok: false, title, detail: "Ollama недоступна. Запустите Ollama; панель работает и без неё." };
  }
}
