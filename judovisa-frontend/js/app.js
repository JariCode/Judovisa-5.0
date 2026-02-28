// js/app.js
// Pääohjelma: näkymien hallinta, toast-ilmoitukset, käynnistys

// ---- Toast-ilmoitukset ----
function toast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = message;
  container.appendChild(div);

  setTimeout(() => {
    div.classList.add('out');
    div.addEventListener('animationend', () => div.remove(), { once: true });
  }, duration);
}
window.toast = toast;

// ---- Teeman mukainen vahvistusmodaali (korvaa confirm()) ----
// Palauttaa Promisen: true = hyväksytty, false = peruutettu
function showConfirm({ title, message, confirmText = 'Vahvista', cancelText = 'Peruuta', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true">
        <div class="dialog-icon ${danger ? 'danger' : 'warn'}">
          ${danger
            ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
          }
        </div>
        <h3 class="dialog-title">${title}</h3>
        <p class="dialog-message">${message}</p>
        <div class="dialog-actions">
          <button class="dialog-btn cancel">${cancelText}</button>
          <button class="dialog-btn ${danger ? 'confirm-danger' : 'confirm'}">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const close = (result) => {
      overlay.classList.remove('visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      resolve(result);
    };

    overlay.querySelector('.cancel').addEventListener('click', () => close(false));
    overlay.querySelector(`.${danger ? 'confirm-danger' : 'confirm'}`).addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', esc); }
    });

    // Fokusoi vahvistusnappi
    setTimeout(() => overlay.querySelector(`.${danger ? 'confirm-danger' : 'confirm'}`).focus(), 50);
  });
}
window.showConfirm = showConfirm;

// ---- Teeman mukainen syötemodaali (korvaa prompt()) ----
// Palauttaa Promisen: string = arvo, null = peruutettu
function showPrompt({ title, message, placeholder = '', defaultValue = '', confirmText = 'OK', cancelText = 'Peruuta' }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';

    overlay.innerHTML = `
      <div class="dialog-box" role="dialog" aria-modal="true">
        <div class="dialog-icon warn">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </div>
        <h3 class="dialog-title">${title}</h3>
        ${message ? `<p class="dialog-message">${message}</p>` : ''}
        <div class="dialog-input-wrap">
          <input type="text" class="dialog-input" placeholder="${placeholder}" value="${defaultValue}" autocomplete="off">
        </div>
        <div class="dialog-actions">
          <button class="dialog-btn cancel">${cancelText}</button>
          <button class="dialog-btn confirm">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    const input = overlay.querySelector('.dialog-input');

    const close = (result) => {
      overlay.classList.remove('visible');
      overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
      resolve(result);
    };

    overlay.querySelector('.cancel').addEventListener('click', () => close(null));
    overlay.querySelector('.confirm').addEventListener('click', () => {
      const val = input.value.trim();
      close(val || null);
    });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { const val = input.value.trim(); close(val || null); }
      if (e.key === 'Escape') close(null);
    });

    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}
window.showPrompt = showPrompt;

// ---- Näkymien hallinta ----
const app = {
  currentView: null,

  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
      this.currentView = viewId;
    }
  },

  showGame() {
    this.showView('view-game');
    profile.updateHeaderUser();
    game.loadLeaderboard();
    game.loadMyScores();
  },
};
window.app = app;

// ---- Käynnistys ----
async function init() {
  // Tarkista onko salasanan palautus-token URL:ssa
  const params = new URLSearchParams(window.location.search);
  if (params.get('token')) {
    auth.handleResetPage();
    document.documentElement.classList.remove('preload');
    return;
  }

  // Tarkista onko jo kirjautunut (refresh token saattaa olla voimassa)
  try {
    const res = await api.auth.me();
    if (res.ok && res.user) {
      window.currentUser = res.user;
      app.showGame();
      document.documentElement.classList.remove('preload');
      return;
    }
  } catch {
    // ei kirjautunut
  }

  // Näytä kirjautumissivu
  app.showView('view-auth');
  document.documentElement.classList.remove('preload');
}

document.addEventListener('DOMContentLoaded', init);
