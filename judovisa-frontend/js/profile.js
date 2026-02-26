// js/profile.js
// Profiilin muokkaus, salasanan vaihto, tilin poisto

const profile = (() => {

  function showMsg(id, text, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.className = `auth-message ${type}`;
  }

  // ---- Profiili-tab-vaihto ----
  document.querySelectorAll('[data-ptab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.ptab;
      document.querySelectorAll('[data-ptab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.profile-form').forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`form-${tab === 'edit' ? 'profile-edit' : tab === 'password' ? 'change-password' : 'delete-account'}`).classList.add('active');
    });
  });

  // ---- Avaa profiili ----
  function open() {
    if (!window.currentUser) return;
    const u = window.currentUser;
    document.getElementById('edit-firstname').value = u.firstName || '';
    document.getElementById('edit-lastname').value  = u.lastName  || '';
    document.getElementById('edit-username').value  = u.username  || '';
    document.getElementById('edit-email').value     = u.email     || '';

    // Tyhjennä viestit
    ['profile-edit-message','profile-pw-message','profile-delete-message'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.className = 'auth-message'; }
    });

    window.app.showView('view-profile');
  }

  document.getElementById('btn-profile').addEventListener('click', open);
  document.getElementById('btn-close-profile').addEventListener('click', () => {
    window.app.showView('view-game');
  });

  // ---- Muokkaa tietoja ----
  document.getElementById('form-profile-edit').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {};
    const firstName = document.getElementById('edit-firstname').value.trim();
    const lastName  = document.getElementById('edit-lastname').value.trim();
    const username  = document.getElementById('edit-username').value.trim();
    const email     = document.getElementById('edit-email').value.trim();

    if (firstName !== window.currentUser.firstName) data.firstName = firstName;
    if (lastName  !== window.currentUser.lastName)  data.lastName  = lastName;
    if (username  !== window.currentUser.username)  data.username  = username;
    if (email     !== window.currentUser.email)     data.email     = email;

    if (Object.keys(data).length === 0) {
      return showMsg('profile-edit-message', 'Ei muutoksia tallennettavaksi', 'info');
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    const res = await api.user.updateMe(data);
    btn.disabled = false;

    if (res.ok) {
      window.currentUser = res.user;
      updateHeaderUser();
      showMsg('profile-edit-message', 'Tiedot päivitetty!', 'success');
      toast('Tiedot päivitetty', 'success');
    } else {
      showMsg('profile-edit-message', res.message || 'Päivitys epäonnistui');
    }
  });

  // ---- Vaihda salasana ----
  document.getElementById('form-change-password').addEventListener('submit', async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById('pw-current').value;
    const newPassword     = document.getElementById('pw-new').value;
    const newPassword2    = document.getElementById('pw-new2').value;

    if (newPassword !== newPassword2) {
      return showMsg('profile-pw-message', 'Uudet salasanat eivät täsmää');
    }
    if (newPassword.length < 8) {
      return showMsg('profile-pw-message', 'Salasana min. 8 merkkiä');
    }

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;

    const res = await api.user.changePassword({ currentPassword, newPassword });
    btn.disabled = false;

    if (res.ok) {
      showMsg('profile-pw-message', 'Salasana vaihdettu. Kirjaudu uudelleen.', 'success');
      setTimeout(() => {
        window.currentUser = null;
        window.app.showView('view-auth');
      }, 2000);
    } else {
      showMsg('profile-pw-message', res.message || 'Virhe');
    }
  });

  // ---- Poista tili ----
  document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    const password = document.getElementById('delete-confirm-pw').value;
    if (!password) {
      return showMsg('profile-delete-message', 'Vahvista salasanalla');
    }

    const confirmed = confirm('Haluatko varmasti poistaa tilisi? Tätä ei voi peruuttaa!');
    if (!confirmed) return;

    const res = await api.user.deleteMe({ password });

    if (res.ok) {
      toast('Tilisi on poistettu', 'info');
      window.currentUser = null;
      window.app.showView('view-auth');
    } else {
      showMsg('profile-delete-message', res.message || 'Poistaminen epäonnistui');
    }
  });

  // ---- Päivitä header ----
  function updateHeaderUser() {
    if (!window.currentUser) return;
    const u = window.currentUser;
    document.getElementById('header-username').textContent = u.username;
    const badge = document.getElementById('header-role');
    badge.textContent = u.role === 'admin' ? 'Admin' : 'Pelaaja';
    badge.className = `user-badge ${u.role}`;

    // Näytä admin-nappi admineille
    const adminBtn = document.getElementById('btn-admin');
    if (adminBtn) adminBtn.style.display = u.role === 'admin' ? 'flex' : 'none';
  }

  return { open, updateHeaderUser };
})();

window.profile = profile;
