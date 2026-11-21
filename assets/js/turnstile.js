// Public sitekey only. The corresponding secret belongs exclusively on the backend.
const AuthTurnstile = (() => {
  const sitekey = "0x4AAAAAAGLx5aE51kVoQCzs";
  const container = document.getElementById("auth-turnstile");
  const status = document.getElementById("turnstile-status");
  const retry = document.getElementById("turnstile-retry");
  let widget;
  let token = "";
  let action = "login";
  let hidden = false;
  let script;
  const message = (text, canRetry = false) => {
    status.textContent = text;
    retry.classList.toggle("hidden", !canRetry || hidden);
    document.dispatchEvent(new Event("auth-verification-change"));
  };
  function render() {
    token = "";
    if (widget !== undefined && window.turnstile) window.turnstile.remove(widget);
    widget = undefined;
    container.classList.toggle("hidden", hidden);
    status.classList.toggle("hidden", hidden);
    retry.classList.add("hidden");
    if (hidden || !window.turnstile) return;
    message("Güvenlik doğrulaması bekleniyor…");
    widget = window.turnstile.render(container, {
      sitekey, action, theme: "auto", size: "flexible", language: "tr",
      "response-field": false,
      callback: (value) => { token = value; message("Güvenlik doğrulaması tamamlandı."); },
      "expired-callback": () => { token = ""; message("Doğrulamanın süresi doldu. Lütfen yeniden doğrulayın.", true); },
      "error-callback": () => { token = ""; message("Güvenlik doğrulaması yüklenemedi. Bağlantınızı kontrol edin.", true); },
      "timeout-callback": () => { token = ""; message("Doğrulama zaman aşımına uğradı. Tekrar deneyin.", true); },
    });
  }
  function load() {
    if (window.turnstile) return render();
    if (script) script.remove();
    message("Güvenlik doğrulaması yükleniyor…");
    script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onAuthTurnstileLoad";
    script.async = true;
    script.onerror = () => message("Güvenlik doğrulaması yüklenemedi. Bağlantınızı kontrol edin.", true);
    document.head.append(script);
  }
  window.onAuthTurnstileLoad = render;
  retry.addEventListener("click", load);
  return {
    start: load,
    getToken: () => token,
    reset: render,
    setMode(mode, verification = false) {
      action = mode === "google" ? "google" : mode === "register" ? "signup" : "login";
      hidden = verification;
      render();
    },
  };
})();
