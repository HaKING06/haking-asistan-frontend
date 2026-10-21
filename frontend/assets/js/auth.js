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

function switchToLogin() {
  authMode = "login";
  nameGroupEl.classList.add("hidden");
  fullNameInputEl.required = false;
  passwordInputEl.autocomplete = "current-password";
  toRegisterRowEl.classList.remove("hidden");
  toLoginRowEl.classList.add("hidden");
  authTitleEl.textContent = "Tekrar hoş geldin";
  authSubtitleEl.textContent = "Hesabına giriş yap ve kaldığın yerden devam et.";
  submitBtnEl.querySelector("span").textContent = "Giriş yap";
  loginErrorEl.textContent = "";
}

function switchToRegister() {
  authMode = "register";
  nameGroupEl.classList.remove("hidden");
  fullNameInputEl.required = true;
  passwordInputEl.autocomplete = "new-password";
  toRegisterRowEl.classList.add("hidden");
  toLoginRowEl.classList.remove("hidden");
  authTitleEl.textContent = "Hesabını oluştur";
  authSubtitleEl.textContent = "Ücretsiz hesabını oluştur, kodlamaya kaldığın yerden devam et.";
  submitBtnEl.querySelector("span").textContent = "Hesap oluştur";
  loginErrorEl.textContent = "";
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

loginFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginErrorEl.textContent = "";

  const email = emailInputEl.value.trim();
  const password = passwordInputEl.value;
  const fullName = fullNameInputEl.value.trim();

  if (!email || !password) {
    loginErrorEl.textContent = "Lütfen mail ve şifreyi gir.";
    return;
  }

  setAuthLoading(true);
  try {
    if (authMode === "login") {
      // GİRİŞ
      const { ok, success, token, message } = await apiLogin(email, password);
      if (!ok || !success) {
        loginErrorEl.textContent =
          message || "Giriş başarısız. Mail veya şifre hatalı.";
        return;
      }

      saveSession(token || "demo-token", email);
      uiShowChat(email);
    } else {
      // KAYIT
      if (!fullName) {
        loginErrorEl.textContent = "Kayıt için ad soyad girmen gerekiyor.";
        return;
      }

      const { ok, success, message } = await apiRegister(
        email,
        password,
        fullName
      );
      if (!ok || !success) {
        loginErrorEl.textContent =
          message || "Kayıt başarısız. Daha sonra tekrar dene.";
        return;
      }

      // Kayıt başarılı → otomatik giriş
      const loginRes = await apiLogin(email, password);

      if (!loginRes.ok || !loginRes.success) {
        switchToLogin();
        loginErrorEl.textContent =
          "Kayıt başarılı ama girişte sorun oluştu, lütfen elle giriş yap.";
        return;
      }

      saveSession(loginRes.token || "demo-token", email);
      uiShowChat(email);
    }
  } catch (err) {
    console.error("AUTH HATASI:", err);
    loginErrorEl.textContent =
      err instanceof TypeError
        ? "Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin."
        : "İşlem tamamlanamadı. Lütfen bilgilerinizi kontrol edip tekrar deneyin.";
  } finally {
    setAuthLoading(false);
  }
});

logoutBtnEl.addEventListener("click", () => {
  clearSession();
  chatWindowEl.innerHTML = "";
  uiShowLogin();
  switchToLogin();
});
