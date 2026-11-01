// Uygulama başlangıç noktası

const chatInputEl = document.getElementById("chat-input");
const sendBtnEl = document.getElementById("send-btn");
const newChatBtnEl = document.getElementById("new-chat-btn");
const fileInputEl = document.getElementById("file-input");
const attachFileBtnEl = document.getElementById("attach-file-btn");
const removeFileBtnEl = document.getElementById("remove-file-btn");
const fileSelectionEl = document.getElementById("file-selection");
const fileSelectionNameEl = document.getElementById("file-selection-name");
const BACKEND_KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;
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
  const promptCard = event.target.closest("[data-prompt]");
  if (!promptCard) return;
  chatInputEl.value = promptCard.dataset.prompt;
  sendMessageFromUI();
});

async function sendMessageFromUI() {
  const attachment = selectedSourceFile;
  const message = chatInputEl.value.trim() || (attachment ? "Yüklediğim dosyayı incele ve varsa hataları açıkla; gerekirse düzeltilmiş kodu öner." : "");
  if ((!message && !attachment) || sendBtnEl.disabled || isReadingSourceFile) return;

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
  newChatBtnEl.disabled = true;
  attachFileBtnEl.disabled = true;
  removeFileBtnEl.disabled = true;
  uiShowTyping(true);

  let assistantBubble = null;
  let hasReceivedChunk = false;
  let assistantReply = "";
  try {
    const result = await apiChat(
      message,
      AppState.email,
      AppState.token,
      AppState.history.slice(-8),
      (chunk) => {
        assistantReply += chunk;
        if (!hasReceivedChunk) {
          hasReceivedChunk = true;
          uiShowTyping(false);
          assistantBubble = uiCreateAssistantStreamMessage();
        }
        uiAppendAssistantStream(assistantBubble, chunk);
      },
      attachment
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
      uiAddAssistantMessage(result.message || "Mesaj gönderilemedi. Lütfen tekrar deneyin.");
    } else if (!hasReceivedChunk) {
      uiAddAssistantMessage("Asistan boş bir yanıt verdi. Lütfen tekrar deneyin.");
    } else {
      clearSelectedSourceFile();
      AppState.history.push(
        { role: "user", content: message },
        { role: "assistant", content: assistantReply }
      );
    }
  } catch (err) {
    console.error(err);
    uiAddAssistantMessage(
      err.message?.startsWith("Yanıt bekleme süresi")
        ? err.message
        : "Asistana bağlanırken bir sorun oldu. Lütfen tekrar deneyin."
    );
  } finally {
    if (assistantBubble) uiFinishAssistantStream(assistantBubble);
    uiShowTyping(false);
    sendBtnEl.disabled = false;
    newChatBtnEl.disabled = false;
    attachFileBtnEl.disabled = false;
    removeFileBtnEl.disabled = false;
  }
}
