// Wake the API while the visitor is reading or signing in.
(() => {
  let pending = null;
  let lastSuccess = 0;
  window.warmBackend = () => {
    if (pending) return pending;
    if (Date.now() - lastSuccess < 60000) return Promise.resolve();
    pending = (async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        try {
          const response = await fetch('https://haking-asistan-backend.onrender.com/', {
            cache: 'no-store', signal: controller.signal,
          });
          if (!response.ok) throw new Error('Backend is starting');
          lastSuccess = Date.now();
          return;
        } catch (error) {
          if (attempt === 2) throw error;
        } finally {
          clearTimeout(timeout);
        }
      }
    })().finally(() => { pending = null; });
    return pending;
  };
  const wake = () => {
    if (!document.hidden && navigator.onLine) window.warmBackend().catch(() => {});
  };
  wake();
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('online', wake);
})();
