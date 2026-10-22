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
const CHAT_RETRY_DELAY_MS = 2000;
const CHAT_RETRYABLE_STATUSES = new Set([500, 502, 504]);

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function readChatStream(response, onChunk, markChunkReceived) {
  if (!response.body) {
    throw new Error("Sunucu akış yanıtı göndermedi.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError = null;
  let completed = false;

  const processEvent = (eventText) => {
    const data = eventText
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!data) return;

    let event;
    try {
      event = JSON.parse(data);
    } catch (error) {
      console.error("Sohbet akışı olayı çözümlenemedi:", error);
      throw new Error("Sunucudan geçersiz bir sohbet akışı alındı.");
    }

    if (event.type === "chunk") {
      if (typeof event.text !== "string") {
        throw new Error("Sunucudan geçersiz bir metin parçası alındı.");
      }
      markChunkReceived();
      onChunk(event.text);
    } else if (event.type === "error") {
      streamError = event.message || "Asistan yanıt üretirken bir hata oluştu.";
    } else if (event.type === "done") {
      completed = true;
    }
  };

  try {
    while (!completed) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || "";
      for (const eventText of events) {
        processEvent(eventText);
        if (completed || streamError) break;
      }

      if (done) {
        if (buffer.trim()) processEvent(buffer);
        break;
      }
      if (streamError) break;
    }
  } finally {
    reader.releaseLock();
  }

  if (streamError) return { ok: false, message: streamError };
  if (!completed) {
    throw new Error("Asistan yanıt akışı beklenmedik şekilde sonlandı.");
  }
  return { ok: true };
}

async function apiChat(message, userId, token, onChunk) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    let timeoutId;
    let receivedChunk = false;

    try {
      timeoutId = window.setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS);
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message, userId }),
        signal: controller.signal,
      });

      if (attempt === 0 && CHAT_RETRYABLE_STATUSES.has(res.status)) {
        await res.body?.cancel();
        await wait(CHAT_RETRY_DELAY_MS);
        continue;
      }

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

      return await readChatStream(res, onChunk, () => {
        receivedChunk = true;
      });
    } catch (error) {
      const retryableNetworkError =
        error?.name === "TypeError" || error?.name === "AbortError";
      if (attempt === 0 && !receivedChunk && retryableNetworkError) {
        await wait(CHAT_RETRY_DELAY_MS);
        continue;
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  return { ok: false, message: "Mesaj gönderilemedi. Lütfen tekrar deneyin." };
}
