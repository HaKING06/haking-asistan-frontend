(() => {
  function normalizeAppFragment() {
    const isLegacyChatAnchor = window.location.hash.toLowerCase() === "#chat-input";
    const isEmptyFragment = window.location.href.endsWith("#");
    if (!isLegacyChatAnchor && !isEmptyFragment) return;

    // Older share links used the textarea id as a fragment. The app does not
    // use hash routing; strip this scroll-only fragment so it cannot create a
    // second visible URL/state. Auth capability fragments (#verify=...) stay intact.
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`
    );
  }

  normalizeAppFragment();
  window.addEventListener("hashchange", normalizeAppFragment);
})();
