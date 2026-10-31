const API_URL = "https://haking-asistan-backend.onrender.com";

function apiErrorMessage(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.detail === "string" && data.detail) return data.detail;
  if (Array.isArray(data.detail)) return "Gönderdiğiniz bilgileri kontrol edip tekrar deneyin.";
  return fallback;
}

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

  return { ok: res.ok, ...data, message: apiErrorMessage(data, "Giriş yapılamadı.") };
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

  return { ok: res.ok, ...data, message: apiErrorMessage(data, "Kayıt yapılamadı.") };
}

async function apiLogout(token) {
  if (!token) return;
  const response = await fetch(`${API_URL}/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Oturum sunucuda kapatılamadı.");
}

async function apiWarmup() {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);
  uiSetBackendStatus("checking", "Asistan sunucusu hazırlanıyor...");
  try {
    const response = await fetch(`${API_URL}/health`, { signal: controller.signal });
    if (!response.ok) throw new Error("Backend henüz hazır değil.");
    uiSetBackendStatus("ready", "Asistan sunucusu hazır.");
    return await response.json();
  } catch (error) {
    uiSetBackendStatus("error", "Asistan sunucusuna şu anda ulaşılamıyor.");
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

const CHAT_TIMEOUT_MS = 150000;

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
    if (streamError) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }

  return streamError ? { ok: false, message: streamError } : { ok: true };
}

async function apiChat(message, userId, token, history, onChunk) {
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
      body: JSON.stringify({ message, userId, history }),
      signal: controller.signal,
    });

    if (!res.ok) {
      uiSetBackendStatus("error", `Asistan isteği başarısız oldu (HTTP ${res.status}).`);
      let data = {};
      try {
        data = await res.json();
      } catch (error) {
        console.error("Chat hata yanıtı JSON olarak okunamadı:", error);
      }
      return {
        ok: false,
        unauthorized: res.status === 401,
        message: apiErrorMessage(data, "Mesaj gönderilemedi. Lütfen tekrar deneyin."),
      };
    }

    const streamResult = await readChatStream(res, onChunk);
    uiSetBackendStatus(
      streamResult.ok ? "ready" : "error",
      streamResult.ok ? "Asistan sunucusu hazır." : "Asistan modeli şu anda yanıt üretemiyor."
    );
    return streamResult;
  } catch (error) {
    uiSetBackendStatus("error", "Asistan yanıt üretirken bağlantı sorunu oluştu.");
    if (error.name === "AbortError") {
      throw new Error("Yanıt bekleme süresi doldu. Lütfen tekrar deneyin.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
