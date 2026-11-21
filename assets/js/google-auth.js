// Google returns an ID token only; no Google API access tokens are requested or stored.
const GoogleSignIn = (() => {
  const button = document.getElementById("google-signin-button");
  const status = document.getElementById("google-signin-status");
  const retry = document.getElementById("google-signin-retry");
  const age = document.getElementById("adult-confirmed");
  let configuration;
  let busy = false;
  let loading = false;
  let refreshTimer;
  let scriptPromise;
  let visible = true;
  let onSuccess;
  let showError;

  function update() {
    const ready = !!configuration && !!window.google?.accounts?.id && !busy && age.checked && !!AuthTurnstile.getToken();
    button.inert = !ready;
    button.setAttribute("aria-disabled", String(!ready));
    if (busy) status.textContent = "Google hesabın doğrulanıyor…";
    else if (configuration) status.textContent = ready
      ? "Google hesabını seçerek devam edebilirsin."
      : "Devam etmek için yaş onayını ver ve güvenlik doğrulamasını tamamla.";
  }

  function loadScript() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (!scriptPromise) scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const timer = setTimeout(() => { script.remove(); scriptPromise = null; reject(new Error("Google giriş aracı yüklenemedi. Bağlantını kontrol et.")); }, 15000);
      script.src = "https://accounts.google.com/gsi/client?hl=tr";
      script.async = true;
      script.referrerPolicy = "strict-origin-when-cross-origin";
      script.onload = () => { clearTimeout(timer); resolve(); };
      script.onerror = () => { clearTimeout(timer); script.remove(); scriptPromise = null; reject(new Error("Google giriş aracı yüklenemedi. Bağlantını kontrol et.")); };
      document.head.append(script);
    });
    return scriptPromise;
  }

  async function receiveCredential(response) {
    if (busy || !visible) return;
    const token = AuthTurnstile.getToken();
    const challenge = configuration?.challenge;
    if (!age.checked || !token || !challenge || !response.credential) {
      showError("Yaş onayını ve güvenlik doğrulamasını tamamlayıp yeniden dene.");
      return;
    }
    busy = true;
    document.dispatchEvent(new CustomEvent("google-auth-busy", { detail: true }));
    update();
    let succeeded = false;
    try {
      const result = await apiGoogleLogin(response.credential, challenge, age.checked, token);
      if (!result.ok || !result.success || !result.token || !result.email) {
        showError(result.message || "Google ile giriş tamamlanamadı.");
        return;
      }
      succeeded = true;
      clearTimeout(refreshTimer);
      configuration = null;
      onSuccess(result.token, result.email, result.name);
    } catch {
      showError("Sunucuya ulaşılamadı. Biraz sonra tekrar dene.");
    } finally {
      busy = false;
      document.dispatchEvent(new CustomEvent("google-auth-busy", { detail: false }));
      AuthTurnstile.reset();
      if (!succeeded) await prepare();
      update();
    }
  }

  function renderButton() {
    if (!visible || !configuration || !window.google?.accounts?.id) return;
    button.replaceChildren();
    window.google.accounts.id.renderButton(button, {
      type: "standard", theme: "outline", size: "large", text: "continue_with",
      shape: "rectangular", width: Math.min(400, Math.floor(button.getBoundingClientRect().width)), locale: "tr",
    });
    update();
  }

  async function prepare() {
    if (loading || busy) return;
    loading = true;
    configuration = null;
    clearTimeout(refreshTimer);
    retry.classList.add("hidden");
    status.textContent = "Google ile giriş hazırlanıyor…";
    update();
    try {
      const [config] = await Promise.all([apiGoogleConfig(), loadScript()]);
      if (!config.client_id || !config.challenge || !config.nonce || config.expires_at * 1000 <= Date.now()) throw new Error("Google ile giriş şu anda kullanılamıyor.");
      configuration = config;
      window.google.accounts.id.initialize({
        client_id: config.client_id, nonce: config.nonce, callback: receiveCredential,
        auto_select: false, ux_mode: "popup", itp_support: false,
      });
      renderButton();
      refreshTimer = setTimeout(prepare, Math.max(1000, config.expires_at * 1000 - Date.now() - 30000));
    } catch (error) {
      configuration = null;
      const message = error instanceof TypeError || error.name === "TimeoutError"
        ? "Google girişine bağlanılamadı. Bağlantını kontrol et."
        : error.message || "Google ile giriş yüklenemedi.";
      status.textContent = `${message} Gmail ve şifre ile devam edebilirsin.`;
      retry.classList.remove("hidden");
    } finally {
      loading = false;
      update();
    }
  }

  retry.addEventListener("click", prepare);
  age.addEventListener("change", update);
  document.addEventListener("auth-verification-change", update);
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(renderButton, 150); });
  return {
    start(success, error) { onSuccess = success; showError = error; void prepare(); },
    setVisible(value) {
      visible = value;
      if (visible && (!configuration || configuration.expires_at * 1000 <= Date.now())) void prepare();
      else if (visible) renderButton();
    },
    isBusy: () => busy,
  };
})();
