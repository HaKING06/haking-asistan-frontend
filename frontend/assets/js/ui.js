// UI güncelleme fonksiyonları

const loginCardEl = document.getElementById("login-card");
const chatCardEl = document.getElementById("chat-card");
const chatWindowEl = document.getElementById("chat-window");
const userEmailDisplayEl = document.getElementById("user-email-display");
const profileNameEl = document.getElementById("profile-name");
const userAvatarEl = document.getElementById("user-avatar");
const typingIndicatorEl = document.getElementById("typing-indicator");
const welcomeTemplate = document.getElementById("welcome-state");
const assistantStreamContent = new WeakMap();

function uiShowLogin() {
  loginCardEl.classList.remove("hidden");
  chatCardEl.classList.add("hidden");
}

function uiShowChat(email) {
  loginCardEl.classList.add("hidden");
  chatCardEl.classList.remove("hidden");
  if (!chatWindowEl.firstElementChild) uiStartNewChat();
  userEmailDisplayEl.textContent = email;
  const profileName = email.split("@")[0] || "Geliştirici";
  profileNameEl.textContent = profileName;
  userAvatarEl.textContent = profileName.trim().charAt(0) || "H";
}

function uiStartNewChat() {
  chatWindowEl.replaceChildren(welcomeTemplate.cloneNode(true));
  chatWindowEl.scrollTop = 0;
}

function uiAddUserMessage(text) {
  document.getElementById("welcome-state")?.remove();
  const time = uiGetTime();
  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `Sen • ${time}`;

  const row = document.createElement("div");
  row.className = "message-row user";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.textContent = text;

  row.appendChild(bubble);
  chatWindowEl.appendChild(meta);
  chatWindowEl.appendChild(row);
  uiScrollChat();
}

function uiAddAssistantMessage(text) {
  document.getElementById("welcome-state")?.remove();
  const time = uiGetTime();
  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `Asistan • ${time}`;

  const row = document.createElement("div");
  row.className = "message-row assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  bubble.innerHTML = uiRenderMarkdown(text);

  row.appendChild(bubble);
  chatWindowEl.appendChild(meta);
  chatWindowEl.appendChild(row);
  uiScrollChat();
}

function uiCreateAssistantStreamMessage() {
  document.getElementById("welcome-state")?.remove();
  const meta = document.createElement("div");
  meta.className = "message-meta";
  meta.textContent = `HaKING • ${uiGetTime()}`;

  const row = document.createElement("div");
  row.className = "message-row assistant";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  row.appendChild(bubble);
  chatWindowEl.append(meta, row);
  assistantStreamContent.set(bubble, "");
  uiScrollChat();
  return bubble;
}

function uiAppendAssistantStream(bubble, chunk) {
  const content = assistantStreamContent.get(bubble) + chunk;
  assistantStreamContent.set(bubble, content);
  bubble.innerHTML = uiRenderMarkdown(content);
  uiScrollChat();
}

function uiRenderMarkdown(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [];
  let listItems = [];
  let listTag = "";
  let inCodeBlock = false;
  let codeLanguage = "";
  let codeLines = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(uiRenderInline).join("<br>")}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (!listItems.length) return;
    blocks.push(`<${listTag}>${listItems.map((item) => `<li>${uiRenderInline(item)}</li>`).join("")}</${listTag}>`);
    listItems = [];
    listTag = "";
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```([\w.+-]*)\s*$/);
    if (fence && !inCodeBlock) {
      flushParagraph();
      flushList();
      inCodeBlock = true;
      codeLanguage = fence[1] || "code";
      codeLines = [];
      continue;
    }
    if (inCodeBlock) {
      if (/^\s*```\s*$/.test(line)) {
        const code = uiEscapeHtml(codeLines.join("\n"));
        blocks.push(
          `<div class="code-block"><div class="code-block-header"><span>${uiEscapeHtml(codeLanguage)}</span><button type="button" class="copy-code-btn">Kopyala</button></div><pre><code>${code}</code></pre></div>`
        );
        inCodeBlock = false;
        continue;
      }
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextTag = unordered ? "ul" : "ol";
      if (listTag && listTag !== nextTag) flushList();
      listTag = nextTag;
      listItems.push((unordered || ordered)[1]);
      continue;
    }

    flushList();
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1].length + 1;
      blocks.push(`<h${level}>${uiRenderInline(heading[2])}</h${level}>`);
      continue;
    }
    paragraph.push(line);
  }

  if (inCodeBlock) {
    blocks.push(
      `<div class="code-block"><div class="code-block-header"><span>${uiEscapeHtml(codeLanguage)}</span><button type="button" class="copy-code-btn">Kopyala</button></div><pre><code>${uiEscapeHtml(codeLines.join("\n"))}</code></pre></div>`
    );
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}

function uiRenderInline(text) {
  let safeText = uiEscapeHtml(text);
  const codeTokens = [];
  safeText = safeText.replace(/`([^`]+)`/g, (_, code) => {
    const token = `\u0000${codeTokens.length}\u0000`;
    codeTokens.push(`<code>${code}</code>`);
    return token;
  });
  safeText = safeText
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=$|[\s).,!?:;])/g, "$1<em>$2</em>");
  return safeText.replace(/\u0000(\d+)\u0000/g, (_, index) => codeTokens[Number(index)]);
}

function uiEscapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

chatWindowEl.addEventListener("click", async (event) => {
  const button = event.target.closest(".copy-code-btn");
  if (!button) return;

  const code = button.closest(".code-block").querySelector("code").textContent;
  try {
    await navigator.clipboard.writeText(code);
    button.textContent = "Kopyalandı";
  } catch (error) {
    console.error("Kod panoya kopyalanamadı:", error);
    button.textContent = "Kopyalanamadı";
  }
  window.setTimeout(() => {
    button.textContent = "Kopyala";
  }, 1800);
});

function uiShowTyping(show) {
  if (show) typingIndicatorEl.classList.remove("hidden");
  else typingIndicatorEl.classList.add("hidden");
}

function uiScrollChat() {
  chatWindowEl.scrollTop = chatWindowEl.scrollHeight;
}

function uiGetTime() {
  const d = new Date();
  let h = d.getHours();
  let m = d.getMinutes();
  if (m < 10) m = "0" + m;
  return `${h}:${m}`;
}
