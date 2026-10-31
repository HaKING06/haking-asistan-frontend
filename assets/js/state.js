// Basit global state yöneticisi

const AppState = {
  token: null,
  email: null,
  history: [],
};

function loadSession() {
  try {
    AppState.token = localStorage.getItem("haking_token");
    // Remove the legacy persisted email; the API returns it after session validation.
    localStorage.removeItem("haking_email");
  } catch {
    AppState.token = null;
  }
  AppState.email = null;
}

function saveSession(token, email) {
  AppState.token = token;
  AppState.email = email;
  try {
    localStorage.setItem("haking_token", token);
  } catch {
    // Keep the session in memory for this tab when browser storage is blocked.
  }
}

function clearSession() {
  AppState.token = null;
  AppState.email = null;
  try {
    localStorage.removeItem("haking_token");
    localStorage.removeItem("haking_email");
  } catch {
    // The in-memory session is cleared even if browser storage is unavailable.
  }
}
