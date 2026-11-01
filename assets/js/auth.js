// Login ve register iş mantığı

const loginFormEl = document.getElementById("login-form");
const emailInputEl = document.getElementById("email");
const emailGroupEl = document.getElementById("email-group");
const passwordInputEl = document.getElementById("password");
const passwordGroupEl = document.getElementById("password-group");
const passwordConfirmInputEl = document.getElementById("password-confirm");
const passwordConfirmGroupEl = document.getElementById("password-confirm-group");
const togglePasswordBtnEl = document.getElementById("toggle-password");
const togglePasswordConfirmBtnEl = document.getElementById("toggle-password-confirm");
const fullNameInputEl = document.getElementById("fullName");
const nameGroupEl = document.getElementById("name-group");
const verificationGroupEl = document.getElementById("verification-group");
const verificationCodeInputEl = document.getElementById("verification-code");
const resendCodeBtnEl = document.getElementById("resend-code-btn");
const editRegistrationBtnEl = document.getElementById("edit-registration-btn");

const loginErrorEl = document.getElementById("login-error");
const logoutBtnEl = document.getElementById("logout-btn");
const submitBtnEl = document.getElementById("submit-btn");
const authTitleEl = document.getElementById("auth-title");
const authSubtitleEl = document.getElementById("auth-subtitle");

const toRegisterRowEl = document.getElementById("to-register-row");
const toLoginRowEl = document.getElementById("to-login-row");
const showRegisterBtnEl = document.getElementById("show-register");
const showLoginBtnEl = document.getElementById("show-login");
const PENDING_VERIFICATION_KEY = "haking_pending_verification";

let authMode = "login"; // "login" | "register"
let verificationMode = false;
let pendingVerificationEmail = "";
let pendingVerificationToken = "";
let pendingEmailLinkToken = "";
let resendCooldownTimer = null;
let verificationPollTimer = null;
let verificationPollInFlight = false;
const NAME_FILTER_WORDS = new Set([
  "amcik", "amina", "amk", "aq", "asshole", "bastard", "bitch", "bok", "cunt",
  "dick", "fuck", "fucker", "gerizekali", "got", "ibne", "kahpe", "nigger", "orospu",
  "pezevenk", "pich", "pic", "pusht", "pust", "pussy", "retard", "salak", "serefsiz",
  "sik", "sikerim", "sikik", "siktir", "slut", "shit", "yarrak", "whore",
]);
const NAME_FILTER_STEMS = [
  "amcik", "fuck", "got", "ibne", "kahpe", "orospu", "pezevenk", "pich",
  "pusht", "serefsiz", "shite", "sik", "siktir", "yarrak",
];

function validateDisplayName(value) {
  const name = value.trim();
  if (name.length < 2) return "Ad soyad en az 2 karakter olmalıdır.";
  if (name.length > 80) return "Ad soyad en fazla 80 karakter olabilir.";
  if (!/^[\p{L}\p{M} '\u2019.-]+$/u.test(name)) {
    return "Ad soyad yalnızca harf, boşluk, kısa çizgi ve kesme işareti içerebilir.";
  }

  const folded = name.toLocaleLowerCase("tr-TR")
    .replace(/ş/g, "sh").replace(/ç/g, "ch").replace(/ğ/g, "g")
    .replace(/ö/g, "o").replace(/ü/g, "u").replace(/ı/g, "i")
    .normalize("NFKD").replace(/\p{M}/gu, "");
  const words = folded.match(/[a-z]+/g) || [];
  const compactParts = folded.split(/\s+/).map((part) => part.replace(/[^a-z0-9]/g, ""));
  const letters = [...name].filter((char) => /[\p{L}\p{M}]/u.test(char));
  if (letters.length < 2 || (new Set(letters.map((char) => char.toLocaleLowerCase("tr-TR"))).size === 1 && letters.length >= 5)) {
    return "Lütfen geçerli bir ad soyad gir.";
  }
  if (words.some((word) => NAME_FILTER_WORDS.has(word)) || compactParts.some((part) =>
    NAME_FILTER_WORDS.has(part) || NAME_FILTER_STEMS.some((stem) => part.startsWith(stem)))) {
    return "Ad soyad argo veya hakaret içermemelidir.";
  }
  return "";
}

function bindPasswordVisibility(input, button) {
  button.addEventListener("click", () => {
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute("aria-label", visible ? "Şifreyi gizle" : "Şifreyi göster");
  });
}

function resetPasswordVisibility(input, button) {
  input.type = "password";
  button.setAttribute("aria-pressed", "false");
  button.setAttribute("aria-label", "Şifreyi göster");
}

bindPasswordVisibility(passwordInputEl, togglePasswordBtnEl);
bindPasswordVisibility(passwordConfirmInputEl, togglePasswordConfirmBtnEl);

function showAuthError(message) {
  loginErrorEl.removeAttribute("data-state");
  loginErrorEl.textContent = message;
}

function readStoredVerification() {
  try {
    const saved = JSON.parse(localStorage.getItem(PENDING_VERIFICATION_KEY) || "null");
    if (saved?.verificationToken && saved.expiresAt > Date.now()) return saved;
  } catch (error) {
    console.warn("Bekleyen doğrulama bilgisi okunamadı.", error);
  }
  localStorage.removeItem(PENDING_VERIFICATION_KEY);
  return null;
}

function storePendingVerification(verificationToken, emailLinkToken) {
  if (!verificationToken) return;
  const saved = {
    verificationToken,
    emailLinkToken: emailLinkToken || "",
    expiresAt: Date.now() + 10 * 60 * 1000,
  };
  localStorage.setItem(PENDING_VERIFICATION_KEY, JSON.stringify(saved));
}

function stopVerificationStatusPolling() {
  if (verificationPollTimer !== null) {
    window.clearInterval(verificationPollTimer);
    verificationPollTimer = null;
  }
  verificationPollInFlight = false;
}

function finishAuthentication(token, email, name = "") {
  if (!token || !email) return;
  clearVerificationMode();
  saveSession(token, email);
  uiShowChat(email, name);
  startBackendKeepAlive();
  void apiWarmup().catch((error) => console.info("Backend hazırlanıyor:", error.message));
}

function startVerificationStatusPolling(verificationToken) {
  stopVerificationStatusPolling();
  if (!verificationToken) return;

  const poll = async () => {
    if (verificationPollInFlight || document.visibilityState === "hidden") return;
    verificationPollInFlight = true;
    try {
      const result = await apiRegistrationStatus(verificationToken);
      if (result.status === "verified" && result.token && result.email) {
        finishAuthentication(result.token, result.email, result.name);
      } else if (result.status === "expired") {
        stopVerificationStatusPolling();
        localStorage.removeItem(PENDING_VERIFICATION_KEY);
        showAuthError("Doğrulama süresi doldu. Kayıt formunu yeniden gönderip yeni kod iste.");
      }
    } catch (error) {
      console.info("Doğrulama durumu kontrol edilemedi; tekrar denenecek.", error.message);
    } finally {
      verificationPollInFlight = false;
    }
  };

  void poll();
  verificationPollTimer = window.setInterval(poll, 5000);
}

function clearVerificationMode(clearStoredToken = true) {
  stopVerificationStatusPolling();
  verificationMode = false;
  pendingVerificationEmail = "";
  pendingVerificationToken = "";
  pendingEmailLinkToken = "";
  if (clearStoredToken) localStorage.removeItem(PENDING_VERIFICATION_KEY);
  verificationCodeInputEl.value = "";
  verificationGroupEl.classList.add("hidden");
  emailGroupEl.classList.remove("hidden");
  passwordGroupEl.classList.remove("hidden");
  emailInputEl.readOnly = false;
  resendCodeBtnEl.disabled = false;
  resendCodeBtnEl.textContent = "Kodu yeniden gönder";
  if (resendCooldownTimer !== null) {
    window.clearInterval(resendCooldownTimer);
    resendCooldownTimer = null;
  }
}

function startResendCooldown(seconds = 60) {
  if (resendCooldownTimer !== null) window.clearInterval(resendCooldownTimer);
  let remaining = seconds;
  resendCodeBtnEl.disabled = true;
  const updateLabel = () => {
    if (remaining <= 0) {
      resendCodeBtnEl.disabled = false;
      resendCodeBtnEl.textContent = "Kodu yeniden gönder";
      window.clearInterval(resendCooldownTimer);
      resendCooldownTimer = null;
      return;
    }
    resendCodeBtnEl.textContent = `Yeniden gönder (${remaining})`;
    remaining -= 1;
  };
  updateLabel();
  resendCooldownTimer = window.setInterval(updateLabel, 1000);
}

function enterVerificationMode(email, message, credentials = {}) {
  verificationMode = true;
  pendingVerificationEmail = email || "";
  pendingVerificationToken = credentials.verificationToken || "";
  pendingEmailLinkToken = credentials.emailLinkToken || "";
  if (pendingVerificationToken) {
    storePendingVerification(pendingVerificationToken, pendingEmailLinkToken);
  }
  emailInputEl.value = pendingVerificationEmail;
  emailInputEl.readOnly = true;
  emailGroupEl.classList.toggle("hidden", !pendingVerificationEmail);
  passwordGroupEl.classList.add("hidden");
  passwordConfirmGroupEl.classList.add("hidden");
  nameGroupEl.classList.add("hidden");
  verificationGroupEl.classList.remove("hidden");
  verificationCodeInputEl.value = credentials.code || "";
  toRegisterRowEl.classList.add("hidden");
  toLoginRowEl.classList.add("hidden");
  authTitleEl.textContent = "E-postanı doğrula";
  authSubtitleEl.textContent = message || (pendingVerificationEmail
    ? `6 haneli kodu ${pendingVerificationEmail} adresine gönderdik.`
    : "E-postandaki 6 haneli kodu gir.");
  submitBtnEl.querySelector("span").textContent = "Kodu doğrula";
  showAuthError("");
  startResendCooldown();
  if (pendingVerificationToken) startVerificationStatusPolling(pendingVerificationToken);
  if (credentials.code) submitBtnEl.focus();
  else verificationCodeInputEl.focus();
}

function switchToLogin(clearStoredToken = true) {
  clearVerificationMode(clearStoredToken);
  authMode = "login";
  nameGroupEl.classList.add("hidden");
  fullNameInputEl.required = false;
  passwordConfirmInputEl.required = false;
  passwordConfirmInputEl.value = "";
  resetPasswordVisibility(passwordInputEl, togglePasswordBtnEl);
  resetPasswordVisibility(passwordConfirmInputEl, togglePasswordConfirmBtnEl);
  passwordInputEl.autocomplete = "current-password";
  passwordInputEl.minLength = 1;
  toRegisterRowEl.classList.remove("hidden");
  toLoginRowEl.classList.add("hidden");
  authTitleEl.textContent = "Tekrar hoş geldin";
  authSubtitleEl.textContent = "Türkçe yapay zekâ kodlama asistanına devam etmek için Gmail hesabınla giriş yap.";
  submitBtnEl.querySelector("span").textContent = "Giriş yap";
  showAuthError("");
}

function switchToRegister() {
  clearVerificationMode();
  authMode = "register";
  nameGroupEl.classList.remove("hidden");
  passwordConfirmGroupEl.classList.remove("hidden");
  fullNameInputEl.required = true;
  passwordConfirmInputEl.required = true;
  passwordConfirmInputEl.autocomplete = "new-password";
  passwordConfirmInputEl.value = "";
  resetPasswordVisibility(passwordInputEl, togglePasswordBtnEl);
  resetPasswordVisibility(passwordConfirmInputEl, togglePasswordConfirmBtnEl);
  passwordInputEl.autocomplete = "new-password";
  passwordInputEl.minLength = 8;
  toRegisterRowEl.classList.add("hidden");
  toLoginRowEl.classList.remove("hidden");
  authTitleEl.textContent = "Hesabını oluştur";
  authSubtitleEl.textContent = "Kayıt için Gmail adresini doğrula. Şifren en az 8 karakter olmalı.";
  submitBtnEl.querySelector("span").textContent = "Hesap oluştur";
  showAuthError("");
}

function setAuthLoading(isLoading) {
  submitBtnEl.disabled = isLoading;
  submitBtnEl.querySelector("span").textContent = isLoading
    ? verificationMode
      ? "Kod doğrulanıyor..."
      : authMode === "login"
        ? "Giriş yapılıyor..."
        : "Doğrulama kodu gönderiliyor..."
    : verificationMode
      ? "Kodu doğrula"
      : authMode === "login"
        ? "Giriş yap"
        : "Hesap oluştur";
}

// Başlangıç durumu
switchToLogin(false);

showRegisterBtnEl.addEventListener("click", switchToRegister);
showLoginBtnEl.addEventListener("click", switchToLogin);

for (const input of [emailInputEl, passwordInputEl, passwordConfirmInputEl, fullNameInputEl, verificationCodeInputEl]) {
  input.addEventListener("input", () => {
    if (loginErrorEl.textContent) showAuthError("");
  });
}

resendCodeBtnEl.addEventListener("click", async () => {
  if (!verificationMode || resendCodeBtnEl.disabled) return;
  showAuthError("");
  startResendCooldown();
  try {
    const result = await apiResendRegistrationCode(
      pendingVerificationEmail || null,
      pendingVerificationToken || null,
      pendingEmailLinkToken || null,
    );
    if (!result.ok || !result.success) {
      showAuthError(result.message || "Yeni kod gönderilemedi.");
      return;
    }
    verificationCodeInputEl.value = "";
    if (pendingVerificationToken) {
      storePendingVerification(pendingVerificationToken, pendingEmailLinkToken);
    }
    authSubtitleEl.textContent = result.message || `Yeni kod ${pendingVerificationEmail} adresine gönderildi.`;
  } catch (error) {
    console.error("Doğrulama kodu yeniden gönderilemedi:", error);
    showAuthError("Yeni kod gönderilemedi. Bağlantını kontrol edip tekrar dene.");
  }
});

editRegistrationBtnEl.addEventListener("click", switchToRegister);

loginFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAuthError("");

  const email = verificationMode ? pendingVerificationEmail : emailInputEl.value.trim();
  const password = passwordInputEl.value;
  const passwordConfirmation = passwordConfirmInputEl.value;
  const fullName = fullNameInputEl.value.trim();

  if (!email || (!verificationMode && !password)) {
    showAuthError("Lütfen e-posta adresini ve şifreni gir.");
    return;
  }

  if (!verificationMode && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthError("Geçerli bir e-posta adresi gir.");
    emailInputEl.focus();
    return;
  }

  if (!verificationMode && !email.toLowerCase().endsWith("@gmail.com")) {
    showAuthError("Yalnızca @gmail.com adresleriyle giriş yapabilir veya kayıt olabilirsin.");
    emailInputEl.focus();
    return;
  }

  if (!verificationMode && password.length > 128) {
    showAuthError("Şifre en fazla 128 karakter olabilir.");
    passwordInputEl.focus();
    return;
  }

  if (authMode === "register" && !verificationMode && password.length < 8) {
    showAuthError("Şifre en az 8 karakter olmalıdır.");
    passwordInputEl.focus();
    return;
  }

  if (authMode === "register" && !verificationMode) {
    const nameError = validateDisplayName(fullName);
    if (nameError) {
      showAuthError(nameError);
      fullNameInputEl.focus();
      return;
    }
    if (password !== passwordConfirmation) {
      showAuthError("Girdiğin şifreler birbiriyle eşleşmiyor.");
      passwordConfirmInputEl.focus();
      return;
    }
  }

  setAuthLoading(true);
  try {
    if (verificationMode) {
      const code = verificationCodeInputEl.value.trim();
      if (!/^\d{6}$/.test(code)) {
        showAuthError("E-postadaki 6 haneli doğrulama kodunu gir.");
        verificationCodeInputEl.focus();
        return;
      }

      const result = await apiVerifyRegistration(
        email || null,
        code,
        pendingVerificationToken || null,
        pendingEmailLinkToken || null,
      );
      if (!result.ok || !result.success || !result.token) {
        showAuthError(result.message || "Kod doğrulanamadı.");
        return;
      }

      finishAuthentication(result.token, result.email || email, result.name);
    } else if (authMode === "login") {
      // GİRİŞ
      const result = await apiLogin(email, password);
      if (!result.ok || !result.success || !result.token) {
        loginErrorEl.textContent =
          result.message || "Giriş başarısız. Gmail adresini ve şifreni kontrol et.";
        return;
      }

      const accountEmail = result.email || email;
      saveSession(result.token, accountEmail);
      uiShowChat(accountEmail, result.name);
      startBackendKeepAlive();
      void apiWarmup().catch((error) => console.info("Backend hazırlanıyor:", error.message));
    } else {
      // KAYIT
      if (!fullName) {
        showAuthError("Kayıt için ad soyad girmen gerekiyor.");
        fullNameInputEl.focus();
        return;
      }

      const result = await apiRegister(
        email,
        password,
        fullName
      );
      if (!result.ok || !result.success) {
        showAuthError(result.message || "Kayıt başarısız. Daha sonra tekrar dene.");
        return;
      }

      passwordInputEl.value = "";
      passwordConfirmInputEl.value = "";
      fullNameInputEl.value = "";
      enterVerificationMode(result.email || email, result.message, {
        verificationToken: result.verification_token,
        emailLinkToken: result.email_link_token,
      });
    }
  } catch (err) {
    console.error("AUTH HATASI:", err);
    showAuthError(
      err instanceof TypeError
        ? "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."
        : "İşlem tamamlanamadı. Lütfen bilgilerini kontrol edip tekrar deneyin."
    );
  } finally {
    setAuthLoading(false);
  }
});

logoutBtnEl.addEventListener("click", () => {
  stopBackendKeepAlive();
  void apiLogout(AppState.token).catch((error) => {
    console.warn("Sunucu oturumu kapatılamadı:", error);
  });
  clearSession();
  chatWindowEl.innerHTML = "";
  uiShowLogin();
  switchToLogin();
});

async function openRegistrationEmailLink() {
  const fragment = window.location.hash.slice(1);
  if (!fragment) return;

  const params = new URLSearchParams(fragment);
  const emailLinkToken = params.get("verify");
  const code = params.get("code") || "";
  if (!emailLinkToken) return;

  // The capability and OTP are carried only in the URL fragment. Remove them
  // before making any network request so they never enter HTTP logs/referrers.
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(emailLinkToken) || (code && !/^\d{6}$/.test(code))) {
    showAuthError("Doğrulama bağlantısı geçersiz. E-postadaki son kodu kullan veya yeni kod iste.");
    return;
  }

  showAuthError("Doğrulama bağlantısı kontrol ediliyor...");
  try {
    const link = await apiRegistrationLink(emailLinkToken);
    if (!link.ok || !link.email) {
      showAuthError("Bu doğrulama bağlantısının süresi dolmuş. Kayıt formundan yeni kod iste.");
      return;
    }

    const stored = readStoredVerification();
    if (link.status === "verified") {
      if (stored?.verificationToken) {
        const status = await apiRegistrationStatus(stored.verificationToken);
        if (status.status === "verified" && status.token && status.email) {
          finishAuthentication(status.token, status.email, status.name);
          return;
        }
      }
      if (/^\d{6}$/.test(code)) {
        enterVerificationMode(link.email, "Hesap zaten doğrulanmış. Bu cihazda da oturum açmak için kodu onayla.", {
          verificationToken: stored?.verificationToken || "",
          emailLinkToken,
          code,
        });
      } else {
        switchToLogin(false);
        showAuthError("E-posta zaten doğrulanmış. Giriş yapabilirsin.");
      }
      return;
    }

    if (link.status !== "pending") {
      showAuthError("Doğrulama bağlantısının süresi dolmuş. Kayıt formundan yeni kod iste.");
      return;
    }

    enterVerificationMode(link.email, "E-postadaki kod hazır. Doğrulamak için düğmeye bas.", {
      verificationToken: stored?.verificationToken || "",
      emailLinkToken,
      code,
    });
  } catch (error) {
    console.error("E-posta doğrulama bağlantısı açılamadı:", error);
    showAuthError("Doğrulama bağlantısı açılamadı. İnternet bağlantını kontrol edip tekrar dene.");
  }
}

void openRegistrationEmailLink();
