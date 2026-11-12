// Инструменты, которые меняют данные необратимо.
// Список в одном месте: его используют и чат (route.ts), и панель.
export const NEEDS_APPROVAL: readonly string[] = ["cancel_booking"];

export function needsApproval(toolName: string): boolean {
  return NEEDS_APPROVAL.includes(toolName);
}
