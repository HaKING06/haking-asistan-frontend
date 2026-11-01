(() => {
  const form = document.getElementById("reset-password-form");
  const passwordInput = document.getElementById("new-password");
  const confirmationInput = document.getElementById("confirm-password");
  const status = document.getElementById("recovery-status");
  const submit = document.getElementById("reset-password-submit");
  const params = new URLSearchParams(window.location.hash.slice(1));
  let token = params.get("token") || "";

  // The reset token lives only in memory and is never left in browser history or sent as a URL.
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    token = "";
    form.classList.add("hidden");
    status.textContent = "Şifre sıfırlama bağlantısı geçersiz. Yeni bir bağlantı iste.";
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!token) return;
    status.textContent = "";
    status.removeAttribute("data-state");
    const password = passwordInput.value;
    if (password.length < 8) {
      status.textContent = "Şifre en az 8 karakter olmalıdır.";
      passwordInput.focus();
      return;
    }
    if (password.length > 128) {
      status.textContent = "Şifre en fazla 128 karakter olabilir.";
      passwordInput.focus();
      return;
    }
    if (password !== confirmationInput.value) {
      status.textContent = "Girdiğin şifreler eşleşmiyor.";
      confirmationInput.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Şifre güncelleniyor…";
    try {
      const result = await apiResetPassword(token, password);
      if (!result.ok || !result.success) throw new Error(result.message || "Şifre güncellenemedi.");
      token = "";
      form.classList.add("hidden");
      status.dataset.state = "success";
      status.textContent = "Şifren güncellendi. Tüm eski oturumlar kapatıldı. Yeni şifrenle giriş yapabilirsin.";
    } catch (error) {
      status.textContent = error.message || "İşlem tamamlanamadı. Yeni bir sıfırlama bağlantısı iste.";
      passwordInput.value = "";
      confirmationInput.value = "";
      passwordInput.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = "Şifremi güncelle";
    }
  });
})();
