export interface ParsedToolOutput {
  isError: boolean;
  text: string;
}

// Результат инструмента MCP: { content: [{ type: "text", text }], isError? }.
// Отказ сервера приходит обычным результатом с isError = true.
export function parseToolOutput(raw: unknown): ParsedToolOutput {
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
    return { isError: Boolean(isError), text };
  }
  return {
    isError: false,
    text: typeof raw === "string" ? raw : (JSON.stringify(raw, null, 2) ?? ""),
  };
}
