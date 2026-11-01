// Uygulama başlangıç noktası

const chatInputEl = document.getElementById("chat-input");
const sendBtnEl = document.getElementById("send-btn");
const newChatBtnEl = document.getElementById("new-chat-btn");
const fileInputEl = document.getElementById("file-input");
const attachFileBtnEl = document.getElementById("attach-file-btn");
const removeFileBtnEl = document.getElementById("remove-file-btn");
const fileSelectionEl = document.getElementById("file-selection");
const fileSelectionNameEl = document.getElementById("file-selection-name");
const aiModeSelectEl = document.getElementById("ai-mode");
const modePickerTriggerEl = document.getElementById("mode-picker-trigger");
const modePickerMenuEl = document.getElementById("mode-picker-menu");
const modePickerLabelEl = document.getElementById("mode-picker-label");
const crazyModePickerTitleEl = document.getElementById("mode-option-crazy-title");
const aiCreditsStatusEl = document.getElementById("ai-credits-status");
const lowCreditAlertEl = document.getElementById("low-credit-alert");
const BACKEND_KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;
const CHAT_CONTEXT_MAX_MESSAGES = 24;
const CHAT_CONTEXT_MAX_CHARS = 24000;
const MAX_SOURCE_FILE_BYTES = 64 * 1024;
const ALLOWED_SOURCE_FILE_EXTENSIONS = new Set([
  "html", "htm", "css", "js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "java",
  "cs", "c", "h", "cpp", "hpp", "go", "rs", "php", "rb", "json", "md", "txt",
  "xml", "yaml", "yml", "sql", "sh", "vue", "svelte", "toml", "ini",
]);
const EMBEDDED_SECRET_PATTERN = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----|AIza[\w-]{30,}|\b(?:sk-(?:live|test|proj)-[\w-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b|\bpostgres(?:ql)?:\/\/[^/\s:]+:[^@\s/]+@/;
let backendKeepaliveTimer = null;
let selectedSourceFile = null;
let isReadingSourceFile = false;

function syncModePickerSelection() {
  if (!aiModeSelectEl || !modePickerMenuEl || !modePickerLabelEl) return;
  const selectedMode = aiModeSelectEl.value === "crazy" ? "crazy" : "normal";
  for (const option of modePickerMenuEl.querySelectorAll("[data-mode]")) {
    option.setAttribute("aria-selected", String(option.dataset.mode === selectedMode));
  }
  const selectedNativeOption = aiModeSelectEl.querySelector(
    selectedMode === "crazy" ? 'option[value="crazy"]' : 'option[value="normal"]'
  );
  modePickerLabelEl.textContent = selectedMode === "crazy"
    ? (crazyModePickerTitleEl?.textContent || selectedNativeOption?.textContent || "Çılgın Mod")
    : "Normal · kredi harcamaz";
}

function closeModePicker(restoreFocus = false) {
  if (!modePickerMenuEl || !modePickerTriggerEl) return;
  modePickerMenuEl.hidden = true;
  modePickerTriggerEl.setAttribute("aria-expanded", "false");
  if (restoreFocus) modePickerTriggerEl.focus();
}

function openModePicker() {
  if (!modePickerMenuEl || !modePickerTriggerEl) return;
  modePickerMenuEl.hidden = false;
  modePickerTriggerEl.setAttribute("aria-expanded", "true");
  const selected = modePickerMenuEl.querySelector('[aria-selected="true"]');
  (selected || modePickerMenuEl.querySelector("[data-mode]"))?.focus();
}

modePickerTriggerEl?.addEventListener("click", () => {
  if (modePickerMenuEl?.hidden) openModePicker();
  else closeModePicker();
});

modePickerTriggerEl?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    openModePicker();
  } else if (event.key === "Escape") {
    closeModePicker();
  }
});

modePickerMenuEl?.addEventListener("click", (event) => {
  const option = event.target.closest("[data-mode]");
  if (!option || !aiModeSelectEl) return;
  aiModeSelectEl.value = option.dataset.mode === "crazy" ? "crazy" : "normal";
  aiModeSelectEl.dispatchEvent(new Event("change", { bubbles: true }));
  syncModePickerSelection();
  closeModePicker(true);
});

modePickerMenuEl?.addEventListener("keydown", (event) => {
  const options = [...modePickerMenuEl.querySelectorAll("[data-mode]")];
  const currentIndex = options.indexOf(document.activeElement);
  let nextIndex = currentIndex;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = options.length - 1;
  else if (event.key === "Escape") {
    event.preventDefault();
    closeModePicker(true);
    return;
  } else {
    return;
  }
  event.preventDefault();
  options[nextIndex]?.focus();
});

document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#mode-picker")) closeModePicker();
});

syncModePickerSelection();

async function refreshAiCreditBalance() {
  if (!AppState.token || !aiCreditsStatusEl) return;
  aiCreditsStatusEl.textContent = "Kredi bakiyesi yükleniyor…";
  aiCreditsStatusEl.removeAttribute("title");
  try {
    const balance = await apiGetAiCredits(AppState.token);
    if (!balance.ok) throw new Error(balance.message);
    const renewsAt = new Date(`${balance.period_renews_at}T12:00:00+03:00`);
    const renewsLabel = Number.isNaN(renewsAt.getTime())
      ? ""
      : ` · ${new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(renewsAt)} yenilenir`;
    aiCreditsStatusEl.textContent = `${balance.total_credits} aktif kredi${renewsLabel}`;
    aiCreditsStatusEl.dataset.low = String(balance.total_credits <= 30);
    const nextExpiry = (balance.purchased_lots || []).find((lot) => lot.credits_remaining > 0);
    const expiryLabel = nextExpiry
      ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(nextExpiry.expires_at))
      : "henüz ek kredi yok";
    aiCreditsStatusEl.title = `${balance.monthly_credits}/${balance.monthly_allowance} aylık kredi · ${balance.purchased_credits} ek kredi · Ek kredilerin en yakını: ${expiryLabel} · Her Çılgın Mod isteği ${balance.crazy_mode_cost} kredi.`;
    if (lowCreditAlertEl) {
      lowCreditAlertEl.classList.toggle("hidden", balance.total_credits > 30);
      lowCreditAlertEl.setAttribute("aria-hidden", String(balance.total_credits > 30));
    }
    AppState.credits = balance;
    const crazyOption = aiModeSelectEl?.querySelector('option[value="crazy"]');
    if (crazyOption) crazyOption.textContent = "Çılgın Mod · " + balance.crazy_mode_cost + " kredi";
    if (crazyModePickerTitleEl) crazyModePickerTitleEl.textContent = "Çılgın Mod · " + balance.crazy_mode_cost + " kredi";
    syncModePickerSelection();
  } catch (error) {
    aiCreditsStatusEl.textContent = "Kredi bakiyesi şu an alınamadı";
    aiCreditsStatusEl.title = error.message;
  }
}

function setFileSelectionMessage(message, isError = false) {
  fileSelectionNameEl.textContent = message;
  fileSelectionEl.classList.remove("hidden", "has-error");
  if (isError) fileSelectionEl.classList.add("has-error");
  removeFileBtnEl.classList.toggle("hidden", isError || !selectedSourceFile);
}

function clearSelectedSourceFile() {
  selectedSourceFile = null;
  isReadingSourceFile = false;
  fileInputEl.value = "";
  fileSelectionNameEl.textContent = "";
  fileSelectionEl.classList.add("hidden");
  fileSelectionEl.classList.remove("has-error");
  removeFileBtnEl.classList.remove("hidden");
}

function formatFileSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

async function readSourceFile(file) {
  selectedSourceFile = null;
  isReadingSourceFile = false;
  const name = file.name;
  const extension = name.split(".").pop()?.toLowerCase();
  if (!name || name.length > 120 || /[\\/:\u0000-\u001f]/.test(name) || !name.includes(".")) {
    setFileSelectionMessage("Dosya adı geçersiz.", true);
    return;
  }
  if (name.toLowerCase().startsWith(".env") || ["id_rsa.txt", "credentials.txt", "secrets.json"].includes(name.toLowerCase())) {
    setFileSelectionMessage("Gizli bilgi içerebilecek bu dosya türü yüklenemez.", true);
    return;
  }
  if (!ALLOWED_SOURCE_FILE_EXTENSIONS.has(extension)) {
    setFileSelectionMessage("Bu dosya türüne izin verilmiyor. Yalnızca kaynak kod ve metin dosyaları seç.", true);
    return;
  }
  if (file.size > MAX_SOURCE_FILE_BYTES) {
    setFileSelectionMessage("Dosya 64 KB sınırını aşıyor. Daha küçük bir dosya seç.", true);
    return;
  }

  isReadingSourceFile = true;
  setFileSelectionMessage(`${name} okunuyor…`);
  try {
    const bytes = await file.arrayBuffer();
    const content = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
    if (content.includes("\u0000") || /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(content)) {
      throw new Error("Dosya geçerli bir metin/kaynak kod dosyası değil.");
    }
    if (EMBEDDED_SECRET_PATTERN.test(content)) {
      throw new Error("Dosyada gizli anahtar olabilecek bir değer bulundu. Güvenliğin için önce bu değeri kaldır.");
    }
    selectedSourceFile = { name, content, size: file.size };
    setFileSelectionMessage(`${name} · ${formatFileSize(file.size)} · gönderildiğinde AI sağlayıcısına iletilir.`);
  } catch (error) {
    setFileSelectionMessage(error instanceof TypeError ? "Dosya UTF-8 metni olarak okunamadı." : error.message, true);
  } finally {
    isReadingSourceFile = false;
    fileInputEl.value = "";
  }
}

attachFileBtnEl.addEventListener("click", () => {
  if (!sendBtnEl.disabled && !isReadingSourceFile) fileInputEl.click();
});
fileInputEl.addEventListener("change", () => {
  const [file] = fileInputEl.files || [];
  if (file) void readSourceFile(file);
});
removeFileBtnEl.addEventListener("click", clearSelectedSourceFile);

function stopBackendKeepAlive() {
  if (backendKeepaliveTimer !== null) {
    window.clearInterval(backendKeepaliveTimer);
    backendKeepaliveTimer = null;
  }
}

function startBackendKeepAlive() {
  stopBackendKeepAlive();
  if (!AppState.token || !AppState.email || document.visibilityState !== "visible") return;

  backendKeepaliveTimer = window.setInterval(() => {
    if (
      !AppState.token ||
      !AppState.email ||
      document.visibilityState !== "visible" ||
      !navigator.onLine ||
      sendBtnEl.disabled
    ) {
      return;
    }

    void apiKeepAlive().catch((error) => {
      console.info("Hafif sunucu kontrolü başarısız; sonraki kontrolde tekrar denenecek.", error.message);
    });
  }, BACKEND_KEEPALIVE_INTERVAL_MS);
}

document.addEventListener("DOMContentLoaded", async () => {
  loadSession();

  if (!AppState.token) {
    clearSession();
    uiShowLogin();
    loginErrorEl.textContent = "Sohbeti kullanmak için önce hesabına giriş yapmalısın.";
    return;
  }

  uiShowLogin();
  loginErrorEl.dataset.state = "pending";
  loginErrorEl.textContent = "Oturum doğrulanıyor...";

  try {
    const session = await apiValidateSession(AppState.token);
    if (!session.ok) {
      if (session.unauthorized) clearSession();
      loginErrorEl.removeAttribute("data-state");
      loginErrorEl.textContent = session.message;
      return;
    }

    saveSession(AppState.token, session.email);
    loginErrorEl.removeAttribute("data-state");
    loginErrorEl.textContent = "";
    uiShowChat(session.email, session.name);
    startBackendKeepAlive();
    void apiWarmup().catch((error) => {
      console.info("Backend hazırlanıyor:", error.message);
    });
  } catch (error) {
    console.info("Oturum doğrulaması tamamlanamadı:", error.message);
    loginErrorEl.removeAttribute("data-state");
    loginErrorEl.textContent =
      "Oturum doğrulanamadı. Sunucu bağlantısını kontrol edip yeniden dene.";
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopBackendKeepAlive();
    return;
  }

  if (AppState.email && AppState.token) {
    void apiWarmup()
      .then(startBackendKeepAlive)
      .catch((error) => console.info("Backend hazırlanıyor:", error.message));
  }
});

window.addEventListener("online", () => {
  if (!AppState.email || !AppState.token || document.visibilityState !== "visible") return;
  void apiWarmup()
    .then(startBackendKeepAlive)
    .catch((error) => console.info("Backend bağlantısı yeniden deneniyor:", error.message));
});

sendBtnEl.addEventListener("click", sendMessageFromUI);
chatInputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessageFromUI();
  }
});

chatInputEl.addEventListener("input", () => {
  chatInputEl.style.height = "auto";
  chatInputEl.style.height = `${Math.min(chatInputEl.scrollHeight, 170)}px`;
});

newChatBtnEl.addEventListener("click", () => {
  if (sendBtnEl.disabled) return;
  uiShowTyping(false);
  chatInputEl.value = "";
  chatInputEl.style.height = "auto";
  clearSelectedSourceFile();
  uiStartNewChat();
  chatInputEl.focus();
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    newChatBtnEl.click();
  }
});

document.getElementById("chat-window").addEventListener("click", (event) => {
  if (event.target.closest("[data-continue-partial]")) {
    event.target.closest(".continue-response-row")?.remove();
    if (AppState.incompleteMode && aiModeSelectEl) {
      aiModeSelectEl.value = AppState.incompleteMode;
      aiModeSelectEl.dispatchEvent(new Event("change", { bubbles: true }));
      syncModePickerSelection();
    }
    chatInputEl.value = "Kaldığın yerden devam et. Önceki yanıtında tamamladığın kodu veya açıklamayı tekrarlama; son eksik satırdan sürdür, tüm dosyaları ve kapanışları tamamla.";
    sendMessageFromUI();
    return;
  }
  const promptCard = event.target.closest("[data-prompt]");
  if (!promptCard) return;
  chatInputEl.value = promptCard.dataset.prompt;
  sendMessageFromUI();
});

document.getElementById("clear-chat-history-btn")?.addEventListener("click", () => {
  if (!AppState.email || !window.confirm("Bu cihazda saklanan aktif sohbet geçmişi silinsin mi?")) return;
  uiStartNewChat();
  const status = document.getElementById("chat-history-status");
  if (status) status.textContent = "Bu cihazdaki sohbet geçmişi silindi.";
});

function buildChatContext(history) {
  const entries = Array.isArray(history) ? history : [];
  if (!entries.length) return [];
  const recent = entries.slice(-(CHAT_CONTEXT_MAX_MESSAGES - 1));
  const firstUser = entries.find((item) => item.role === "user");
  const anchor = firstUser && !recent.includes(firstUser)
    ? { role: "user", content: `[Projenin ilk isteği]\n${firstUser.content.slice(0, 3500)}` }
    : null;
  let budget = CHAT_CONTEXT_MAX_CHARS - (anchor?.content.length || 0);
  const selected = [];
  for (const item of recent.slice().reverse()) {
    if (budget <= 0) break;
    const itemBudget = Math.min(budget, 12000);
    const content = item.content.length > itemBudget ? item.content.slice(-itemBudget) : item.content;
    selected.unshift({ role: item.role, content });
    budget -= content.length;
  }
  return anchor ? [anchor, ...selected].slice(-CHAT_CONTEXT_MAX_MESSAGES) : selected;
}

function setSendButtonBusy(busy) {
  sendBtnEl.classList.toggle("is-busy", busy);
  sendBtnEl.setAttribute("aria-busy", String(busy));
  sendBtnEl.setAttribute("aria-label", busy ? "Yanıt hazırlanıyor" : "Mesajı gönder");
  sendBtnEl.title = busy ? "Yanıt hazırlanıyor" : "Mesajı gönder";
}

async function sendMessageFromUI() {
  const attachment = selectedSourceFile;
  const message = chatInputEl.value.trim() || (attachment ? "Yüklediğim dosyayı incele ve varsa hataları açıkla; gerekirse düzeltilmiş kodu öner." : "");
  if ((!message && !attachment) || sendBtnEl.disabled || isReadingSourceFile) return;

  const mode = aiModeSelectEl?.value === "crazy" ? "crazy" : "normal";

  if (!AppState.email || !AppState.token) {
    uiShowLogin();
    loginErrorEl.textContent = "Sohbeti kullanmak için hesabına giriş yapmalısın.";
    return;
  }

  const displayedMessage = attachment
    ? `${message}\n\nEklenen dosya: ${attachment.name}`
    : message;
  uiAddUserMessage(displayedMessage);
  chatInputEl.value = "";
  chatInputEl.style.height = "auto";
  sendBtnEl.disabled = true;
  setSendButtonBusy(true);
  newChatBtnEl.disabled = true;
  attachFileBtnEl.disabled = true;
  removeFileBtnEl.disabled = true;
  uiShowTyping(true, mode);

  let assistantBubble = null;
  let hasReceivedChunk = false;
  let assistantReply = "";
  const historyUserMessage = displayedMessage;
  let draftPersistTimer = null;
  const persistStreamingDraft = () => {
    if (draftPersistTimer !== null) return;
    draftPersistTimer = window.setTimeout(() => {
      draftPersistTimer = null;
      saveChatHistory(
        AppState.email,
        [...AppState.history, { role: "user", content: historyUserMessage }, { role: "assistant", content: assistantReply }],
        true,
        mode
      );
    }, 700);
  };
  const continueIntent = AppState.incompleteResponse && /^(?:lütfen\s+)?(?:devam(?:\s+et)?|kaldığın\s+yerden(?:\s+devam\s+et)?|sürdür)(?:[.!\s]|$)/i.test(message);
  const requestMessage = continueIntent
    ? `${message}\n\n[DEVAM TALİMATI: Önceki assistant mesajı yarıda kaldı. Yalnızca tamamlanmayan kısmı, önceki çıktının son satırından itibaren sürdür. Daha önce tamamlanmış kodu, dosyaları veya açıklamaları yeniden yazma. Ürettiğin her dosyayı eksiksiz kapat ve yanıtı tamamla.]`
    : message;
  try {
    const result = await apiChat(
      requestMessage,
      AppState.email,
      AppState.token,
      buildChatContext(AppState.history),
      (chunk) => {
        assistantReply += chunk;
        persistStreamingDraft();
        if (!hasReceivedChunk) {
          hasReceivedChunk = true;
          uiShowTyping(false);
          assistantBubble = uiCreateAssistantStreamMessage();
        }
        uiAppendAssistantStream(assistantBubble, chunk);
      },
      attachment,
      mode,
      (stage) => uiSetTypingStage(stage)
    );

    if (!result.ok) {
      if (result.unauthorized) {
        stopBackendKeepAlive();
        clearSession();
        clearSelectedSourceFile();
        uiShowLogin();
        loginErrorEl.textContent = result.message || "Oturumun sona erdi. Lütfen tekrar giriş yap.";
        return;
      }
      if (hasReceivedChunk) {
        AppState.history.push(
          { role: "user", content: historyUserMessage },
          { role: "assistant", content: assistantReply }
        );
        AppState.history = retainChatHistory(AppState.history);
        AppState.incompleteResponse = true;
        AppState.incompleteMode = mode;
        saveChatHistory(AppState.email);
      }
      uiAddAssistantMessage(result.message || "Mesaj gönderilemedi. Lütfen tekrar deneyin.");
      if ((hasReceivedChunk || AppState.incompleteResponse) && !document.querySelector("[data-continue-partial]")) {
        uiAddContinuationAction();
      }
    } else if (!hasReceivedChunk) {
      uiAddAssistantMessage("Asistan boş bir yanıt verdi. Lütfen tekrar deneyin.");
    } else {
      clearSelectedSourceFile();
      AppState.history.push(
        { role: "user", content: historyUserMessage },
        { role: "assistant", content: assistantReply }
      );
      AppState.history = retainChatHistory(AppState.history);
      AppState.incompleteResponse = false;
      AppState.incompleteMode = null;
      saveChatHistory(AppState.email);
      document.querySelectorAll("#chat-window .continue-response-row").forEach((row) => row.remove());
    }
  } catch (err) {
    console.error(err);
    if (hasReceivedChunk) {
      AppState.history.push(
        { role: "user", content: historyUserMessage },
        { role: "assistant", content: assistantReply }
      );
      AppState.history = retainChatHistory(AppState.history);
      AppState.incompleteResponse = true;
      AppState.incompleteMode = mode;
      saveChatHistory(AppState.email);
    }
    uiAddAssistantMessage(
      err.message?.startsWith("Yanıt bekleme süresi")
        ? err.message
        : "Asistana bağlanırken bir sorun oldu. Lütfen tekrar deneyin."
    );
    if ((hasReceivedChunk || AppState.incompleteResponse) && !document.querySelector("[data-continue-partial]")) {
      uiAddContinuationAction();
    }
  } finally {
    if (draftPersistTimer !== null) window.clearTimeout(draftPersistTimer);
    if (assistantBubble) uiFinishAssistantStream(assistantBubble);
    uiShowTyping(false);
    sendBtnEl.disabled = false;
    setSendButtonBusy(false);
    newChatBtnEl.disabled = false;
    attachFileBtnEl.disabled = false;
    removeFileBtnEl.disabled = false;
    if (mode === "crazy") void refreshAiCreditBalance();
  }
}
