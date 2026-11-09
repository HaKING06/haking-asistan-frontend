(() => {
  const FOUNDER_EMAIL = "gunshalit@gmail.com";
  const token = (() => {
    try { return localStorage.getItem("haking_token") || ""; } catch { return ""; }
  })();
  const lookupForm = document.getElementById("founder-lookup-form");
  const grantForm = document.getElementById("founder-grant-form");
  const emailInput = document.getElementById("founder-email");
  const emailPicker = document.querySelector(".founder-email-picker");
  const emailSuggestions = document.getElementById("founder-email-suggestions");
  const orderInput = document.getElementById("founder-order-reference");
  const paymentVerified = document.getElementById("founder-payment-verified");
  const grantButton = document.getElementById("founder-grant-button");
  const accountStatus = document.getElementById("founder-account-status");
  const grantStatus = document.getElementById("founder-grant-status");
  const accountCard = document.getElementById("founder-account-card");
  const historyList = document.getElementById("founder-grant-history");
  const packageHeading = document.getElementById("founder-package-title");
  const packageMeta = document.getElementById("founder-package-meta");
  let verifiedAccountEmail = "";
  let isGranting = false;
  let suggestionItems = [];
  let activeSuggestionIndex = -1;
  let suggestionTimer = 0;
  let suggestionController = null;
  let suggestionRequestId = 0;

  const setStatus = (element, message, isError = false) => {
    element.textContent = message;
    element.dataset.state = isError ? "error" : "success";
  };

  const displayDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Tarih alınamadı";
    return new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(date);
  };

  function updateGrantButton() {
    grantButton.disabled = isGranting || !paymentVerified.checked || !verifiedAccountEmail;
  }

  function hideSuggestions() {
    emailSuggestions.hidden = true;
    emailInput.setAttribute("aria-expanded", "false");
    emailInput.removeAttribute("aria-activedescendant");
    activeSuggestionIndex = -1;
  }

  function showSuggestionMessage(message) {
    emailSuggestions.replaceChildren();
    const item = document.createElement("div");
    item.className = "founder-suggestion-empty";
    item.setAttribute("role", "status");
    item.textContent = message;
    emailSuggestions.append(item);
    emailSuggestions.hidden = false;
    emailInput.setAttribute("aria-expanded", "true");
  }

  function setActiveSuggestion(index) {
    const options = [...emailSuggestions.querySelectorAll("[role='option']")];
    if (!options.length) return;
    activeSuggestionIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
      const active = optionIndex === activeSuggestionIndex;
      option.setAttribute("aria-selected", String(active));
      if (active) {
        emailInput.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function chooseSuggestion(index) {
    const account = suggestionItems[index];
    if (!account) return;
    window.clearTimeout(suggestionTimer);
    suggestionController?.abort();
    emailInput.value = account.email;
    hideSuggestions();
    lookupAccount(account.email);
  }

  function renderSuggestions(accounts, hasMore, query) {
    suggestionItems = accounts;
    activeSuggestionIndex = -1;
    emailSuggestions.replaceChildren();
    const heading = document.createElement("div");
    heading.className = "founder-suggestion-heading";
    heading.textContent = hasMore
      ? `“${query}” ile başlayan ilk ${accounts.length} hesap · daha iyi eşleşme için yazmaya devam et`
      : `${accounts.length} eşleşen hesap`;
    emailSuggestions.append(heading);

    if (!accounts.length) {
      const empty = document.createElement("div");
      empty.className = "founder-suggestion-empty";
      empty.textContent = "Bu başlangıçla eşleşen kayıtlı hesap yok. E-posta adresini kontrol edip devam edebilirsin.";
      emailSuggestions.append(empty);
    } else {
      accounts.forEach((account, index) => {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `founder-email-option-${index}`;
        option.className = "founder-suggestion-option";
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", "false");
        const name = document.createElement("strong");
        name.textContent = account.name || "HaKING kullanıcısı";
        const address = document.createElement("span");
        address.textContent = account.email;
        option.append(name, address);
        option.addEventListener("click", () => chooseSuggestion(index));
        emailSuggestions.append(option);
      });
    }

    emailSuggestions.hidden = false;
    emailInput.setAttribute("aria-expanded", "true");
  }

  function requestSuggestions(rawQuery) {
    const query = rawQuery.trim().toLowerCase();
    window.clearTimeout(suggestionTimer);
    suggestionController?.abort();
    suggestionController = null;
    suggestionItems = [];
    activeSuggestionIndex = -1;
    const requestId = ++suggestionRequestId;

    if (!query || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~@-]{1,254}$/.test(query)) {
      hideSuggestions();
      return;
    }

    showSuggestionMessage("Kayıtlı hesaplar aranıyor…");
    suggestionTimer = window.setTimeout(async () => {
      const controller = new AbortController();
      suggestionController = controller;
      try {
        const result = await apiAdminSearchCreditAccounts(token, query, controller.signal);
        if (requestId !== suggestionRequestId || emailInput.value.trim().toLowerCase() !== query) return;
        if (!result.ok) throw new Error(result.message || "Hesap önerileri alınamadı.");
        renderSuggestions(result.accounts || [], Boolean(result.has_more), query);
      } catch (error) {
        if (error.name === "AbortError" || requestId !== suggestionRequestId) return;
        showSuggestionMessage("Öneriler alınamadı. E-posta adresini yazıp ‘Hesabı bul’ düğmesini kullanabilirsin.");
      }
    }, 220);
  }

  async function renderAccount(email) {
    hideSuggestions();
    const result = await apiAdminGetCreditAccount(token, email);
    if (!result.ok) throw new Error(result.message || "Hesap bulunamadı.");
    verifiedAccountEmail = result.email;
    const pieces = [
      ["Hesap", `${result.name || "HaKING kullanıcısı"} · ${result.email}`],
      ["Aktif bakiye", `${result.total_credits} kredi`],
      ["Aylık ücretsiz", `${result.monthly_credits}/${result.monthly_allowance} kredi · ${displayDate(`${result.period_renews_at}T12:00:00+03:00`)}`],
      ["Ek paketler", `${result.purchased_credits} kredi`],
    ];
    accountCard.replaceChildren();
    for (const [label, value] of pieces) {
      const item = document.createElement("div");
      const term = document.createElement("span");
      const detail = document.createElement("strong");
      term.textContent = label;
      detail.textContent = value;
      item.append(term, detail);
      accountCard.append(item);
    }
    emailInput.value = result.email;
    renderHistory(result.grants || []);
    accountCard.classList.remove("hidden");
    updateGrantButton();
    return result;
  }

  async function lookupAccount(rawEmail) {
    hideSuggestions();
    const email = rawEmail.trim().toLowerCase();
    if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/.test(email)) {
      verifiedAccountEmail = "";
      accountCard.classList.add("hidden");
      updateGrantButton();
      setStatus(accountStatus, "Alıcının kayıtlı Gmail adresini gir.", true);
      return;
    }
    setStatus(accountStatus, "Hesap aranıyor…");
    verifiedAccountEmail = "";
    updateGrantButton();
    try {
      const account = await renderAccount(email);
      setStatus(accountStatus, `Hesap doğrulandı: ${account.email}`);
    } catch (error) {
      accountCard.classList.add("hidden");
      historyList.replaceChildren();
      setStatus(accountStatus, error.message || "Hesap bulunamadı.", true);
    }
  }

  function renderHistory(grants) {
    historyList.replaceChildren();
    if (!grants.length) {
      const empty = document.createElement("p");
      empty.textContent = "Bu hesap için henüz ek paket tanımlanmamış.";
      historyList.append(empty);
      return;
    }
    for (const grant of grants) {
      const row = document.createElement("article");
      row.className = "founder-history-row";
      const copy = document.createElement("div");
      copy.className = "founder-history-copy";
      const title = document.createElement("strong");
      title.textContent = `${grant.credits_remaining}/${grant.credits_granted} kredi kaldı`;
      const meta = document.createElement("span");
      meta.textContent = `Sipariş ${grant.order_reference} · ${displayDate(grant.granted_at)} · Son kullanım ${displayDate(grant.expires_at)} · E-posta: ${grant.notification_sent ? "gönderildi" : `${grant.notification_attempts} deneme`}`;
      copy.append(title, meta);
      row.append(copy);
      if (!grant.notification_sent) {
        const resend = document.createElement("button");
        resend.type = "button";
        resend.className = "crazy-button secondary founder-resend-button";
        resend.textContent = "Bilgilendirmeyi gönder";
        resend.addEventListener("click", async () => {
          resend.disabled = true;
          resend.textContent = "Gönderiliyor…";
          try {
            const response = await apiAdminResendCreditEmail(token, grant.id);
            if (!response.ok) throw new Error(response.message || "E-posta gönderilemedi.");
            setStatus(grantStatus, response.message || "Bilgilendirme e-postası gönderildi.");
            await renderAccount(verifiedAccountEmail);
          } catch (error) {
            setStatus(grantStatus, error.message || "E-posta gönderilemedi.", true);
            resend.disabled = false;
            resend.textContent = "Bilgilendirmeyi gönder";
          }
        });
        row.append(resend);
      }
      historyList.append(row);
    }
  }

  async function initialize() {
    if (!token) {
      window.location.replace("./index.html");
      return;
    }
    const session = await apiValidateSession(token);
    if (!session.ok || session.email.trim().toLowerCase() !== FOUNDER_EMAIL) {
      window.location.replace("./index.html");
      return;
    }
    const packageResult = await apiAdminGetCreditPackage(token);
    if (!packageResult.ok) throw new Error(packageResult.message || "Paket bilgisi alınamadı.");
    packageHeading.textContent = new Intl.NumberFormat("tr-TR").format(packageResult.credits) + " HaKING kredisi";
    const includedRequests = Math.floor(packageResult.credits / packageResult.crazy_mode_cost);
    packageMeta.textContent = packageResult.price_try.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " TL · " + includedRequests + " Çılgın Mod isteği · " + packageResult.valid_days + " gün geçerli";
  }

  lookupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await lookupAccount(emailInput.value);
  });

  grantForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isGranting || !verifiedAccountEmail || !paymentVerified.checked) return;
    const orderReference = orderInput.value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._/#-]{2,99}$/.test(orderReference)) {
      setStatus(grantStatus, "ItemSatış sipariş numarasını doğru gir.", true);
      return;
    }
    isGranting = true;
    grantButton.textContent = "Kredi tanımlanıyor…";
    updateGrantButton();
    try {
      const result = await apiAdminGrantCredits(token, verifiedAccountEmail, orderReference);
      if (!result.ok) throw new Error(result.message || "Kredi eklenemedi.");
      setStatus(grantStatus, result.message);
      orderInput.value = "";
      paymentVerified.checked = false;
      await renderAccount(verifiedAccountEmail);
    } catch (error) {
      setStatus(grantStatus, error.message || "Kredi eklenemedi.", true);
    } finally {
      isGranting = false;
      grantButton.textContent = "Ödeme onaylandı · krediyi ekle";
      updateGrantButton();
    }
  });

  emailInput.addEventListener("input", () => {
    if (emailInput.value.trim().toLowerCase() !== verifiedAccountEmail) {
      verifiedAccountEmail = "";
      accountCard.classList.add("hidden");
      updateGrantButton();
    }
    requestSuggestions(emailInput.value);
  });

  emailInput.addEventListener("keydown", (event) => {
    if (emailSuggestions.hidden) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex < 0 ? suggestionItems.length - 1 : activeSuggestionIndex - 1);
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(activeSuggestionIndex);
    } else if (event.key === "Escape") {
      hideSuggestions();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!emailPicker.contains(event.target)) hideSuggestions();
  });
  paymentVerified.addEventListener("change", updateGrantButton);

  document.getElementById("founder-logout").addEventListener("click", async () => {
    try { await apiLogout(token); } catch {}
    try { localStorage.removeItem("haking_token"); } catch {}
    window.location.replace("./index.html");
  });

  initialize().catch((error) => {
    packageHeading.textContent = "Panel yüklenemedi";
    packageMeta.textContent = error.message || "Oturum veya sunucu bağlantısını kontrol edin.";
  });
})();
