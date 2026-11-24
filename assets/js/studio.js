(() => {
  const links = [["about.html", "Hakkında"], ["crazy.html", "Çılgın Mod"], ["download.html", "Masaüstü"], ["privacy.html", "Gizlilik"]];
  const current = location.pathname.split("/").pop();
  const anchor = document.querySelector(".privacy-nav, .site-header");
  if (anchor) {
    const navigation = document.createElement("nav");
    navigation.className = "page-subnav";
    navigation.setAttribute("aria-label", "HaKING sayfaları");
    for (const [path, label] of links) {
      const link = document.createElement("a");
      link.href = `./${path}`;
      link.textContent = label;
      if (current === path) link.setAttribute("aria-current", "page");
      navigation.append(link);
    }
    anchor.after(navigation);
  }
  const sections = [...document.querySelectorAll(".privacy-wrap > .privacy-section")];
  const index = document.createElement("nav");
  index.className = "reading-index";
  index.setAttribute("aria-label", "Sayfa içindekiler");
  sections.forEach((section, number) => {
    const heading = section.querySelector(":scope > h2");
    if (!heading) return;
    if (!section.id) section.id = `bolum-${number + 1}`;
    const marker = document.createElement("span");
    marker.className = "section-index";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = String(number + 1).padStart(2, "0");
    heading.before(marker);
    const link = document.createElement("a");
    link.href = `#${section.id}`;
    link.textContent = heading.textContent.replace(/^\d+\.\s*/, "");
    index.append(link);
    const paragraphs = [...section.querySelectorAll(":scope > p")];
    if (paragraphs.length > 2) {
      const detail = document.createElement("details");
      detail.className = "reading-more";
      const summary = document.createElement("summary");
      summary.textContent = "Ayrıntıları oku";
      detail.append(summary);
      paragraphs[1].before(detail);
      paragraphs.slice(1).forEach(paragraph => detail.append(paragraph));
    }
  });
  const hero = document.querySelector(".privacy-hero, .crazy-hero");
  if (hero && index.children.length > 2) hero.after(index);

  // Mobile browser chrome and the on-screen keyboard change the visual viewport,
  // independently of 100vh. Keep the fixed chat shell inside that visible area.
  let viewportFrame;
  function syncViewport() {
    cancelAnimationFrame(viewportFrame);
    viewportFrame = requestAnimationFrame(() => {
      if (!document.body.classList.contains("chat-view")) return;
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty("--app-height", `${Math.round(viewport?.height || innerHeight)}px`);
      document.documentElement.style.setProperty("--app-top", `${Math.round(viewport?.offsetTop || 0)}px`);
    });
  }
  window.addEventListener("resize", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewport, { passive: true });
  window.visualViewport?.addEventListener("scroll", syncViewport, { passive: true });
  new MutationObserver(syncViewport).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  syncViewport();

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    }, { threshold: 0.06 });
    document.documentElement.classList.add("motion-enabled");
    document.querySelectorAll(".privacy-hero,.crazy-hero,.privacy-section,.hero,.feature-card,.recovery-card").forEach(element => {
      element.classList.add("motion-reveal");
      revealObserver.observe(element);
    });
  }

  const showcase = document.querySelector(".auth-showcase");
  if (showcase && !reducedMotion.matches && matchMedia("(pointer: fine)").matches) {
    let pointerFrame;
    showcase.addEventListener("pointermove", event => {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = requestAnimationFrame(() => {
        const rect = showcase.getBoundingClientRect();
        showcase.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
        showcase.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
      });
    }, { passive: true });
    showcase.addEventListener("pointerleave", () => {
      cancelAnimationFrame(pointerFrame);
      showcase.style.removeProperty("--pointer-x");
      showcase.style.removeProperty("--pointer-y");
    });
  }

  const preview = document.querySelector(".auth-preview");
  if (preview && !reducedMotion.matches) {
    const examples = [
      ["Fikrim için nereden başlamalıyım?", 'const idea = "Bir sonraki projem";\nconst plan = ["tasarla", "geliştir", "dene"];\n\nplan.forEach(step => build(step));'],
      ["Bu kodu birlikte geliştirelim.", 'async function buildIdea() {\n  const project = await create();\n  return project.improve();\n}'],
      ["Bir sonraki adımı planlayalım.", 'const nextStep = {\n  focus: "Daha iyi bir çözüm",\n  status: "Geliştiriliyor"\n};'],
    ];
    let activeExample = 0;
    setInterval(() => {
      if (document.hidden || reducedMotion.matches || !preview.getClientRects().length || document.getElementById("login-card")?.classList.contains("hidden")) return;
      activeExample = (activeExample + 1) % examples.length;
      preview.classList.remove("is-changing");
      preview.querySelector("[data-preview-prompt]").textContent = examples[activeExample][0];
      preview.querySelector("[data-preview-code]").textContent = examples[activeExample][1];
      requestAnimationFrame(() => preview.classList.add("is-changing"));
    }, 7000);
  }

  if (anchor) {
    const progress = document.createElement("div");
    progress.className = "reading-progress";
    progress.setAttribute("aria-hidden", "true");
    document.body.append(progress);
    let progressFrame;
    function updateProgress() {
      cancelAnimationFrame(progressFrame);
      progressFrame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - innerHeight;
        progress.style.transform = `scaleX(${scrollable > 0 ? Math.min(1, scrollY / scrollable) : 0})`;
      });
    }
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress, { passive: true });
    updateProgress();
  }
})();
