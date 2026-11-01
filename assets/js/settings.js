(() => {
  const openButtons = [
    document.getElementById("settings-btn"),
    document.getElementById("settings-profile-btn"),
  ].filter(Boolean);
  const backdrop = document.getElementById("settings-modal");
  const dialog = backdrop?.querySelector(".settings-dialog");
  const closeButton = document.getElementById("settings-close-btn");
  const accountName = document.getElementById("settings-account-name");
  const accountEmail = document.getElementById("settings-account-email");
  const settingsCreditTotal = document.getElementById("settings-credit-total");
  const settingsCreditDetails = document.getElementById("settings-credit-details");
  const founderCreditLink = document.getElementById("founder-credit-link");
  const providerStatus = document.getElementById("settings-provider-status");
  const providerList = document.getElementById("settings-provider-list");
  const resetButton = document.getElementById("settings-password-reset-btn");
  const resetStatus = document.getElementById("settings-password-reset-status");
  const deleteStartButton = document.getElementById("settings-delete-start-btn");
  const deleteConfirm = document.getElementById("settings-delete-confirm");
  const deleteConfirmButton = document.getElementById("settings-delete-confirm-btn");
  const deleteCancelButton = document.getElementById("settings-delete-cancel-btn");
  const deleteStatus = document.getElementById("settings-delete-status");
  let returnFocusTarget = null;

  if (!backdrop || !dialog) return;

  function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.dataset.state = isError ? "error" : "success";
  }

  function clearStatus(element) {
    element.textContent = "";
    element.removeAttribute("data-state");
  }

  function createProviderCard(provider) {
    const card = document.createElement("article");
    card.className = "settings-provider-card";

    const heading = document.createElement("div");
    heading.className = "settings-provider-head";
    const name = document.createElement("strong");
    name.textContent = provider.name || provider.id || "AI sağlayıcısı";
    const state = document.createElement("span");
    state.dataset.ready = String(provider.configured === true);
    state.textContent = provider.configured ? "Etkin" : "Kapalı";
    heading.append(name, state);

    const models = document.createElement("ul");
    for (const model of provider.models || []) {
      const item = document.createElement("li");
      const id = document.createElement("code");
      id.textContent = model.id || "Model";
      const purpose = document.createElement("small");
      purpose.textContent = model.purpose || "Otomatik model seçimi.";
      item.append(id, purpose);
      models.append(item);
    }

    card.append(heading, models);
    return card;
  }

  async function loadProviders() {
    providerStatus.textContent = "Yükleniyor…";
    providerStatus.dataset.state = "";
    providerList.replaceChildren();
    try {
      const result = await apiGetProviderCatalog();
      if (!result.ok) throw new Error("Model durumu alınamadı.");
      const providers = Array.isArray(result.providers) ? result.providers : [];
      providerList.replaceChildren(...providers.map(createProviderCard));
      const enabled = providers.filter((provider) => provider.configured).length;
      providerStatus.dataset.state = enabled ? "ready" : "error";
      providerStatus.textContent = enabled ? `${enabled} sağlayıcı hazır` : "Sağlayıcı hazır değil";
      if (!providers.length) providerList.textContent = "Model bilgisi şu anda alınamıyor.";
    } catch {
      providerStatus.dataset.state = "error";
      providerStatus.textContent = "Bağlantı yok";
      const note = document.createElement("p");
      note.className = "settings-provider-card";
      note.textContent = "Canlı model durumu alınamadı. Hakkında sayfasında sağlayıcı ve model bilgilerini görebilirsin.";
      providerList.replaceChildren(note);
    }
  }

  function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "tarih alınamadı"
      : new Intl.DateTimeFormat("tr-TR", { ...options, timeZone: "Europe/Istanbul" }).format(date);
  }

  async function loadCredits() {
    if (!AppState.token || !settingsCreditTotal || !settingsCreditDetails) return;
    settingsCreditTotal.textContent = "Yükleniyor…";
    settingsCreditDetails.textContent = "Kredi bakiyesi alınıyor…";
    try {
      const balance = await apiGetAiCredits(AppState.token);
      if (!balance.ok) throw new Error(balance.message || "Kredi bakiyesi alınamadı.");
      settingsCreditTotal.textContent = `${balance.total_credits} aktif`;
      const lines = [
        `Ücretsiz: ${balance.monthly_credits}/${balance.monthly_allowance} kredi · ${formatDate(`${balance.period_renews_at}T12:00:00+03:00`, { day: "numeric", month: "long" })} yenilenir.`,
      ];
      const lots = (balance.purchased_lots || []).filter((lot) => lot.credits_remaining > 0);
      if (lots.length) {
        lines.push(`Ek paketler: ${lots.map((lot) => `${lot.credits_remaining} kredi (${formatDate(lot.expires_at)} son gün)`).join(" · ")}.`);
      } else {
        lines.push("Ek paket kredisi bulunmuyor.");
      }
      lines.push(`Çılgın Mod isteği ${balance.crazy_mode_cost} kredi kullanır. Ek krediler ücretsiz aylık kredilerden ayrı tutulur.`);
      settingsCreditDetails.textContent = lines.join("\n");
      AppState.credits = balance;
    } catch (error) {
      settingsCreditTotal.textContent = "—";
      settingsCreditDetails.textContent = error.message || "Kredi bakiyesi şu anda alınamıyor.";
    }
  }

  function openSettings(event) {
    if (!AppState.token || !AppState.email) return;
    returnFocusTarget = event?.currentTarget || null;
    accountName.textContent = document.getElementById("profile-name")?.textContent?.trim() || "—";
    accountEmail.textContent = AppState.email;
    if (founderCreditLink) {
      founderCreditLink.classList.toggle("hidden", AppState.email.trim().toLowerCase() !== "gunshalit@gmail.com");
    }
    clearStatus(resetStatus);
    clearStatus(deleteStatus);
    deleteConfirm.classList.add("hidden");
    backdrop.classList.remove("hidden");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.classList.add("settings-open");
    dialog.focus();
    void loadProviders();
    void loadCredits();
  }

  function closeSettings() {
    backdrop.classList.add("hidden");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.classList.remove("settings-open");
    returnFocusTarget?.focus();
  }

  openButtons.forEach((button) => button.addEventListener("click", openSettings));
  closeButton?.addEventListener("click", closeSettings);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closeSettings();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.classList.contains("hidden")) closeSettings();
  });

  resetButton?.addEventListener("click", async () => {
    if (!AppState.email || resetButton.disabled) return;
    clearStatus(resetStatus);
    resetButton.disabled = true;
    try {
      const result = await apiRequestPasswordReset(AppState.email);
      if (!result.ok) throw new Error(result.message || "Şifre bağlantısı gönderilemedi.");
      setStatus(resetStatus, "Hesabın varsa şifre sıfırlama bağlantısı e-posta adresine gönderildi.");
    } catch (error) {
      setStatus(resetStatus, error.message || "İstek tamamlanamadı. Biraz sonra tekrar dene.", true);
    } finally {
      resetButton.disabled = false;
    }
  });

  deleteStartButton?.addEventListener("click", () => {
    clearStatus(deleteStatus);
    deleteConfirm.classList.remove("hidden");
    deleteConfirmButton.focus();
  });

  deleteCancelButton?.addEventListener("click", () => {
    deleteConfirm.classList.add("hidden");
    deleteStartButton.focus();
  });

  deleteConfirmButton?.addEventListener("click", async () => {
    if (!AppState.token || deleteConfirmButton.disabled) return;
    clearStatus(deleteStatus);
    deleteConfirmButton.disabled = true;
    deleteConfirmButton.textContent = "E-posta gönderiliyor…";
    try {
      const result = await apiRequestAccountDeletion(AppState.token);
      if (!result.ok) throw new Error(result.message || "Silme bağlantısı gönderilemedi.");
      setStatus(deleteStatus, result.message || "Hesap silme bağlantısı e-posta adresine gönderildi.");
      deleteConfirm.classList.add("hidden");
    } catch (error) {
      setStatus(deleteStatus, error.message || "İstek tamamlanamadı. Biraz sonra tekrar dene.", true);
    } finally {
      deleteConfirmButton.disabled = false;
      deleteConfirmButton.textContent = "Evet, bağlantıyı gönder";
    }
  });
})();
