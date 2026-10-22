// Uygulama başlangıç noktası

const chatInputEl = document.getElementById("chat-input");
const sendBtnEl = document.getElementById("send-btn");
const newChatBtnEl = document.getElementById("new-chat-btn");

document.addEventListener("DOMContentLoaded", () => {
  loadSession();

  if (AppState.email && AppState.token) {
    uiShowChat(AppState.email);
  } else {
    uiShowLogin();
  }
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

  if (!AppState.email) {
    uiAddAssistantMessage("Önce giriş yapmalısın.");
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
  try {
    const result = await apiChat(
      message,
      AppState.email,
      AppState.token,
      (chunk) => {
        if (!hasReceivedChunk) {
          hasReceivedChunk = true;
          uiShowTyping(false);
          assistantBubble = uiCreateAssistantStreamMessage();
        }
        uiAppendAssistantStream(assistantBubble, chunk);
      }
    );

    if (!result.ok) {
      uiAddAssistantMessage(result.message || "Mesaj gönderilemedi. Lütfen tekrar deneyin.");
    } else if (!hasReceivedChunk) {
      uiAddAssistantMessage("Asistan boş bir yanıt verdi. Lütfen tekrar deneyin.");
    }
  } catch (err) {
    console.error(err);
    uiAddAssistantMessage(
      "Canlı asistana bağlanırken bir sorun oluştu. Biraz sonra tekrar deneyin."
    );
  } finally {
    if (assistantBubble) uiFinishAssistantStream(assistantBubble);
    uiShowTyping(false);
    sendBtnEl.disabled = false;
    newChatBtnEl.disabled = false;
  }
}
