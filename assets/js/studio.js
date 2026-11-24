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
})();
