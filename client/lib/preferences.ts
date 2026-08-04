const STORAGE_KEY = "sa_chat_history_opt_in";

/** Read explicit user preference; `null` means not chosen yet. */
export function getChatHistoryOptIn(): boolean | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "1") return true;
    if (raw === "0") return false;
  } catch {
    /* private mode */
  }
  return null;
}

export function setChatHistoryOptIn(value: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Resolve preference: explicit choice wins, else product default. */
export function resolveChatHistoryOptIn(productDefault = false): boolean {
  const explicit = getChatHistoryOptIn();
  return explicit ?? productDefault;
}
