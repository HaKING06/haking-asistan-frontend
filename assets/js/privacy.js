(() => {
  const CONSENT_KEY = "haking_privacy_choice_v1";
  const consentVersion = 1;

  function readChoice() {
    try {
      const choice = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null");
      return choice?.version === consentVersion && choice?.necessary === true
        ? choice
        : null;
    } catch {
      return null;
    }
  }

  function createBanner() {
    document.querySelector(".privacy-cookie-banner")?.remove();
    const banner = document.createElement("section");
    banner.className = "privacy-cookie-banner";
    banner.setAttribute("aria-label", "Çerez ve tarayıcı depolama bilgisi");
    banner.innerHTML = `
      <div class="privacy-cookie-copy">
        <strong>Çerez ve tarayıcı depolama tercihleri</strong>
        <p>Oturum açma için gerekli tarayıcı depolaması kullanılır. Analiz ve reklam çerezleri kullanılmıyor. <a href="./privacy.html">Nelerin tutulduğunu incele</a></p>
      </div>
      <div class="privacy-cookie-actions">
        <button type="button" data-privacy-details>Tercihleri incele</button>
        <button type="button" class="privacy-primary" data-privacy-accept>Kabul et ve devam et</button>
      </div>`;
    document.body.append(banner);
    banner.querySelector("[data-privacy-details]").addEventListener("click", () => showModal("details"));
    banner.querySelector("[data-privacy-accept]").addEventListener("click", saveChoice);
  }

  function modalMarkup(mode, choice, stored) {
    const wasSaved = mode === "saved";
    const heading = wasSaved ? "Tercihin kaydedildi" : "Tarayıcı depolama tercihleri";
    const intro = wasSaved
      ? "Bu cihaz ve tarayıcı için kaydedilen tercihlerin şöyle:"
      : "Bu sitede şu anda yalnızca giriş ve temel tercihleri hatırlamak için gerekli tarayıcı depolaması bulunur. İsteğe bağlı analiz veya reklam takibi yoktur.";
    const dateText = choice?.savedAt
      ? new Date(choice.savedAt).toLocaleString("tr-TR")
      : "Bu tercih henüz kaydedilmedi.";
    const status = (enabled) => enabled ? "Açık" : "Kapalı";
    const storeNotice = stored === false
      ? '<p class="privacy-modal-footnote">Tarayıcı bu tercihi kalıcı kaydetmeye izin vermedi. Seçim yalnızca bu sayfa oturumu boyunca geçerlidir.</p>'
      : "";
    const actions = wasSaved
      ? `<div class="privacy-modal-actions"><a href="./privacy.html">Gizlilik metnini aç</a><button type="button" data-privacy-close>Kapat</button></div>`
      : `<div class="privacy-modal-actions"><a href="./privacy.html">Ayrıntılı gizlilik metni</a><button type="button" data-privacy-close>Geri dön</button><button type="button" class="privacy-primary" data-privacy-save>Kabul et ve devam et</button></div>`;

    return `<div class="privacy-modal-backdrop" data-privacy-backdrop>
      <section class="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title" tabindex="-1">
        <h2 id="privacy-modal-title">${heading}</h2>
        <p>${intro}</p>
        <div class="privacy-category"><div><strong>Zorunlu oturum ve tercih depolaması</strong><small>Oturum anahtarı ve bu tercih kaydı tarayıcının localStorage alanında tutulur. HTTP çerezi değildir; oturum için gereklidir.</small></div><span class="privacy-category-status">Açık (gerekli)</span></div>
        <div class="privacy-category"><div><strong>Analiz / performans çerezleri</strong><small>Site analiz aracı kullanmıyor. Bu kategoriye izin verilmedi.</small></div><span class="privacy-category-status off">${status(choice?.analytics === true)}</span></div>
        <div class="privacy-category"><div><strong>Reklam / kişiselleştirme çerezleri</strong><small>Reklam ve çapraz site takip araçları kullanılmıyor.</small></div><span class="privacy-category-status off">${status(choice?.marketing === true)}</span></div>
        <p class="privacy-modal-footnote">AI sohbet içeriğinin otomatik seçilen Groq veya Google Gemini API'sine gönderilmesi bu tarayıcı tercihinden ayrı bir işlemdir; ayrıntılar gizlilik metninde açıklanmıştır.</p>
        ${wasSaved ? `<p class="privacy-modal-footnote">Kaydedilme zamanı: ${dateText}</p>` : ""}
        ${storeNotice}${actions}
      </section>
    </div>`;
  }

  function showModal(mode, savedOverride) {
    document.querySelector(".privacy-modal-backdrop")?.remove();
    const choice = savedOverride || readChoice();
    const modal = document.createElement("div");
    modal.innerHTML = modalMarkup(mode, choice, savedOverride?._stored);
    const backdrop = modal.firstElementChild;
    document.body.append(backdrop);
    const dialog = backdrop.querySelector(".privacy-modal");
    const cleanupEscape = () => document.removeEventListener("keydown", closeOnEscape);
    dialog.focus();
    backdrop.querySelectorAll("[data-privacy-close]").forEach((button) => {
      button.addEventListener("click", () => {
        cleanupEscape();
        backdrop.remove();
        if (!readChoice()) createBanner();
      });
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        cleanupEscape();
        backdrop.remove();
        if (!readChoice()) createBanner();
      }
    });
    backdrop.querySelector("[data-privacy-save]")?.addEventListener("click", () => {
      cleanupEscape();
      saveChoice();
    });
    function closeOnEscape(event) {
      if (event.key === "Escape" && backdrop.isConnected) {
        backdrop.remove();
        if (!readChoice()) createBanner();
        cleanupEscape();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
  }

  function saveChoice() {
    const choice = {
      version: consentVersion,
      necessary: true,
      analytics: false,
      marketing: false,
      savedAt: new Date().toISOString(),
    };
    let stored = true;
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
    } catch {
      stored = false;
    }
    document.querySelector(".privacy-cookie-banner")?.remove();
    document.querySelector(".privacy-modal-backdrop")?.remove();
    showModal("saved", { ...choice, _stored: stored });
  }

  function resetChoice() {
    try {
      localStorage.removeItem(CONSENT_KEY);
    } catch {
      // The banner still allows the visitor to review the current settings.
    }
    document.querySelector(".privacy-modal-backdrop")?.remove();
    createBanner();
    showModal("details", { necessary: true, analytics: false, marketing: false });
  }

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-open-privacy-settings]")) showModal("details");
    if (event.target.closest("[data-reset-privacy-choice]")) resetChoice();
  });

  if (!readChoice()) createBanner();
})();
