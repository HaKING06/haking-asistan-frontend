// Basit global state yöneticisi

const AppState = {
  token: null,
  email: null,
};

function loadSession() {
  AppState.token = localStorage.getItem("haking_token");
  AppState.email = localStorage.getItem("haking_email");
}

function saveSession(token, email) {
  AppState.token = token;
  AppState.email = email;
  localStorage.setItem("haking_token", token);
  localStorage.setItem("haking_email", email);
}

function clearSession() {
  AppState.token = null;
  AppState.email = null;
  localStorage.removeItem("haking_token");
  localStorage.removeItem("haking_email");
}
