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

async function apiChat(message, userId, token, onChunk) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, userId }),
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

  if (!res.body) {
    throw new Error("Sunucu akış yanıtı göndermedi.");
  }

  const reader = res.body.getReader();
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
