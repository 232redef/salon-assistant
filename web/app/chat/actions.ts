"use server";

import { mcpErrorText } from "@/lib/errors";
import { getPromptText } from "@/lib/salon";

export type PromptTextResult = { text: string } | { error: string };

export async function getPromptTextAction(
  name: string,
  args: Record<string, string>,
): Promise<PromptTextResult> {
  try {
    return { text: await getPromptText(name, args) };
  } catch (error) {
    return { error: mcpErrorText(error) };
  }
}
