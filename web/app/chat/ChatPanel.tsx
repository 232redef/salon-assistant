"use client";

import { useChat } from "@ai-sdk/react";
import { lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { parseToolOutput } from "@/lib/tool-output";
import type { PromptInfo } from "@/types";
import { getPromptTextAction } from "./actions";

type MessagePart = UIMessage["parts"][number];
type ToolPart = Extract<MessagePart, { type: "dynamic-tool" }>;

const ARG_LABELS: Record<string, string> = {
  date: "Дата (ГГГГ-ММ-ДД)",
  date_from: "С даты (ГГГГ-ММ-ДД)",
  date_to: "По дату (ГГГГ-ММ-ДД)",
  client_name: "Имя клиента",
  service: "Услуга",
  master: "Мастер",
};

const INPUT = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm";

function ToolCall({
  part,
  onApproval,
}: {
  part: ToolPart;
  onApproval: (approvalId: string, approved: boolean) => void;
}) {
  const args = JSON.stringify(part.input ?? {}, null, 2);
  let body: ReactNode;

  if (part.state === "approval-requested") {
    const approvalId = part.approval.id;
    body = (
      <div className="space-y-2">
        <p className="text-sm font-medium">Ассистент просит выполнить необратимую операцию. Выполнить?</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onApproval(approvalId, true)}
            className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800"
          >
            Выполнить
          </button>
          <button
            type="button"
            onClick={() => onApproval(approvalId, false)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm hover:bg-zinc-100"
          >
            Отменить
          </button>
        </div>
      </div>
    );
  } else if (part.state === "output-denied") {
    // Источник правды об отказе: состояние части, а не слова модели.
    body = (
      <p className="rounded-md bg-zinc-200 p-2 text-sm text-zinc-800">
        Операция не выполнена: вы отказались.
      </p>
    );
  } else if (part.state === "output-available") {
    const output = parseToolOutput(part.output);
    body = output.isError ? (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
        Отказ инструмента: {output.text || "без пояснения"}
      </p>
    ) : (
      <p className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md bg-green-50 p-2 text-sm text-green-900">
        {output.text || "(пустой результат)"}
      </p>
    );
  } else if (part.state === "output-error") {
    body = (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">
        Ошибка вызова: {part.errorText}
      </p>
    );
  } else {
    body = <p className="animate-pulse text-sm text-zinc-500">Выполняется…</p>;
  }

  return (
    <div className="space-y-2 rounded-md border border-zinc-300 bg-zinc-50 p-3">
      <p className="text-sm">
        Вызов инструмента <code className="rounded bg-zinc-200 px-1">{part.toolName}</code>
      </p>
      <pre className="max-h-40 overflow-auto rounded bg-zinc-100 p-2 text-xs">{args}</pre>
      {body}
    </div>
  );
}

function PromptForm({
  prompt,
  disabled,
  onSubmit,
  onClose,
}: {
  prompt: PromptInfo;
  disabled: boolean;
  onSubmit: (values: Record<string, string>) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <p className="text-sm font-medium">{prompt.description ?? prompt.name}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {prompt.arguments.map((arg) => (
          <label key={arg.name} className="block space-y-1 text-sm">
            <span>{ARG_LABELS[arg.name] ?? arg.name}</span>
            <input
              required={arg.required}
              value={values[arg.name] ?? ""}
              onChange={(event) => setValues({ ...values, [arg.name]: event.target.value })}
              className={INPUT}
            />
          </label>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          Отправить в чат
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-100"
        >
          Закрыть
        </button>
      </div>
    </form>
  );
}

interface Props {
  prompts: PromptInfo[];
  notice: string | null;
}

export default function ChatPanel({ prompts, notice }: Props) {
  const { messages, sendMessage, status, error, addToolApprovalResponse } = useChat({
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });
  const [input, setInput] = useState("");
  const [activePrompt, setActivePrompt] = useState<PromptInfo | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const busy = status === "submitted" || status === "streaming";
  const pendingApproval = messages.some(
    (message) =>
      message.role === "assistant" &&
      message.parts.some((part) => part.type === "dynamic-tool" && part.state === "approval-requested"),
  );
  const locked = busy || pendingApproval;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || locked) return;
    void sendMessage({ text: trimmed });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(input);
    setInput("");
  }

  async function runPrompt(prompt: PromptInfo, args: Record<string, string>) {
    setPromptError(null);
    const result = await getPromptTextAction(prompt.name, args);
    if ("error" in result) {
      setPromptError(result.error);
      return;
    }
    setActivePrompt(null);
    submit(result.text);
  }

  function pickPrompt(prompt: PromptInfo) {
    if (prompt.arguments.length === 0) {
      void runPrompt(prompt, {});
    } else {
      setPromptError(null);
      setActivePrompt(prompt);
    }
  }

  return (
    <div className="space-y-4">
      {notice && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {notice}
        </p>
      )}

      <div className="space-y-3">
        {messages.length === 0 && (
          <p className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-600">
            Напишите, что нужно сделать: найти свободное время, записать клиента, показать записи или
            посчитать стоимость. Каждый вызов инструмента будет виден в ленте.
          </p>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`space-y-2 rounded-lg p-3 ${
              message.role === "user" ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white"
            }`}
          >
            <p className={`text-xs ${message.role === "user" ? "text-zinc-300" : "text-zinc-500"}`}>
              {message.role === "user" ? "Вы" : "Ассистент"}
            </p>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <p key={`${message.id}-${index}`} className="whitespace-pre-wrap break-words text-sm">
                    {part.text}
                  </p>
                );
              }
              if (part.type === "dynamic-tool") {
                return (
                  <ToolCall
                    key={`${message.id}-${index}`}
                    part={part}
                    onApproval={(id, approved) => addToolApprovalResponse({ id, approved })}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}

        {busy && (
          <p aria-live="polite" className="animate-pulse text-sm text-zinc-500">
            Ассистент думает…
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error.message}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="space-y-3 border-t border-zinc-200 pt-4">
        {prompts.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Заготовки запросов">
            {prompts.map((prompt) => (
              <button
                key={prompt.name}
                type="button"
                disabled={locked}
                onClick={() => pickPrompt(prompt)}
                className="rounded-full border border-zinc-300 bg-white px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-50"
              >
                {prompt.description ?? prompt.name}
              </button>
            ))}
          </div>
        )}

        {promptError && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {promptError}
          </p>
        )}

        {activePrompt && (
          <PromptForm
            prompt={activePrompt}
            disabled={locked}
            onSubmit={(values) => void runPrompt(activePrompt, values)}
            onClose={() => setActivePrompt(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={locked}
            placeholder={pendingApproval ? "Сначала подтвердите или отмените операцию" : "Ваш запрос"}
            className={`${INPUT} flex-1 disabled:bg-zinc-100`}
            aria-label="Сообщение ассистенту"
          />
          <button
            type="submit"
            disabled={locked || input.trim() === ""}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}
