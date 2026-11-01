// Basit global state yöneticisi

const AppState = {
  token: null,
  email: null,
  history: [],
  incompleteResponse: false,
  incompleteMode: null,
};

const CHAT_HISTORY_STORAGE_VERSION = 1;
const CHAT_HISTORY_MAX_MESSAGES = 80;
const CHAT_HISTORY_MAX_CHARS = 100000;

function retainChatHistory(history) {
  if (!Array.isArray(history) || history.length <= CHAT_HISTORY_MAX_MESSAGES) return history || [];
  const recent = history.slice(-(CHAT_HISTORY_MAX_MESSAGES - 1));
  const firstUser = history.find((item) => item?.role === "user");
  return firstUser && !recent.includes(firstUser) ? [firstUser, ...recent] : recent;
}

function chatHistoryStorageKey(email) {
  let hash = 2166136261;
  for (const char of String(email || "").trim().toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `haking_chat_history_v${CHAT_HISTORY_STORAGE_VERSION}_${(hash >>> 0).toString(16)}`;
}

function loadChatHistory(email) {
  try {
    const saved = JSON.parse(localStorage.getItem(chatHistoryStorageKey(email)) || "null");
    if (saved?.version !== CHAT_HISTORY_STORAGE_VERSION || !Array.isArray(saved.history)) {
      return { history: [], incompleteResponse: false, incompleteMode: null };
    }
    const history = saved.history
      .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .slice(-CHAT_HISTORY_MAX_MESSAGES);
    return {
      history,
      incompleteResponse: saved.incompleteResponse === true,
      incompleteMode: ["normal", "crazy"].includes(saved.incompleteMode) ? saved.incompleteMode : null,
    };
  } catch {
    return { history: [], incompleteResponse: false, incompleteMode: null };
  }
}

function saveChatHistory(
  email,
  history = AppState.history,
  incompleteResponse = AppState.incompleteResponse,
  incompleteMode = AppState.incompleteMode
) {
  if (!email) return false;
  const bounded = [];
  let totalChars = 0;
  for (const item of retainChatHistory(history).reverse()) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") continue;
    const remaining = CHAT_HISTORY_MAX_CHARS - totalChars;
    if (remaining <= 0) break;
    const content = item.content.length > remaining ? item.content.slice(-remaining) : item.content;
    bounded.unshift({ role: item.role, content });
    totalChars += content.length;
  }
  try {
    localStorage.setItem(chatHistoryStorageKey(email), JSON.stringify({
      version: CHAT_HISTORY_STORAGE_VERSION,
      history: bounded,
      incompleteResponse: incompleteResponse === true,
      incompleteMode: ["normal", "crazy"].includes(incompleteMode) ? incompleteMode : null,
      updatedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
}

function clearChatHistory(email) {
  if (!email) return;
  try {
    localStorage.removeItem(chatHistoryStorageKey(email));
  } catch {
    // The visible conversation can still be cleared if browser storage is unavailable.
  }
}

function loadSession() {
  try {
    AppState.token = localStorage.getItem("haking_token");
    // Remove the legacy persisted email; the API returns it after session validation.
    localStorage.removeItem("haking_email");
  } catch {
    AppState.token = null;
  }
  AppState.email = null;
}

function saveSession(token, email) {
  AppState.token = token;
  AppState.email = email;
  try {
    localStorage.setItem("haking_token", token);
  } catch {
    // Keep the session in memory for this tab when browser storage is blocked.
  }
}

function clearSession() {
  AppState.token = null;
  AppState.email = null;
  try {
    localStorage.removeItem("haking_token");
    localStorage.removeItem("haking_email");
  } catch {
    // The in-memory session is cleared even if browser storage is unavailable.
  }
}
