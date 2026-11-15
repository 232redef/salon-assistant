import "server-only";
import { openMcp } from "@/lib/mcp";
import { parseToolOutput } from "@/lib/tool-output";
import type { PromptInfo, ToolResult } from "@/types";

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
      context: {},
    });
    const parsed = parseToolOutput(raw);
    return { ok: !parsed.isError, text: parsed.text };
  });
}

export function listPrompts(): Promise<PromptInfo[]> {
  return withMcp(async (mcp) => {
    const result = await mcp.experimental_listPrompts();
    return result.prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: (prompt.arguments ?? []).map((arg) => ({
        name: arg.name,
        description: arg.description,
        required: arg.required,
      })),
    }));
  });
}

export function getPromptText(name: string, args: Record<string, string>): Promise<string> {
  return withMcp(async (mcp) => {
    const result = await mcp.experimental_getPrompt({ name, arguments: args });
    const texts = result.messages
      .map((message) => (message.content.type === "text" ? message.content.text : ""))
      .filter(Boolean);
    if (texts.length === 0) {
      throw new Error(`Промпт ${name} вернул пустой текст`);
    }
    return texts.join("\n\n");
  });
}