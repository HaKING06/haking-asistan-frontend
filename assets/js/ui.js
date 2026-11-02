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
  AppState.incompleteFiles = savedConversation.incompleteFiles;
  if (AppState.history.length) {
    chatWindowEl.replaceChildren();
    for (const item of AppState.history) {
      if (item.role === "user") uiAddUserMessage(item.content);
      else uiAddAssistantMessage(item.content, item.usage);
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
  AppState.incompleteFiles = [];
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

function uiAddAssistantMessage(text, usage = null) {
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
  uiEnhanceAssistantMessage(bubble, usage);

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

function uiFinishAssistantStream(bubble, usage = null) {
  const stream = assistantStreamContent.get(bubble);
  if (!stream) return;
  if (stream.frameId !== null) {
    cancelAnimationFrame(stream.frameId);
    stream.frameId = null;
  }
  bubble.innerHTML = uiRenderMarkdown(stream.content);
  uiEnhanceAssistantMessage(bubble, usage);
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
  let codeFilename = "";
  let pendingCodeFilename = "";
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
    const fence = line.match(/^\s*```([\w.+-]*)(?:\s+(.+?))?\s*$/);
    if (fence && !inCodeBlock) {
      flushParagraph();
      flushList();
      inCodeBlock = true;
      codeLanguage = fence[1] || "code";
      codeFilename = uiExtractProjectFilename(fence[2]) || pendingCodeFilename;
      pendingCodeFilename = "";
      codeLines = [];
      continue;
    }
    if (inCodeBlock) {
      if (/^\s*```\s*$/.test(line)) {
        blocks.push(uiRenderCodeBlock(codeLines.join("\n"), codeLanguage, codeFilename));
        inCodeBlock = false;
        codeFilename = "";
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
      if (/^(?:dosya(?:\s+adı)?|file)\s*[:=-]/i.test(heading[2])) {
        pendingCodeFilename = uiExtractProjectFilename(heading[2]) || "";
      }
      continue;
    }
    if (/^\s*(?:dosya(?:\s+adı)?|file)\s*[:=-]/i.test(line)) {
      pendingCodeFilename = uiExtractProjectFilename(line) || "";
    }
    paragraph.push(line);
  }

  if (inCodeBlock) {
    blocks.push(uiRenderCodeBlock(codeLines.join("\n"), codeLanguage, codeFilename));
  }
  flushParagraph();
  flushList();
  return blocks.join("");
}

function uiRenderCodeBlock(source, language, filename = "") {
  const safeFilename = uiSafeProjectPath(filename);
  const label = safeFilename || language;
  const previewButton = language.toLowerCase() === "html" || /\.html?$/i.test(safeFilename)
    ? '<button type="button" class="code-action-btn preview-code-btn" data-code-action="preview" aria-expanded="false">Önizle</button>'
    : "";
  return `<div class="code-block" data-language="${uiEscapeHtml(language.toLowerCase())}"${safeFilename ? ` data-file-name="${uiEscapeHtml(safeFilename)}"` : ""}><div class="code-block-header"><span title="${uiEscapeHtml(safeFilename || language)}">${uiEscapeHtml(label)}</span><div class="code-block-actions">${previewButton}<button type="button" class="code-action-btn copy-code-btn" data-code-action="copy">Kopyala</button><button type="button" class="code-action-btn download-code-btn" data-code-action="download">İndir</button></div></div><pre tabindex="0"><code>${uiEscapeHtml(source)}</code></pre></div>`;
}

function uiExtractProjectFilename(value) {
  const text = String(value || "").replace(/`/g, "");
  const match = text.match(/(?:^|[^\w./-])((?:[\w.@+-]+\/)*[\w.@+-]+\.(?:html?|css|mjs|cjs|js|jsx|ts|tsx|json|py|java|cs|cpp|c|h|hpp|go|rs|php|rb|vue|svelte|md|ya?ml|toml|sql|sh|txt))(?=$|[^\w.-])/i);
  return match ? uiSafeProjectPath(match[1]) : "";
}

function uiSafeProjectPath(value) {
  const raw = String(value || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
  if (!raw || raw.length > 180) return "";
  const segments = raw.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return "";
  const safeSegments = segments.map((segment) => segment
    .replace(/[\x00-\x1f<>:"|?*]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim());
  if (safeSegments.some((segment) => !segment || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) return "";
  return safeSegments.join("/").slice(0, 180);
}

const PROJECT_PROVIDER_LABELS = { tavily: "Tavily", gemini: "Gemini", groq: "Groq" };

function uiFormatProviderUsage(usage) {
  if (!usage || typeof usage !== "object") return "";
  const providerName = (id) => PROJECT_PROVIDER_LABELS[id] || "";
  const production = [...new Set((Array.isArray(usage.production) ? usage.production : []).map(providerName).filter(Boolean))];
  if (usage.mode === "crazy") {
    const research = usage.research === "tavily" ? "Tavily" : usage.research === "unavailable" ? "Tavily erişilemedi" : "kullanılmadı";
    const brief = providerName(usage.brief) || "belirtilmedi";
    const generator = production.length > 1 ? `${production.join(" → ")} (yedek dahil)` : production[0] || "belirtilmedi";
    return `Araştırma: ${research} · Brief: ${brief} · Üretim: ${generator}`;
  }
  const generator = production.length > 1 ? `${production.join(" → ")} (yedek dahil)` : production[0] || "belirtilmedi";
  return `Araştırma: kullanılmadı · Brief: kullanılmadı · Üretim: ${generator}`;
}

function uiEnhanceAssistantMessage(bubble, usage = null) {
  const namedBlocks = [...bubble.querySelectorAll(".code-block[data-file-name]")];
  for (const block of bubble.querySelectorAll(".code-block")) uiPrepareCodePreview(block);
  if (namedBlocks.length > 1) uiBuildProjectWorkspace(namedBlocks);
  const detail = uiFormatProviderUsage(usage);
  if (detail) {
    const footer = document.createElement("div");
    footer.className = "assistant-usage";
    footer.textContent = detail;
    footer.setAttribute("aria-label", `Yanıt sağlayıcıları: ${detail}`);
    bubble.appendChild(footer);
  }
}

function uiPrepareCodePreview(block) {
  if (block.dataset.previewReady || (block.dataset.language !== "html" && !/\.html?$/i.test(block.dataset.fileName || ""))) return;
  block.dataset.previewReady = "true";
  const panel = document.createElement("div");
  panel.className = "code-preview-panel hidden";
  panel.innerHTML = '<p class="preview-security-note">Sandbox önizleme · ağ erişimi ve site oturumu kapalı</p><iframe title="Üretilen HTML güvenli önizleme" sandbox="allow-scripts" referrerpolicy="no-referrer" loading="lazy"></iframe>';
  block.appendChild(panel);
}

function uiBuildProjectWorkspace(codeBlocks) {
  const first = codeBlocks[0];
  if (!first?.parentNode || first.closest(".project-workspace")) return;
  const workspace = document.createElement("section");
  workspace.className = "project-workspace";
  workspace.setAttribute("aria-label", "Oluşturulan proje dosyaları");
  first.parentNode.insertBefore(workspace, first);
  const toolbar = document.createElement("div");
  toolbar.className = "project-workspace-toolbar";
  const heading = document.createElement("strong");
  heading.textContent = "Proje dosyaları";
  const download = document.createElement("button");
  download.type = "button";
  download.className = "code-action-btn project-zip-btn";
  download.dataset.codeAction = "zip";
  download.textContent = "ZIP indir";
  toolbar.append(heading, download);
  const tabs = document.createElement("div");
  tabs.className = "project-file-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Proje dosyaları");
  const panels = document.createElement("div");
  panels.className = "project-file-panels";
  const usedNames = new Set();

  codeBlocks.forEach((block, index) => {
    let filename = uiSafeProjectPath(block.dataset.fileName) || `dosya-${index + 1}.txt`;
    const original = filename;
    let suffix = 2;
    while (usedNames.has(filename.toLowerCase())) {
      const dot = original.lastIndexOf(".");
      filename = dot > original.lastIndexOf("/")
        ? `${original.slice(0, dot)}-${suffix}${original.slice(dot)}`
        : `${original}-${suffix}`;
      suffix += 1;
    }
    usedNames.add(filename.toLowerCase());
    block.dataset.fileName = filename;
    const id = `project-file-${Math.random().toString(36).slice(2, 10)}`;
    const tab = document.createElement("button");
    tab.type = "button";
    tab.className = "project-file-tab";
    tab.id = `${id}-tab`;
    tab.dataset.projectFileTab = id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", id);
    tab.setAttribute("aria-selected", String(index === 0));
    tab.tabIndex = index === 0 ? 0 : -1;
    tab.textContent = filename;
    const panel = document.createElement("div");
    panel.className = "project-file-panel";
    panel.id = id;
    panel.dataset.projectFilePanel = id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", `${id}-tab`);
    panel.hidden = index !== 0;
    panel.appendChild(block);
    tabs.appendChild(tab);
    panels.appendChild(panel);
  });

  workspace.append(toolbar, tabs, panels);
}

function uiSafePreviewDocument(html, blocks, entryFilename = "index.html") {
  const document = new DOMParser().parseFromString(String(html), "text/html");
  const files = new Map(blocks.map((block) => [uiSafeProjectPath(block.dataset.fileName).toLowerCase(), block.querySelector("code")?.textContent || ""]));
  const baseUrl = `https://preview.invalid/${uiSafeProjectPath(entryFilename) || "index.html"}`;
  const resolveFile = (value) => {
    try {
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(String(value || "").trim())) return undefined;
      const path = new URL(value, baseUrl).pathname.replace(/^\/+/, "");
      const normalized = uiSafeProjectPath(decodeURIComponent(path));
      return normalized ? files.get(normalized.toLowerCase()) : undefined;
    } catch {
      return undefined;
    }
  };

  for (const link of [...document.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const stylesheet = resolveFile(link.getAttribute("href"));
    if (stylesheet === undefined) link.remove();
    else {
      const style = document.createElement("style");
      style.textContent = stylesheet;
      link.replaceWith(style);
    }
  }
  for (const script of [...document.querySelectorAll("script[src]")]) {
    const source = resolveFile(script.getAttribute("src"));
    if (source === undefined) script.remove();
    else {
      script.removeAttribute("src");
      script.textContent = source;
    }
  }
  document.querySelectorAll('meta[http-equiv="Content-Security-Policy" i]').forEach((node) => node.remove());
  document.querySelectorAll('meta[http-equiv="refresh" i]').forEach((node) => node.remove());
  let head = document.head;
  if (!head) {
    head = document.createElement("head");
    document.documentElement.prepend(head);
  }
  const policy = document.createElement("meta");
  policy.httpEquiv = "Content-Security-Policy";
  policy.content = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'";
  head.prepend(policy);
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
}

function uiToggleCodePreview(button, block) {
  const panel = block.querySelector(".code-preview-panel");
  const frame = panel?.querySelector("iframe");
  if (!panel || !frame) return;
  const opening = panel.classList.contains("hidden");
  if (opening) {
    const workspace = block.closest(".project-workspace");
    const files = workspace ? [...workspace.querySelectorAll(".project-file-panel .code-block")] : [block];
    const htmlBlock = files.find((file) => file.dataset.language === "html" || /\.html?$/i.test(file.dataset.fileName || ""));
    if (!htmlBlock) return;
    frame.srcdoc = uiSafePreviewDocument(htmlBlock.querySelector("code")?.textContent || "", files, htmlBlock.dataset.fileName);
  } else {
    frame.srcdoc = "";
  }
  panel.classList.toggle("hidden", !opening);
  button.setAttribute("aria-expanded", String(opening));
  button.textContent = opening ? "Önizlemeyi kapat" : "Önizle";
}

const ZIP_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function uiZipCrc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = ZIP_CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function uiZipProject(files) {
  const encoder = new TextEncoder();
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate = ((Math.max(1980, now.getFullYear()) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;
  let totalSize = 0;
  let fileCount = 0;
  for (const file of files) {
    const name = uiSafeProjectPath(file.dataset.fileName);
    if (!name) continue;
    const nameBytes = encoder.encode(name);
    const contentBytes = encoder.encode(file.querySelector("code")?.textContent || "");
    totalSize += contentBytes.length;
    fileCount += 1;
    if (totalSize > 10 * 1024 * 1024 || fileCount > 50) throw new Error("ZIP en fazla 50 dosya ve toplam 10 MB içerebilir.");
    const crc = uiZipCrc32(contentBytes);
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
    lv.setUint16(8, 0, true); lv.setUint16(10, dosTime, true); lv.setUint16(12, dosDate, true);
    lv.setUint32(14, crc, true); lv.setUint32(18, contentBytes.length, true); lv.setUint32(22, contentBytes.length, true);
    lv.setUint16(26, nameBytes.length, true); lv.setUint16(28, 0, true); local.set(nameBytes, 30);
    localParts.push(local, contentBytes);
    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true); cv.setUint16(12, dosTime, true); cv.setUint16(14, dosDate, true);
    cv.setUint32(16, crc, true); cv.setUint32(20, contentBytes.length, true); cv.setUint32(24, contentBytes.length, true);
    cv.setUint16(28, nameBytes.length, true); cv.setUint16(30, 0, true); cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true); cv.setUint16(36, 0, true); cv.setUint32(38, 0, true); cv.setUint32(42, localOffset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);
    localOffset += local.length + contentBytes.length;
  }
  if (!fileCount) throw new Error("İndirilecek proje dosyası bulunamadı.");
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(4, 0, true); ev.setUint16(6, 0, true);
  ev.setUint16(8, localParts.length / 2, true); ev.setUint16(10, localParts.length / 2, true);
  ev.setUint32(12, centralSize, true); ev.setUint32(16, localOffset, true); ev.setUint16(20, 0, true);
  return new Blob([...localParts, ...centralParts, end], { type: "application/zip" });
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
  const tab = event.target.closest("[data-project-file-tab]");
  if (tab) {
    const workspace = tab.closest(".project-workspace");
    const targetId = tab.dataset.projectFileTab;
    workspace?.querySelectorAll(".code-preview-panel iframe").forEach((frame) => { frame.srcdoc = ""; });
    workspace?.querySelectorAll('[data-code-action="preview"]').forEach((button) => {
      button.setAttribute("aria-expanded", "false");
      button.textContent = "Önizle";
    });
    workspace?.querySelectorAll(".code-preview-panel").forEach((panel) => panel.classList.add("hidden"));
    workspace?.querySelectorAll("[data-project-file-tab]").forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    workspace?.querySelectorAll("[data-project-file-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.projectFilePanel !== targetId;
    });
    return;
  }

  const button = event.target.closest("[data-code-action]");
  if (!button) return;
  if (button.dataset.codeAction === "zip") {
    try {
      const blob = uiZipProject([...button.closest(".project-workspace").querySelectorAll(".project-file-panel .code-block")]);
      uiDownloadBlob(blob, "haking-proje.zip");
      button.textContent = "ZIP indirildi";
    } catch (error) {
      button.textContent = error.message || "ZIP oluşturulamadı";
    }
    window.setTimeout(() => { button.textContent = "ZIP indir"; }, 2200);
    return;
  }

  const codeBlock = button.closest(".code-block");
  if (!codeBlock) return;
  if (button.dataset.codeAction === "preview") {
    uiToggleCodePreview(button, codeBlock);
    return;
  }
  const code = codeBlock.querySelector("code")?.textContent || "";
  if (button.dataset.codeAction === "download") {
    const language = codeBlock.dataset.language || "txt";
    const filename = uiSafeProjectPath(codeBlock.dataset.fileName) || CODE_DOWNLOAD_NAMES[language] || "ornek.txt";
    uiDownloadBlob(new Blob([code], { type: "text/plain;charset=utf-8" }), filename);
    button.textContent = "İndirildi";
  } else if (button.dataset.codeAction === "copy") {
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

function uiDownloadBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

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
    continuing_response: ["Önceki yanıtın kaldığı yer sürdürülüyor", 3],
    researching_tavily: ["Web araştırması · proje gereksinimleri ve kaynaklar inceleniyor", 2],
    research_unavailable: ["Web araştırması erişilemiyor · AI planlamasıyla sürüyor", 2],
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
  typingIndicatorEl.classList.toggle(
    "is-waiting",
    stage.startsWith("answering_") || stage === "researching_tavily" || stage === "continuing_response"
  );
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
