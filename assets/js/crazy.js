(() => {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };

  fetch(`${API_URL}/credits/package`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Package metadata unavailable.");
      const data = await response.json();
      for (const key of ["monthly_free_credits", "credits", "price_try", "valid_days", "crazy_mode_cost"]) {
        if (!Number.isFinite(data[key]) || data[key] <= 0) throw new Error("Invalid package metadata.");
      }
      setText("crazy-monthly-credits", String(data.monthly_free_credits));
      setText("crazy-request-cost", String(data.crazy_mode_cost));
      setText("crazy-package-validity", `${data.valid_days} gün`);
      setText("crazy-package-title", `${data.credits} ek HaKING kredisi`);
      setText("crazy-package-price", new Intl.NumberFormat("tr-TR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(data.price_try));
      setText("crazy-package-summary", `${data.credits} kredi · ${Math.floor(data.credits / data.crazy_mode_cost)} Çılgın Mod isteği`);
    })
    .catch(() => {
      // The static package details remain visible if the Render API is sleeping.
    });
})();
