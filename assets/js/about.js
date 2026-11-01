(() => {
  const API_URL = "https://haking-asistan-backend.onrender.com/ai/providers";
  const status = document.querySelector("#provider-route-status");
  const container = document.querySelector("#provider-models");

  function modelCard(provider) {
    const card = document.createElement("article");
    card.className = "about-model-card";
    const heading = document.createElement("div");
    heading.className = "about-model-head";
    const title = document.createElement("h3");
    title.textContent = provider.name;
    const state = document.createElement("span");
    state.className = `about-model-state${provider.configured ? " ready" : ""}`;
    state.textContent = provider.configured ? "Sunucuda yapılandırıldı" : "Henüz etkinleştirilmedi";
    heading.append(title, state);
    const description = document.createElement("p");
    description.textContent = provider.configured
      ? "Bu sağlayıcı otomatik model seçiminde kullanılabilir."
      : "Bu sağlayıcının sunucu anahtarı eklenince yedek/tercih seçeneği olur.";
    const list = document.createElement("ul");
    list.className = "about-model-list";
    for (const model of provider.models || []) {
      const item = document.createElement("li");
      const id = document.createElement("code");
      id.textContent = model.id;
      const purpose = document.createElement("span");
      purpose.textContent = model.purpose;
      item.append(id, purpose);
      list.append(item);
    }
    card.append(heading, description, list);
    return card;
  }

  async function loadProviders() {
    try {
      const response = await fetch(API_URL, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error("Provider status unavailable");
      const data = await response.json();
      const providers = Array.isArray(data.providers) ? data.providers : [];
      container.replaceChildren(...providers.map(modelCard));
      const activeCount = providers.filter((provider) => provider.configured).length;
      const selection = data.selection === "fixed" && data.model_override
        ? `Sunucu belirli bir modeli kullanacak şekilde ayarlı: ${data.model_override}.`
        : "İstek türüne göre model otomatik seçiliyor.";
      status.textContent = activeCount > 1
        ? `${selection} Birden fazla sağlayıcı hazır; geçici hata veya kota sınırında yedek sağlayıcı denenir.`
        : activeCount === 1
          ? `${selection} Bir sağlayıcı hazır; ikinci anahtar eklenirse sağlayıcı yedeklemesi açılır.`
          : "Henüz AI sağlayıcısı yapılandırılmamış. Sohbet yanıtları için backend'e en az bir sunucu anahtarı eklenmeli.";
    } catch {
      status.textContent = "Canlı sağlayıcı durumu şu an alınamadı. Kullanılan model listesi uygulama yapılandırmasına göre değişebilir.";
      const fallback = document.createElement("p");
      fallback.className = "about-model-card";
      fallback.textContent = "GroqCloud: openai/gpt-oss-20b ve openai/gpt-oss-120b · Google Gemini: kısa ve kapsamlı yazılım istekleri için yapılandırılmış Gemini modelleri.";
      container.replaceChildren(fallback);
    }
  }

  loadProviders();
})();
