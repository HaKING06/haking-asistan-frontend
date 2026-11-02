// UI güncelleme fonksiyonları

const loginCardEl = document.getElementById("login-card");
const chatCardEl = document.getElementById("chat-card");
const chatWindowEl = document.getElementById("chat-window");
const userEmailDisplayEl = document.getElementById("user-email-display");
const profileNameEl = document.getElementById("profile-name");
const userAvatarEl = document.getElementById("user-avatar");
const founderCreditSidebarEl = document.getElementById("founder-credit-sidebar");
const founderCreditSettingsEl = document.getElementById("founder-credit-settings");
const typingIndicatorEl = document.getElementById("typing-indicator");
const backendStatusEl = document.getElementById("backend-status");
const backendStatusLabelEl = document.getElementById("backend-status-label");
const welcomeTemplate = document.getElementById("welcome-state");
const assistantStreamContent = new WeakMap();
let typingStageStartedAt = 0;
let typingStageTimer = null;

function uiSetBackendStatus(state, message) {
  if (!backendStatusEl) return;
  backendStatusEl.dataset.state = state;
  backendStatusEl.title = message;
  if (backendStatusLabelEl) {
    const labels = {
      offline: "Hazır olduğunda bağlanır",
      checking: "Sunucu hazırlanıyor",
      ready: "Asistan hazır",
      error: "Bağlantı kurulamadı",
    };
    backendStatusLabelEl.textContent = labels[state] || "Durum kontrol ediliyor";
  }
}

function uiShowLogin() {
  loginCardEl.classList.remove("hidden");
  chatCardEl.classList.add("hidden");
}

function uiShowChat(email, displayName = "") {
  loginCardEl.classList.add("hidden");
  chatCardEl.classList.remove("hidden");
  const isFounder = String(email || "").trim().toLowerCase() === "gunshalit@gmail.com";
  founderCreditSidebarEl?.classList.toggle("hidden", !isFounder);
  founderCreditSettingsEl?.classList.toggle("hidden", !isFounder);
  const savedConversation = loadChatHistory(email);
  AppState.history = savedConversation.history;
  AppState.incompleteResponse = savedConversation.incompleteResponse;
  AppState.incompleteMode = savedConversation.incompleteMode;
  if (AppState.history.length) {
    chatWindowEl.replaceChildren();
    for (const item of AppState.history) {
      if (item.role === "user") uiAddUserMessage(item.content);
      else uiAddAssistantMessage(item.content);
    }
    if (AppState.incompleteResponse) uiAddContinuationAction();
  } else {
    uiStartNewChat(false);
  }
  userEmailDisplayEl.textContent = email;
  const profileName = String(displayName || "").trim() || email.split("@")[0] || "Geliştirici";
  profileNameEl.textContent = profileName;
  userAvatarEl.textContent = profileName.trim().charAt(0) || "H";
  if (typeof refreshAiCreditBalance === "function") void refreshAiCreditBalance();
}

function uiStartNewChat(clearStored = true) {
  if (clearStored) clearChatHistory(AppState.email);
  AppState.history = [];
  AppState.incompleteResponse = false;
  AppState.incompleteMode = null;
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

function uiAddContinuationAction() {
  const row = document.createElement("div");
  row.className = "continue-response-row";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "continue-response-btn";
  button.dataset.continuePartial = "true";
  button.textContent = AppState.incompleteMode === "crazy"
    ? "Çılgın Mod'da devam et · 10 kredi"
    : "Kaldığın yerden devam et";
  row.appendChild(button);
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
  assistantStreamContent.set(bubble, { content: "", frameId: null });
  uiScrollChat();
  return bubble;
}

function uiAppendAssistantStream(bubble, chunk) {
  const stream = assistantStreamContent.get(bubble);
  if (!stream) return;
  stream.content += chunk;
  if (stream.frameId !== null) return;

  stream.frameId = requestAnimationFrame(() => {
    stream.frameId = null;
    bubble.innerHTML = uiRenderMarkdown(stream.content);
    uiScrollChat();
  });
}

function uiFinishAssistantStream(bubble) {
  const stream = assistantStreamContent.get(bubble);
  if (!stream) return;
  if (stream.frameId !== null) {
    cancelAnimationFrame(stream.frameId);
    stream.frameId = null;
  }
  bubble.innerHTML = uiRenderMarkdown(stream.content);
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
        blocks.push(uiRenderCodeBlock(codeLines.join("\n"), codeLanguage));
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
    blocks.push(uiRenderCodeBlock(codeLines.join("\n"), codeLanguage));
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}

function uiRenderCodeBlock(source, language) {
  return `<div class="code-block"><div class="code-block-header"><span>${uiEscapeHtml(language)}</span><div class="code-block-actions"><button type="button" class="code-action-btn copy-code-btn" data-code-action="copy">Kopyala</button><button type="button" class="code-action-btn download-code-btn" data-code-action="download">İndir</button></div></div><pre tabindex="0"><code>${uiEscapeHtml(source)}</code></pre></div>`;
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

const CODE_DOWNLOAD_NAMES = {
  html: "ornek.html", htm: "ornek.html", css: "main.css", js: "script.js",
  javascript: "script.js", mjs: "script.mjs", cjs: "script.cjs", ts: "script.ts",
  typescript: "script.ts", jsx: "App.jsx", tsx: "App.tsx", py: "ornek.py",
  python: "ornek.py", cs: "Program.cs", csharp: "Program.cs", java: "Main.java",
  c: "main.c", h: "header.h", cpp: "main.cpp", hpp: "header.hpp", go: "main.go",
  rs: "main.rs", rust: "main.rs", php: "index.php", rb: "script.rb", ruby: "script.rb",
  json: "data.json", xml: "data.xml", yaml: "config.yaml", yml: "config.yml",
  sql: "query.sql", sh: "script.sh", bash: "script.sh", vue: "App.vue",
  svelte: "App.svelte", toml: "config.toml", ini: "config.ini", md: "README.md",
  markdown: "README.md", txt: "ornek.txt", text: "ornek.txt",
};

chatWindowEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-code-action]");
  if (!button) return;

  const codeBlock = button.closest(".code-block");
  const code = codeBlock.querySelector("code").textContent;
  if (button.dataset.codeAction === "download") {
    const language = codeBlock.querySelector(".code-block-header > span").textContent.trim().toLowerCase();
    const filename = CODE_DOWNLOAD_NAMES[language] || "ornek.txt";
    const objectUrl = URL.createObjectURL(new Blob([code], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    button.textContent = "İndirildi";
  } else {
    try {
      await navigator.clipboard.writeText(code);
      button.textContent = "Kopyalandı";
    } catch (error) {
      console.error("Kod panoya kopyalanamadı:", error);
      button.textContent = "Kopyalanamadı";
    }
  }
  window.setTimeout(() => {
    button.textContent = button.dataset.codeAction === "download" ? "İndir" : "Kopyala";
  }, 1800);
});

function uiShowTyping(show, mode = "normal") {
  if (show) {
    typingIndicatorEl.classList.remove("hidden");
    typingIndicatorEl.classList.toggle("is-staged", mode === "crazy");
    typingStageStartedAt = performance.now();
    if (typingStageTimer !== null) {
      window.clearInterval(typingStageTimer);
      typingStageTimer = null;
    }
    const elapsed = document.getElementById("typing-stage-elapsed");
    if (elapsed) elapsed.textContent = "00:00";
    if (mode === "crazy") {
      uiSetTypingStage("starting");
      typingStageTimer = window.setInterval(() => {
        if (!elapsed) return;
        const totalSeconds = Math.floor((performance.now() - typingStageStartedAt) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = String(totalSeconds % 60).padStart(2, "0");
        elapsed.textContent = `${String(minutes).padStart(2, "0")}:${seconds}`;
      }, 1000);
    }
  } else {
    typingIndicatorEl.classList.add("hidden");
    typingIndicatorEl.classList.remove("is-staged", "is-waiting", "is-writing");
    if (typingStageTimer !== null) {
      window.clearInterval(typingStageTimer);
      typingStageTimer = null;
    }
  }
}

function uiSetTypingStage(stage) {
  const labels = {
    starting: ["İstek iki aşamada hazırlanıyor", 1],
    briefing_gemini: ["Gemini · istek analiz edilip teknik brief hazırlanıyor", 2],
    briefing_groq: ["Groq · istek analiz edilip teknik brief hazırlanıyor", 2],
    handoff_gemini_groq: ["Gemini'nin brief'i Groq'a aktarılıyor", 3],
    handoff_groq_gemini: ["Groq'un brief'i Gemini'ye aktarılıyor", 3],
    handoff_gemini_gemini: ["Gemini brief'i yanıt modeline aktarılıyor", 3],
    handoff_groq_groq: ["Groq brief'i yanıt modeline aktarılıyor", 3],
    answering_gemini: ["Gemini · brief üzerinden yanıt hazırlanıyor", 3],
    answering_groq: ["Groq · brief üzerinden yanıt hazırlanıyor", 3],
    writing: ["Yanıt yazılıyor", 4],
  };
  const [label, step] = labels[stage] || labels.starting;
  const text = document.getElementById("typing-stage-text");
  const count = document.getElementById("typing-stage-count");
  const progress = document.getElementById("typing-stage-progress");
  typingIndicatorEl.classList.toggle("is-waiting", stage.startsWith("answering_"));
  typingIndicatorEl.classList.toggle("is-writing", stage === "writing");
  if (text) text.textContent = label;
  if (count) count.textContent = `${step}/4`;
  if (progress) progress.style.setProperty("--stage-progress", `${step * 25}%`);
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
