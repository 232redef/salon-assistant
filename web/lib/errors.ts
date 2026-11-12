function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? error.cause.message : "";
  return `${error.message} ${cause}`;
}

// Тексты для человека. Токен и ключ в них не попадают.
export function mcpErrorText(error: unknown): string {
  const text = errorText(error);
  if (text.includes("Не задана переменная")) return text.trim();
  if (/401|403|unauthorized/i.test(text)) {
    return "Ошибка доступа к MCP-серверу: проверьте, что MCP_TOKEN в web/.env.local совпадает с токеном сервера.";
  }
  return "MCP-сервер недоступен. Запустите его командой python server.py в папке mcp-server.";
}

export function modelErrorText(error: unknown): string {
  const text = errorText(error);
  if (text.includes("Не задана переменная")) return text.trim();
  if (/does not support tools/i.test(text)) {
    return "Выбранная модель не умеет вызывать инструменты. Укажите другую в LLM_MODEL.";
  }
  if (/401|403|unauthorized/i.test(text)) {
    return "Ошибка доступа к модели: проверьте LLM_API_KEY.";
  }
  if (/ECONNREFUSED|fetch failed|failed to connect/i.test(text)) {
    return "Модель недоступна. Проверьте, что Ollama запущена, а модель скачана командой ollama pull.";
  }
  return "Ошибка при обращении к модели.";
}
