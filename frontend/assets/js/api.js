const API_URL = "https://haking-asistan-backend.onrender.com";

async function apiLogin(email, password) {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Login JSON parse hatası:", e);
  }

  return { ok: res.ok, ...data };
}

async function apiRegister(email, password, name) {
  const res = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Register JSON parse hatası:", e);
  }

  return { ok: res.ok, ...data };
}

const CHAT_TIMEOUT_MS = 90000;

async function readChatStream(response, onChunk) {
  if (!response.body) {
    throw new Error("Sunucu akış yanıtı göndermedi.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError = "";

  const processEvent = (eventText) => {
    let eventType = "message";
    const data = [];
    for (const line of eventText.split(/\r?\n/)) {
      if (line.startsWith("event:")) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data.push(line.slice(5).replace(/^ /, ""));
      }
    }
    if (!data.length) return;

    const text = data.join("\n");
    if (eventType === "error") {
      streamError = text || "Asistan yanıt üretirken bir hata oluştu.";
    } else if (eventType === "message") {
      onChunk(text);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const eventText of events) {
        processEvent(eventText);
        if (streamError) break;
      }

      if (done) {
        if (buffer.trim()) processEvent(buffer);
        break;
      }
      if (streamError) break;
    }
  } finally {
    if (streamError) await reader.cancel();
    reader.releaseLock();
  }

  return streamError ? { ok: false, message: streamError } : { ok: true };
}

async function apiChat(message, userId, token, onChunk) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ message, userId }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let data = {};
      try {
        data = await res.json();
      } catch (error) {
        console.error("Chat hata yanıtı JSON olarak okunamadı:", error);
      }
      return {
        ok: false,
        message: data.detail || data.message || "Mesaj gönderilemedi. Lütfen tekrar deneyin.",
      };
    }

    return await readChatStream(res, onChunk);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
