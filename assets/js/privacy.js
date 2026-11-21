(() => {
  const KEY = "haking_privacy_choice_v1";
  const VERSION = 2;
  let memoryChoice = null, closeModal;
  const shield = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5.5c0 4.5 3 7.8 7.5 9.5 4.5-1.7 7.5-5 7.5-9.5V6L12 3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.8"/></svg>';
  function readChoice() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || "null");
      if (value?.version === VERSION && value.necessary === true) return value;
    } catch { /* Storage may be disabled; use this page's in-memory choice. */ }
    return memoryChoice;
  }
  function createBanner() {
    document.querySelector(".privacy-cookie-banner")?.remove();
    const banner = document.createElement("section");
    banner.className = "privacy-cookie-banner";
    banner.setAttribute("aria-labelledby", "privacy-banner-title");
    banner.innerHTML = `
      <div class="privacy-cookie-heading"><span class="privacy-shield">${shield}</span><div><span class="privacy-kicker">GİZLİLİĞİN ÖNEMLİ</span><h2 id="privacy-banner-title">Kontrol sende.</h2></div></div>
      <p class="privacy-cookie-description">Oturumunu, güvenlik kontrollerini ve bu cihazdaki sohbetlerini çalıştırmak için tarayıcı depolaması kullanıyoruz. Reklam çerezi kullanmıyoruz.</p>
      <div class="privacy-cookie-actions"><button type="button" data-privacy-details>Ayrıntıları gör</button><button type="button" class="privacy-primary" data-privacy-accept>Kabul et ve devam et <span aria-hidden="true">→</span></button></div>
      <p class="privacy-cookie-note"><span aria-hidden="true">●</span> Zorunlu depolama · Reklam takibi yok <a href="./privacy.html">Gizlilik politikası</a></p>`;
    document.body.append(banner);
    banner.querySelector("[data-privacy-details]").addEventListener("click", showModal);
    banner.querySelector("[data-privacy-accept]").addEventListener("click", saveChoice);
  }
  function showModal() {
    closeModal?.();
    const previousFocus = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "privacy-modal-backdrop";
    backdrop.innerHTML = `<section class="privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-modal-title" aria-describedby="privacy-modal-intro" tabindex="-1">
      <header class="privacy-modal-header"><span class="privacy-shield">${shield}</span><button type="button" class="privacy-close" data-privacy-close aria-label="Tercih penceresini kapat">×</button></header>
      <span class="privacy-kicker">ÇEREZLER VE TARAYICI DEPOLAMASI</span><h2 id="privacy-modal-title">Neyin kullanıldığını bil.</h2>
      <p id="privacy-modal-intro">Giriş ve güvenlik için gereken araçları kullanıyoruz. Her birinin ne işe yaradığını aşağıda görebilirsin.</p>
      <div class="privacy-categories">
        <details class="privacy-category" open><summary><span>Oturum ve güvenlik</span><span class="privacy-category-status">Gerekli</span></summary><p>HaKING oturum anahtarı ve bu seçim localStorage'da saklanır. Cloudflare Turnstile ve site güvenlik kontrolleri botları engeller. Bu araçlar giriş işleminin parçasıdır.</p></details>
        <details class="privacy-category"><summary><span>Bu cihazdaki sohbetler</span><span class="privacy-category-status">Yerel</span></summary><p>Sohbet belleği bu tarayıcıda saklanır. Sohbetlerini uygulamadaki Ayarlar bölümünden temizleyebilirsin; bu pencere onları silmez.</p></details>
        <details class="privacy-category"><summary><span>Google ile giriş</span><span class="privacy-category-status">Seçimine bağlı</span></summary><p>Google yöntemini seçtiğinde Google Identity Services yüklenir. Google doğrulanmış Gmail adresini, adını ve hesap kimliğini paylaşır. Google şifren HaKING'e gelmez. Google kendi giriş çerezlerini işleyebilir. Alternatif olarak Gmail ve şifre yöntemini kullanabilirsin.</p></details>
        <details class="privacy-category"><summary><span>Çerezsiz performans ölçümü</span><span class="privacy-category-status">Cloudflare</span></summary><p>Cloudflare Web Analytics sayfa ve performans ölçümleri sağlayabilir. Bu ölçüm çerez veya localStorage kullanmaz. Bu panel Cloudflare'ın çerezsiz ölçümünü açıp kapatmaz.</p></details>
        <details class="privacy-category"><summary><span>Reklam ve kişiselleştirme</span><span class="privacy-category-status off">Kullanılmıyor</span></summary><p>Reklam çerezi ve siteler arası reklam takip aracı eklemiyoruz.</p></details>
      </div>
      <p class="privacy-modal-footnote">Bu tercih bu tarayıcı için geçerlidir. Google girişini kullanmak ve AI sağlayıcılarına mesaj göndermek ayrı işlemlerdir.</p>
      <div class="privacy-modal-actions"><a href="./privacy.html">Gizlilik politikasını oku ↗</a><button type="button" class="privacy-primary" data-privacy-save>Kabul et ve devam et</button></div>
    </section>`;
    document.body.append(backdrop);
    const dialog = backdrop.querySelector(".privacy-modal");
    const controller = new AbortController();
    const overflow = document.body.style.overflow;
    const inertElements = [...document.body.children].filter(el => el !== backdrop && el.tagName !== "SCRIPT" && !el.inert);
    inertElements.forEach(el => { el.inert = true; });
    document.body.style.overflow = "hidden";
    closeModal = () => {
      controller.abort();
      inertElements.forEach(el => { el.inert = false; });
      document.body.style.overflow = overflow;
      backdrop.remove();
      closeModal = undefined;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
    backdrop.querySelector("[data-privacy-close]").addEventListener("click", () => closeModal?.());
    backdrop.querySelector("[data-privacy-save]").addEventListener("click", saveChoice);
    backdrop.addEventListener("click", event => { if (event.target === backdrop) closeModal?.(); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeModal?.(); }
      if (event.key !== "Tab") return;
      const items = [...dialog.querySelectorAll('button, a, summary')].filter(el => el.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus(); }
    }, { signal: controller.signal });
    dialog.focus();
  }
  function saveChoice() {
    memoryChoice = { version: VERSION, necessary: true, marketing: false, savedAt: new Date().toISOString() };
    let stored = true;
    try { localStorage.setItem(KEY, JSON.stringify(memoryChoice)); } catch { stored = false; }
    closeModal?.();
    document.querySelector(".privacy-cookie-banner")?.remove();
    document.querySelector(".privacy-toast")?.remove();
    const toast = document.createElement("p");
    toast.className = "privacy-toast";
    toast.setAttribute("role", "status");
    toast.textContent = stored ? "Tercihin kaydedildi. Gizlilik ayarlarından tekrar inceleyebilirsin." : "Tercihin bu oturum için kaydedildi. Tarayıcı kalıcı depolamaya izin vermiyor.";
    document.body.append(toast);
    setTimeout(() => toast.remove(), 5000);
  }
  document.addEventListener("click", event => {
    if (event.target.closest("[data-open-privacy-settings]")) showModal();
    if (event.target.closest("[data-reset-privacy-choice]")) {
      closeModal?.(); memoryChoice = null;
      try { localStorage.removeItem(KEY); } catch { /* Review works without storage. */ }
      createBanner(); showModal();
    }
  });
  if (!readChoice()) createBanner();
})();
