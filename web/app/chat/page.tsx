import { mcpErrorText } from "@/lib/errors";
import { listPrompts } from "@/lib/salon";
import type { PromptInfo } from "@/types";
import ChatPanel from "./ChatPanel";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  let prompts: PromptInfo[] = [];
  let notice: string | null = null;
  try {
    prompts = await listPrompts();
  } catch (error) {
    // Чат открывается и без сервера: сообщение показывается над полем ввода.
    notice = mcpErrorText(error);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Чат-ассистент</h1>
      <ChatPanel prompts={prompts} notice={notice} />
    </div>
  );
}
