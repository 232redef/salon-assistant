import "server-only";
import { openMcp } from "@/lib/mcp";
import type { ToolResult } from "@/types";

type McpClient = Awaited<ReturnType<typeof openMcp>>;

// Открыть соединение, выполнить работу, закрыть в любом случае.
async function withMcp<T>(work: (mcp: McpClient) => Promise<T>): Promise<T> {
  const mcp = await openMcp();
  try {
    return await work(mcp);
  } finally {
    await mcp.close();
  }
}

// Ресурсы сервера отдают JSON текстом.
export function readResourceJson<T>(uri: string): Promise<T> {
  return withMcp(async (mcp) => {
    const result = await mcp.readResource({ uri });
    const first = result.contents[0];
    if (!first || !("text" in first) || typeof first.text !== "string") {
      throw new Error(`Ресурс ${uri} вернул пустой ответ`);
    }
    return JSON.parse(first.text) as T;
  });
}

function toToolResult(raw: unknown): ToolResult {
  if (typeof raw === "object" && raw !== null && "content" in raw) {
    const { content, isError } = raw as { content: unknown; isError?: boolean };
    const parts = Array.isArray(content) ? content : [];
    const text = parts
      .map((part) =>
        typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .filter(Boolean)
      .join("\n");
    return { ok: !isError, text };
  }
  return { ok: true, text: typeof raw === "string" ? raw : JSON.stringify(raw) };
}

// Отказ инструмента (isError) возвращается как результат, а не как исключение:
// текст ToolError показываем человеку без изменений.
export function callSalonTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return withMcp(async (mcp) => {
    const tools = await mcp.tools();
    const tool = tools[name];
    if (!tool || !tool.execute) {
      throw new Error(`Инструмент ${name} не найден на сервере`);
    }
    const raw = await tool.execute(args, {
      messages: [],
      toolCallId: `panel-${name}-${Date.now()}`,
    });
    return toToolResult(raw);
  });
}
