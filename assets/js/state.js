// Basit global state yöneticisi

const AppState = {
  token: null,
  email: null,
  history: [],
  incompleteResponse: false,
  incompleteMode: null,
  incompleteFiles: [],
};

const CHAT_HISTORY_STORAGE_VERSION = 1;
const CHAT_HISTORY_MAX_MESSAGES = 80;
const CHAT_HISTORY_MAX_CHARS = 100000;
const CHAT_USAGE_PROVIDERS = new Set(["tavily", "gemini", "groq"]);

function normalizeChatUsage(value) {
  if (!value || typeof value !== "object") return null;
  const provider = (item) => CHAT_USAGE_PROVIDERS.has(item) ? item : null;
  const production = Array.isArray(value.production)
    ? [...new Set(value.production.map(provider).filter(Boolean))].slice(0, 4)
    : [];
  const usage = {
    mode: value.mode === "crazy" ? "crazy" : "normal",
    research: ["tavily", "unavailable", "not_used"].includes(value.research) ? value.research : "not_used",
    brief: provider(value.brief),
    production,
  };
  return usage.brief || usage.production.length || usage.research !== "not_used" ? usage : null;
}

function normalizeCompletedFiles(value) {
  if (!Array.isArray(value)) return [];
  const allowedExtension = /\.(?:html?|css|mjs|cjs|js|jsx|ts|tsx|json|py|java|cs|cpp|c|h|hpp|go|rs|php|rb|vue|svelte|md|ya?ml|toml|sql|sh|txt)$/i;
  const names = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim().replace(/\\/g, "/").replace(/^\.\//, "");
    const segments = name.split("/");
    if (!name || name.length > 180 || segments.some((part) => !part || part === "." || part === "..") || /[\x00-\x1f<>:"|?*]/.test(name) || !allowedExtension.test(name)) continue;
    if (!names.some((saved) => saved.toLowerCase() === name.toLowerCase())) names.push(name);
    if (names.length >= 30) break;
  }
  return names;
}

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
      return { history: [], incompleteResponse: false, incompleteMode: null, incompleteFiles: [] };
    }
    const history = saved.history
      .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .map((item) => item.role === "assistant"
        ? { role: item.role, content: item.content, ...(normalizeChatUsage(item.usage) ? { usage: normalizeChatUsage(item.usage) } : {}) }
        : { role: item.role, content: item.content })
      .slice(-CHAT_HISTORY_MAX_MESSAGES);
    return {
      history,
      incompleteResponse: saved.incompleteResponse === true,
      incompleteMode: ["normal", "crazy"].includes(saved.incompleteMode) ? saved.incompleteMode : null,
      incompleteFiles: normalizeCompletedFiles(saved.incompleteFiles),
    };
  } catch {
    return { history: [], incompleteResponse: false, incompleteMode: null, incompleteFiles: [] };
  }
}

function saveChatHistory(
  email,
  history = AppState.history,
  incompleteResponse = AppState.incompleteResponse,
  incompleteMode = AppState.incompleteMode,
  incompleteFiles = AppState.incompleteFiles
) {
  if (!email) return false;
  const bounded = [];
  let totalChars = 0;
  for (const item of retainChatHistory(history).reverse()) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") continue;
    const remaining = CHAT_HISTORY_MAX_CHARS - totalChars;
    if (remaining <= 0) break;
    const content = item.content.length > remaining ? item.content.slice(-remaining) : item.content;
    bounded.unshift({
      role: item.role,
      content,
      ...(item.role === "assistant" && normalizeChatUsage(item.usage) ? { usage: normalizeChatUsage(item.usage) } : {}),
    });
    totalChars += content.length;
  }
  try {
    localStorage.setItem(chatHistoryStorageKey(email), JSON.stringify({
      version: CHAT_HISTORY_STORAGE_VERSION,
      history: bounded,
      incompleteResponse: incompleteResponse === true,
      incompleteMode: ["normal", "crazy"].includes(incompleteMode) ? incompleteMode : null,
      incompleteFiles: normalizeCompletedFiles(incompleteFiles),
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
