(() => {
  const form = document.getElementById("delete-account-form");
  const passwordInput = document.getElementById("current-password");
  const status = document.getElementById("deletion-status");
  const accountLabel = document.getElementById("deletion-account-label");
  const submit = document.getElementById("delete-account-submit");
  const backLink = document.getElementById("deletion-back-link");
  const params = new URLSearchParams(window.location.hash.slice(1));
  let token = params.get("token") || "";
  let deletingEmail = "";

  // The deletion token stays in memory and is removed from the address bar immediately.
  window.history.replaceState(null, document.title, `${window.location.pathname}${window.location.search}`);

  async function initialize() {
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
      token = "";
      accountLabel.textContent = "Hesap silme bağlantısı geçersiz. Yeni bir bağlantı iste.";
      return;
    }
    try {
      const result = await apiAccountDeletionStatus(token);
      if (!result.ok || !result.valid || !result.email) throw new Error("Bağlantı geçersiz veya süresi dolmuş. Ayarlar bölümünden yeni bir bağlantı iste.");
      deletingEmail = result.email;
      accountLabel.textContent = `Silinecek hesap: ${result.email}. Devam etmek için mevcut şifreni gir.`;
      form.classList.remove("hidden");
      passwordInput.focus();
    } catch (error) {
      token = "";
      accountLabel.textContent = error.message || "Onay bağlantısı doğrulanamadı.";
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!token) return;
    status.textContent = "";
    status.removeAttribute("data-state");
    if (!passwordInput.value || passwordInput.value.length > 128) {
      status.textContent = "Mevcut şifreni gir. Şifre en fazla 128 karakter olabilir.";
      passwordInput.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Hesap siliniyor…";
    try {
      const result = await apiConfirmAccountDeletion(token, passwordInput.value);
      if (!result.ok || !result.success) throw new Error(result.message || "Hesap silinemedi.");
      token = "";
      clearChatHistory(deletingEmail);
      clearSession();
      form.classList.add("hidden");
      accountLabel.textContent = "Hesabın ve tüm aktif oturumların silindi.";
      status.dataset.state = "success";
      status.textContent = "İşlem tamamlandı. HaKING AI'yi kullandığın için teşekkürler.";
      backLink.textContent = "HaKING AI ana sayfasına dön";
    } catch (error) {
      status.textContent = error.message || "İşlem tamamlanamadı. Bağlantının süresini kontrol et.";
      passwordInput.value = "";
      passwordInput.focus();
    } finally {
      submit.disabled = false;
      submit.textContent = "Hesabımı kalıcı olarak sil";
    }
  });

  void initialize();
})();
