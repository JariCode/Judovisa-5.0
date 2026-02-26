// js/auth.js
// Kirjautuminen, rekisteröityminen, salasanan palautus

const auth = (() => {

  // ---- Näytä viesti lomakkeessa ----
  function showMsg(id, text, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `auth-message ${type}`;
  }

  function clearMsg(id) {
    const el = document.getElementById(id);
    if (el) { el.textContent = ''; el.className = 'auth-message'; }
  }

  // ---- Tab-vaihto auth-sivulla ----
  document.querySelectorAll('#view-auth .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      document.querySelectorAll('#view-auth .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#view-auth .auth-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`form-${tab}`).classList.add('active');
    });
  });

  // ---- KIRJAUTUMINEN ----
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg('login-message');

    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
      return showMsg('login-message', 'Täytä kaikki kentät');
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Kirjaudutaan...';

    const res = await api.auth.login({ username, password });

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Kirjaudu sisään';

    if (res.ok) {
      window.currentUser = res.user;
      window.app.showGame();
      toast('Tervetuloa, ' + res.user.username + '!', 'success');
    } else {
      showMsg('login-message', res.message || 'Kirjautuminen epäonnistui');
    }
  });

  // ---- REKISTERÖITYMINEN ----
  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMsg('register-message');

    const data = {
      firstName: document.getElementById('reg-firstname').value.trim(),
      lastName:  document.getElementById('reg-lastname').value.trim(),
      username:  document.getElementById('reg-username').value.trim(),
      email:     document.getElementById('reg-email').value.trim(),
      password:  document.getElementById('reg-password').value,
    };

    if (Object.values(data).some(v => !v)) {
      return showMsg('register-message', 'Täytä kaikki kentät');
    }
    if (data.password.length < 8) {
      return showMsg('register-message', 'Salasana min. 8 merkkiä');
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Luodaan tiliä...';

    const res = await api.auth.register(data);

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Luo tili';

    if (res.ok) {
      window.currentUser = res.user;
      window.app.showGame();
      toast('Tervetuloa Judovisaan, ' + res.user.username + '!', 'success');
    } else {
      showMsg('register-message', res.message || 'Rekisteröityminen epäonnistui');
    }
  });

  // ---- SALASANAN PALAUTUS ----
  document.getElementById('btn-forgot').addEventListener('click', () => {
    window.app.showView('view-forgot');
  });

  document.getElementById('btn-back-from-forgot').addEventListener('click', () => {
    window.app.showView('view-auth');
  });

  document.getElementById('form-forgot').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) return;

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Lähetetään...';

    const res = await api.auth.forgotPassword({ email });

    btn.disabled = false;
    btn.querySelector('span').textContent = 'Lähetä linkki';

    // Aina sama viesti turvallisuuden vuoksi
    showMsg('forgot-message', res.message || 'Jos sähköposti on rekisteröity, lähetimme linkin.', 'success');
  });

  // ---- SALASANAN VAIHTO (reset token URL:ssa) ----
  async function handleResetPage() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    window.app.showView('view-reset');

    document.getElementById('form-reset').addEventListener('submit', async (e) => {
      e.preventDefault();
      const password  = document.getElementById('reset-password').value;
      const password2 = document.getElementById('reset-password2').value;

      if (password !== password2) {
        return showMsg('reset-message', 'Salasanat eivät täsmää');
      }
      if (password.length < 8) {
        return showMsg('reset-message', 'Salasana min. 8 merkkiä');
      }

      const res = await api.auth.resetPassword({ token, password });

      if (res.ok) {
        showMsg('reset-message', 'Salasana vaihdettu! Kirjaudu sisään.', 'success');
        setTimeout(() => {
          window.history.replaceState({}, '', '/');
          window.app.showView('view-auth');
        }, 2500);
      } else {
        showMsg('reset-message', res.message || 'Linkki on vanhentunut');
      }
    });
  }

  // ---- ULOSKIRJAUTUMINEN ----
  document.getElementById('btn-logout').addEventListener('click', async () => {
    await api.auth.logout();
    window.currentUser = null;
    window.app.showView('view-auth');
    toast('Kirjauduit ulos', 'info');
  });

  // Automaattinen uloskirjautuminen token-ongelmissa
  window.addEventListener('auth:logout', () => {
    window.currentUser = null;
    window.app.showView('view-auth');
  });

  return { handleResetPage };
})();

window.auth = auth;
