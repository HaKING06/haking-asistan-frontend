(() => {
  const FOUNDER_EMAIL = "gunshalit@gmail.com";
  const token = (() => {
    try { return localStorage.getItem("haking_token") || ""; } catch { return ""; }
  })();
  const lookupForm = document.getElementById("founder-lookup-form");
  const grantForm = document.getElementById("founder-grant-form");
  const emailInput = document.getElementById("founder-email");
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

  async function renderAccount(email) {
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
    packageHeading.textContent = `${packageResult.credits} HaKING kredisi`;
    packageMeta.textContent = `${packageResult.price_try.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL · ${packageResult.crazy_mode_cost} kredi/istek · ${packageResult.valid_days} gün geçerli`;
  }

  lookupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
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
