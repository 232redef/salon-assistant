"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-5">
      <h1 className="text-lg font-semibold text-red-900">Не удалось получить данные</h1>
      <p className="mt-2 text-sm text-red-800">
        Скорее всего, MCP-сервер не запущен или недоступен. Запустите его командой{" "}
        <code className="rounded bg-red-100 px-1">python server.py</code> в папке mcp-server и проверьте, что
        MCP_TOKEN в web/.env.local совпадает с токеном сервера.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
      >
        Повторить
      </button>
    </div>
  );
}
