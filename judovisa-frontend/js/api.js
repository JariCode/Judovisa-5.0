// js/api.js
// Kaikki API-kutsut yhteen paikkaan
// credentials: 'include' — TÄRKEÄÄ httpOnly cookieille

// Use 127.0.0.1 to match Live Server origin and backend cookie host
const API_BASE = 'http://127.0.0.1:5000/api';

const api = {
  // Perusfunktio
  async request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include', // httpOnly cookies mukaan
      ...options,
    });

    const data = await res.json();

    // Jos token vanhentunut, yritetään refresh automaattisesti
    if (res.status === 401 && data.code === 'TOKEN_EXPIRED') {
      const refreshed = await api.auth.refresh();
      if (refreshed) {
        // Yritä uudelleen
        return api.request(path, options);
      } else {
        // Refresh epäonnistui → kirjaudu ulos
        window.dispatchEvent(new Event('auth:logout'));
        return data;
      }
    }

    return { ok: res.ok, status: res.status, ...data };
  },

  // ---- AUTH ----
  auth: {
    register: (d) => api.request('/auth/register', { method: 'POST', body: JSON.stringify(d) }),
    login:    (d) => api.request('/auth/login',    { method: 'POST', body: JSON.stringify(d) }),
    logout:   ()  => api.request('/auth/logout',   { method: 'POST' }),
    refresh:  async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        return res.ok;
      } catch { return false; }
    },
    me:             () => api.request('/auth/me'),
    forgotPassword: (d) => api.request('/auth/forgot-password', { method: 'POST', body: JSON.stringify(d) }),
    resetPassword:  (d) => api.request('/auth/reset-password',  { method: 'POST', body: JSON.stringify(d) }),
  },

  // ---- USER ----
  user: {
    updateMe:       (d) => api.request('/users/me',          { method: 'PATCH',  body: JSON.stringify(d) }),
    changePassword: (d) => api.request('/users/me/password', { method: 'PATCH',  body: JSON.stringify(d) }),
    deleteMe:       (d) => api.request('/users/me',          { method: 'DELETE', body: JSON.stringify(d) }),
    getMyScores:    ()  => api.request('/users/me/scores'),
  },

  // ---- QUIZ ----
  quiz: {
    getQuestions:  (count) => api.request(`/quiz/questions?count=${count || 10}`),
    // Tarkistaa yksittäisen vastauksen backendissä — vastauksia ei koskaan palauteta frontendiin
    checkAnswer:   (d)     => api.request('/quiz/check-answer', { method: 'POST', body: JSON.stringify(d) }),
    submitAnswers: (d)     => api.request('/quiz/submit',       { method: 'POST', body: JSON.stringify(d) }),
    saveScore:     (d)     => api.request('/quiz/save-score',   { method: 'POST', body: JSON.stringify(d) }),
  },

  // ---- SCORES (leaderboard) ----
  scores: {
    getTop10: () => api.request('/quiz/leaderboard'),
  },

  // ---- ADMIN ----
  admin: {
    getStats:       ()  => api.request('/admin/stats'),
    getUsers:       (p) => api.request(`/admin/users?${new URLSearchParams(p)}`),
    updateUser:     (id, d) => api.request(`/admin/users/${id}`,      { method: 'PATCH',  body: JSON.stringify(d) }),
    changeRole:     (id, d) => api.request(`/admin/users/${id}/role`, { method: 'PATCH',  body: JSON.stringify(d) }),
    deleteUser:     (id)    => api.request(`/admin/users/${id}`,      { method: 'DELETE' }),
    getLogs:        (p)     => api.request(`/admin/logs?${new URLSearchParams(p)}`),
  },
};

window.api = api;
