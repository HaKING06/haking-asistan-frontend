// Uygulama başlangıç noktası

const chatInputEl = document.getElementById("chat-input");
const sendBtnEl = document.getElementById("send-btn");
const newChatBtnEl = document.getElementById("new-chat-btn");
const BACKEND_KEEPALIVE_INTERVAL_MS = 10 * 60 * 1000;
let backendKeepaliveTimer = null;

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
    uiShowChat(session.email);
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
  const message = chatInputEl.value.trim();
  if (!message || sendBtnEl.disabled) return;

  if (!AppState.email || !AppState.token) {
    uiShowLogin();
    loginErrorEl.textContent = "Sohbeti kullanmak için hesabına giriş yapmalısın.";
    return;
  }

  uiAddUserMessage(message);
  chatInputEl.value = "";
  chatInputEl.style.height = "auto";
  sendBtnEl.disabled = true;
  newChatBtnEl.disabled = true;
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
      }
    );

    if (!result.ok) {
      if (result.unauthorized) {
        stopBackendKeepAlive();
        clearSession();
        uiShowLogin();
        loginErrorEl.textContent = result.message || "Oturumun sona erdi. Lütfen tekrar giriş yap.";
        return;
      }
      uiAddAssistantMessage(result.message || "Mesaj gönderilemedi. Lütfen tekrar deneyin.");
    } else if (!hasReceivedChunk) {
      uiAddAssistantMessage("Asistan boş bir yanıt verdi. Lütfen tekrar deneyin.");
    } else {
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
  }
}
