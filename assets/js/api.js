const API_URL = "https://haking-asistan-backend.onrender.com";

function apiErrorMessage(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (typeof data.message === "string" && data.message) return data.message;
  if (typeof data.detail === "string" && data.detail) return data.detail;
  if (Array.isArray(data.detail)) {
    const issue = data.detail.find((item) => item && Array.isArray(item.loc)) || data.detail[0];
    const field = issue?.loc?.at(-1);
    const type = issue?.type;

    if (field === "code" && type === "string_pattern_mismatch") {
      return "E-postadaki 6 haneli doğrulama kodunu gir.";
    }

    if (field === "attachment_content" && type === "string_too_long") {
      return "Dosya metni 64 KiB sınırını aşıyor. Daha küçük bir dosya seç.";
    }
    if (field === "attachment_name" && type === "string_too_long") {
      return "Dosya adı çok uzun.";
    }
    if ((field === "attachment_name" || field === "attachment_content") && type === "value_error") {
      return String(issue?.msg || "Dosya doğrulanamadı.").replace(/^Value error,\s*/i, "");
    }
    if (field === "password" && type === "string_too_short") {
      return "Şifre en az 8 karakter olmalıdır.";
    }
    if (field === "password" && type === "string_too_long") {
      return "Şifre en fazla 128 karakter olabilir.";
    }
    if (field === "email" && type === "string_too_long") {
      return "E-posta adresi en fazla 254 karakter olabilir.";
    }
    if (field === "name" && type === "string_too_long") {
      return "Ad soyad en fazla 80 karakter olabilir.";
    }
    if (field === "name" && type === "value_error") {
      return String(issue?.msg || "Ad soyad geçerli değil.").replace(/^Value error,\s*/i, "");
    }
    if (field === "email" && type === "value_error") {
      return String(issue?.msg || "Geçerli bir e-posta adresi gir.").replace(/^Value error,\s*/i, "");
    }
    if (field === "name" && type === "missing") {
      return "Kayıt için ad soyad girmen gerekiyor.";
    }
    if (field === "adult_confirmed" && ["missing", "value_error"].includes(type)) {
      return String(issue?.msg || "Bu hizmet yalnızca 18 yaşını doldurmuş kullanıcılar içindir.")
        .replace(/^Value error,\s*/i, "");
    }
    return "Gönderdiğin bilgileri kontrol edip tekrar dene.";
  }
  return fallback;
}

async function apiLogin(email, password, adultConfirmed) {
  const res = await fetch(`${API_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, adult_confirmed: adultConfirmed }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Login JSON parse hatası:", e);
  }

  return {
    ok: res.ok,
    status: res.status,
    requestId: res.headers.get("X-Request-ID"),
    ...data,
    message: apiErrorMessage(data, "Giriş yapılamadı."),
  };
}

async function apiRegister(email, password, name, adultConfirmed) {
  const res = await fetch(`${API_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, adult_confirmed: adultConfirmed }),
  });

  let data = {};
  try {
    data = await res.json();
  } catch (e) {
    console.error("Register JSON parse hatası:", e);
  }

  return {
    ok: res.ok,
    status: res.status,
    requestId: res.headers.get("X-Request-ID"),
    ...data,
    message: apiErrorMessage(data, "Kayıt yapılamadı."),
  };
}

async function apiVerifyRegistration(email, code, verificationToken = null, emailLinkToken = null, adultConfirmed = false) {
  const response = await fetch(`${API_URL}/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code, verification_token: verificationToken, email_link_token: emailLinkToken, adult_confirmed: adultConfirmed }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    console.error("Doğrulama yanıtı JSON olarak okunamadı:", error);
  }
  return {
    ok: response.ok,
    status: response.status,
    requestId: response.headers.get("X-Request-ID"),
    ...data,
    message: apiErrorMessage(data, "E-posta doğrulanamadı."),
  };
}

async function apiResendRegistrationCode(email, verificationToken = null, emailLinkToken = null) {
  const response = await fetch(`${API_URL}/register/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, verification_token: verificationToken, email_link_token: emailLinkToken }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    console.error("Kod yenileme yanıtı JSON olarak okunamadı:", error);
  }
  return { ok: response.ok, ...data, message: apiErrorMessage(data, "Yeni kod gönderilemedi.") };
}

async function apiRegistrationLink(emailLinkToken) {
  const response = await fetch(`${API_URL}/register/link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email_link_token: emailLinkToken }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    console.error("Doğrulama bağlantısı yanıtı JSON olarak okunamadı:", error);
  }
  return { ok: response.ok, ...data, message: apiErrorMessage(data, "Doğrulama bağlantısı açılamadı.") };
}

async function apiRegistrationStatus(verificationToken) {
  const response = await fetch(`${API_URL}/register/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verification_token: verificationToken }),
  });
  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    console.error("Doğrulama durumu JSON olarak okunamadı:", error);
  }
  return { ok: response.ok, ...data, message: apiErrorMessage(data, "Doğrulama durumu alınamadı.") };
}

async function apiValidateSession(token) {
  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 90000);
    try {
      const response = await fetch(`${API_URL}/session`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      let data = {};
      try {
        data = await response.json();
      } catch (error) {
        console.error("Oturum yanıtı JSON olarak okunamadı:", error);
      }

      return {
        ok: response.ok && data.success === true && typeof data.email === "string",
        unauthorized: response.status === 401,
        email: data.email,
        name: data.name,
        message: apiErrorMessage(data, "Oturum doğrulanamadı. Lütfen yeniden giriş yap."),
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Oturum kontrolü zaman aşımına uğradı.");
    }
    throw error;
  }
}

async function apiLogout(token) {
  if (!token) return;
  const response = await fetch(`${API_URL}/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error("Oturum sunucuda kapatılamadı.");
}

async function apiRequestPasswordReset(email) {
  const response = await fetch(`${API_URL}/password/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, requestId: response.headers.get("X-Request-ID"), ...data, message: apiErrorMessage(data, "İstek tamamlanamadı.") };
}

async function apiResetPassword(token, password) {
  const response = await fetch(`${API_URL}/password/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Şifre güncellenemedi.") };
}

async function apiRequestAccountDeletion(token) {
  const response = await fetch(`${API_URL}/account/deletion/request`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Hesap silme e-postası gönderilemedi.") };
}

async function apiAccountDeletionStatus(token) {
  const response = await fetch(`${API_URL}/account/deletion/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Onay bağlantısı doğrulanamadı.") };
}

async function apiConfirmAccountDeletion(token, password) {
  const response = await fetch(`${API_URL}/account/deletion/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Hesap silinemedi.") };
}

async function apiGetProviderCatalog() {
  const response = await fetch(`${API_URL}/ai/providers`, { cache: "no-store" });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, ...data };
}

async function apiGetAiCredits(token) {
  const response = await fetch(`${API_URL}/ai/credits`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return {
    ok: response.ok,
    status: response.status,
    ...data,
    message: apiErrorMessage(data, "Kredi bakiyesi alınamadı."),
  };
}

async function apiAdminGetCreditPackage(token) {
  const response = await fetch(`${API_URL}/admin/credits/package`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Paket bilgisi alınamadı.") };
}

async function apiAdminGetCreditAccount(token, email) {
  const response = await fetch(API_URL + "/admin/credits/account", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
    cache: "no-store",
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Hesap bilgisi alınamadı.") };
}

async function apiAdminGrantCredits(token, email, orderReference) {
  const response = await fetch(`${API_URL}/admin/credits/grants`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, order_reference: orderReference, payment_verified: true }),
    cache: "no-store",
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "Kredi eklenemedi.") };
}

async function apiAdminResendCreditEmail(token, grantId) {
  const response = await fetch(`${API_URL}/admin/credits/grants/${encodeURIComponent(grantId)}/notify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  let data = {};
  try { data = await response.json(); } catch {}
  return { ok: response.ok, status: response.status, ...data, message: apiErrorMessage(data, "E-posta gönderilemedi.") };
}

let backendWarmupPromise = null;

function apiWarmup() {
  if (backendWarmupPromise) return backendWarmupPromise;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);
  uiSetBackendStatus("checking", "Asistan sunucusu hazırlanıyor...");
  backendWarmupPromise = (async () => {
    try {
      const response = await fetch(`${API_URL}/`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Backend henüz hazır değil.");
      uiSetBackendStatus("ready", "Asistan sunucusu hazır.");
      return await response.json();
    } catch (error) {
      uiSetBackendStatus("error", "Asistan sunucusuna şu anda ulaşılamıyor.");
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  })().finally(() => {
    backendWarmupPromise = null;
  });

  return backendWarmupPromise;
}

let backendKeepAlivePromise = null;

function apiKeepAlive() {
  if (
    !AppState.token ||
    !AppState.email ||
    document.visibilityState !== "visible" ||
    backendWarmupPromise
  ) {
    return Promise.resolve();
  }
  if (backendKeepAlivePromise) return backendKeepAlivePromise;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 90000);
  backendKeepAlivePromise = (async () => {
    try {
      // A tiny API-root request wakes and keeps Render active without querying Neon or Gemini.
      const response = await fetch(`${API_URL}/`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Backend ping returned HTTP ${response.status}.`);
      uiSetBackendStatus("ready", "Asistan sunucusu aktif.");
    } catch (error) {
      uiSetBackendStatus("error", "Asistan sunucusuna ulaşılamadı; tekrar kontrol edilecek.");
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  })().finally(() => {
    backendKeepAlivePromise = null;
  });

  return backendKeepAlivePromise;
}

const CHAT_TIMEOUT_MS = 480000;

async function readChatStream(response, onChunk, onStage = () => {}, onUsage = () => {}) {
  if (!response.body) {
    throw new Error("Sunucu akış yanıtı göndermedi.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError = "";
  let receivedDone = false;
  let requiresDoneEvent = false;

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
    } else if (eventType === "protocol") {
      requiresDoneEvent = text === "done-v1";
    } else if (eventType === "done") {
      receivedDone = true;
    } else if (eventType === "stage") {
      const labels = {
        starting: "İsteğin inceleniyor",
        continuing_response: "Önceki yanıtın kaldığı yer sürdürülüyor",
        researching_tavily: "Web araştırması · proje gereksinimleri ve kaynaklar inceleniyor",
        research_unavailable: "Web araştırması erişilemiyor · AI planlamasıyla devam ediliyor",
        briefing_gemini: "Gemini · istek analiz edilip teknik brief hazırlanıyor",
        briefing_groq: "Groq · istek analiz edilip teknik brief hazırlanıyor",
        handoff_gemini_groq: "Gemini'nin hazırladığı brief Groq'a aktarılıyor",
        handoff_groq_gemini: "Groq'un hazırladığı brief Gemini'ye aktarılıyor",
        handoff_gemini_gemini: "Gemini brief'i yanıt modeline aktarılıyor",
        handoff_groq_groq: "Groq brief'i yanıt modeline aktarılıyor",
        answering_gemini: "Gemini · brief üzerinden yanıt hazırlanıyor",
        answering_groq: "Groq · brief üzerinden yanıt hazırlanıyor",
        writing: "Yanıt yazılıyor",
      };
      if (labels[text]) onStage(text);
    } else if (eventType === "usage") {
      try {
        onUsage(JSON.parse(text));
      } catch {
        console.warn("Yanıt sağlayıcı bilgisi okunamadı.");
      }
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

  if (!streamError && requiresDoneEvent && !receivedDone) {
    streamError = "Yanıt akışı tamamlanmadan bağlantı kesildi. Kaldığın yerden devam edebilirsin.";
  }
  return streamError ? { ok: false, message: streamError } : { ok: true };
}

async function apiChat(message, userId, token, history, onChunk, attachment = null, mode = "normal", onStage = () => {}, onUsage = () => {}) {
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
      body: JSON.stringify({
        message,
        userId,
        history,
        mode,
        ...(attachment
          ? { attachment_name: attachment.name, attachment_content: attachment.content }
          : {}),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 402) {
        uiSetBackendStatus("ready", "Kredi bakiyesi güncel; Çılgın Mod için yeterli kredi gereklidir.");
      } else {
        uiSetBackendStatus("error", `Asistan isteği başarısız oldu (HTTP ${res.status}).`);
      }
      let data = {};
      try {
        data = await res.json();
      } catch (error) {
        console.error("Chat hata yanıtı JSON olarak okunamadı:", error);
      }
      return {
        ok: false,
        status: res.status,
        unauthorized: res.status === 401,
        message: apiErrorMessage(data, "Mesaj gönderilemedi. Lütfen tekrar deneyin."),
      };
    }

    const streamResult = await readChatStream(res, onChunk, onStage, onUsage);
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
