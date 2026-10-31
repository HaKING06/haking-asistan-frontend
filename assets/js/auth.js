// Login ve register iş mantığı

const loginFormEl = document.getElementById("login-form");
const emailInputEl = document.getElementById("email");
const emailGroupEl = document.getElementById("email-group");
const passwordInputEl = document.getElementById("password");
const passwordGroupEl = document.getElementById("password-group");
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

let authMode = "login"; // "login" | "register"
let verificationMode = false;
let pendingVerificationEmail = "";
let resendCooldownTimer = null;

function showAuthError(message) {
  loginErrorEl.removeAttribute("data-state");
  loginErrorEl.textContent = message;
}

function clearVerificationMode() {
  verificationMode = false;
  pendingVerificationEmail = "";
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

function enterVerificationMode(email, message) {
  verificationMode = true;
  pendingVerificationEmail = email;
  emailInputEl.value = email;
  emailInputEl.readOnly = true;
  emailGroupEl.classList.remove("hidden");
  passwordGroupEl.classList.add("hidden");
  nameGroupEl.classList.add("hidden");
  verificationGroupEl.classList.remove("hidden");
  verificationCodeInputEl.value = "";
  toRegisterRowEl.classList.add("hidden");
  toLoginRowEl.classList.add("hidden");
  authTitleEl.textContent = "E-postanı doğrula";
  authSubtitleEl.textContent = message || `6 haneli kodu ${email} adresine gönderdik.`;
  submitBtnEl.querySelector("span").textContent = "Kodu doğrula";
  showAuthError("");
  startResendCooldown();
  verificationCodeInputEl.focus();
}

function switchToLogin() {
  clearVerificationMode();
  authMode = "login";
  nameGroupEl.classList.add("hidden");
  fullNameInputEl.required = false;
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
  fullNameInputEl.required = true;
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
switchToLogin();

showRegisterBtnEl.addEventListener("click", switchToRegister);
showLoginBtnEl.addEventListener("click", switchToLogin);

for (const input of [emailInputEl, passwordInputEl, fullNameInputEl, verificationCodeInputEl]) {
  input.addEventListener("input", () => {
    if (loginErrorEl.textContent) showAuthError("");
  });
}

resendCodeBtnEl.addEventListener("click", async () => {
  if (!verificationMode || resendCodeBtnEl.disabled) return;
  showAuthError("");
  startResendCooldown();
  try {
    const result = await apiResendRegistrationCode(pendingVerificationEmail);
    if (!result.ok || !result.success) {
      showAuthError(result.message || "Yeni kod gönderilemedi.");
      return;
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

  if (password.length > 128) {
    showAuthError("Şifre en fazla 128 karakter olabilir.");
    passwordInputEl.focus();
    return;
  }

  if (authMode === "register" && password.length < 8) {
    showAuthError("Şifre en az 8 karakter olmalıdır.");
    passwordInputEl.focus();
    return;
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

      const result = await apiVerifyRegistration(email, code);
      if (!result.ok || !result.success || !result.token) {
        showAuthError(result.message || "Kod doğrulanamadı.");
        return;
      }

      const accountEmail = result.email || email;
      clearVerificationMode();
      saveSession(result.token, accountEmail);
      uiShowChat(accountEmail);
      startBackendKeepAlive();
      void apiWarmup().catch((error) => console.info("Backend hazırlanıyor:", error.message));
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
      uiShowChat(accountEmail);
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
      fullNameInputEl.value = "";
      enterVerificationMode(result.email || email, result.message);
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
