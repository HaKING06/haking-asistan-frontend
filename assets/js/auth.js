// Login ve register iş mantığı

const loginFormEl = document.getElementById("login-form");
const emailInputEl = document.getElementById("email");
const passwordInputEl = document.getElementById("password");
const fullNameInputEl = document.getElementById("fullName");
const nameGroupEl = document.getElementById("name-group");

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

function showAuthError(message) {
  loginErrorEl.removeAttribute("data-state");
  loginErrorEl.textContent = message;
}

function switchToLogin() {
  authMode = "login";
  nameGroupEl.classList.add("hidden");
  fullNameInputEl.required = false;
  passwordInputEl.autocomplete = "current-password";
  passwordInputEl.minLength = 1;
  toRegisterRowEl.classList.remove("hidden");
  toLoginRowEl.classList.add("hidden");
  authTitleEl.textContent = "Tekrar hoş geldin";
  authSubtitleEl.textContent = "Türkçe yapay zekâ kodlama asistanına giriş yap; yazılım sorularını çözmeye devam et.";
  submitBtnEl.querySelector("span").textContent = "Giriş yap";
  showAuthError("");
}

function switchToRegister() {
  authMode = "register";
  nameGroupEl.classList.remove("hidden");
  fullNameInputEl.required = true;
  passwordInputEl.autocomplete = "new-password";
  passwordInputEl.minLength = 8;
  toRegisterRowEl.classList.add("hidden");
  toLoginRowEl.classList.remove("hidden");
  authTitleEl.textContent = "Hesabını oluştur";
  authSubtitleEl.textContent = "Kod öğrenmek, hataları incelemek ve yazılım sorularına yanıt bulmak için hesabını oluştur. Şifren en az 8 karakter olmalı.";
  submitBtnEl.querySelector("span").textContent = "Hesap oluştur";
  showAuthError("");
}

function setAuthLoading(isLoading) {
  submitBtnEl.disabled = isLoading;
  submitBtnEl.querySelector("span").textContent = isLoading
    ? authMode === "login"
      ? "Giriş yapılıyor..."
      : "Hesap oluşturuluyor..."
    : authMode === "login"
      ? "Giriş yap"
      : "Hesap oluştur";
}

// Başlangıç durumu
switchToLogin();

showRegisterBtnEl.addEventListener("click", switchToRegister);
showLoginBtnEl.addEventListener("click", switchToLogin);

for (const input of [emailInputEl, passwordInputEl, fullNameInputEl]) {
  input.addEventListener("input", () => {
    if (loginErrorEl.textContent) showAuthError("");
  });
}

loginFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  showAuthError("");

  const email = emailInputEl.value.trim();
  const password = passwordInputEl.value;
  const fullName = fullNameInputEl.value.trim();

  if (!email || !password) {
    showAuthError("Lütfen e-posta adresini ve şifreni gir.");
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthError("Geçerli bir e-posta adresi gir.");
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
    if (authMode === "login") {
      // GİRİŞ
      const { ok, success, token, message } = await apiLogin(email, password);
      if (!ok || !success || !token) {
        loginErrorEl.textContent =
          message || "Giriş başarısız. Mail veya şifre hatalı.";
        return;
      }

      saveSession(token, email);
      uiShowChat(email);
      void apiWarmup().catch((error) => console.info("Backend hazırlanıyor:", error.message));
    } else {
      // KAYIT
      if (!fullName) {
        showAuthError("Kayıt için ad soyad girmen gerekiyor.");
        fullNameInputEl.focus();
        return;
      }

      const { ok, success, message } = await apiRegister(
        email,
        password,
        fullName
      );
      if (!ok || !success) {
        showAuthError(message || "Kayıt başarısız. Daha sonra tekrar dene.");
        return;
      }

      // Kayıt başarılı → otomatik giriş
      const loginRes = await apiLogin(email, password);

      if (!loginRes.ok || !loginRes.success || !loginRes.token) {
        switchToLogin();
        showAuthError("Kayıt başarılı ama girişte sorun oluştu, lütfen elle giriş yap.");
        return;
      }

      saveSession(loginRes.token, email);
      uiShowChat(email);
      void apiWarmup().catch((error) => console.info("Backend hazırlanıyor:", error.message));
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
  void apiLogout(AppState.token).catch((error) => {
    console.warn("Sunucu oturumu kapatılamadı:", error);
  });
  clearSession();
  chatWindowEl.innerHTML = "";
  uiShowLogin();
  switchToLogin();
});
