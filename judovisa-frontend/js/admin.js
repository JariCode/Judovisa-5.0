// js/admin.js
// Admin-paneeli: käyttäjät, lokitapahtumat, tilastot

const adminPanel = (() => {

  let userPage = 1;
  let logPage  = 1;

  // ---- Tab-vaihto ----
  document.querySelectorAll('[data-atab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.atab;
      document.querySelectorAll('[data-atab]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`admin-${tab}`).classList.add('active');

      if (tab === 'users') loadUsers();
      if (tab === 'logs')  loadLogs();
      if (tab === 'stats') loadStats();
    });
  });

  // ---- Avaa admin ----
  function open() {
    window.app.showView('view-admin');
    loadUsers();
  }

  document.getElementById('btn-admin').addEventListener('click', open);
  document.getElementById('btn-close-admin').addEventListener('click', () => {
    window.app.showView('view-game');
  });

  // ---- Käyttäjät ----
  async function loadUsers(page = 1) {
    userPage = page;
    const search = document.getElementById('admin-user-search').value.trim();
    const role   = document.getElementById('admin-role-filter').value;

    const params = { page, limit: 15 };
    if (search) params.search = search;
    if (role)   params.role   = role;

    const res = await api.admin.getUsers(params);
    if (!res.ok) return;

    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = '';

    if (!res.users?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Ei käyttäjiä</td></tr>';
      return;
    }

    res.users.forEach(u => {
      const tr = document.createElement('tr');
      const created = new Date(u.createdAt).toLocaleDateString('fi-FI');
      tr.innerHTML = `
        <td><strong>${escHtml(u.username)}</strong></td>
        <td>${escHtml(u.firstName)} ${escHtml(u.lastName)}</td>
        <td>${escHtml(u.email)}</td>
        <td><span class="role-badge ${u.role}">${u.role === 'admin' ? 'Admin' : 'Pelaaja'}</span></td>
        <td>${created}</td>
        <td>
          <div class="action-btns">
            <button class="btn-table edit" onclick="adminPanel.editUser('${u._id}', '${escHtml(u.username)}')">Muokkaa</button>
            <button class="btn-table role" onclick="adminPanel.toggleRole('${u._id}', '${u.role}', '${escHtml(u.username)}')">
              ${u.role === 'admin' ? '→ Pelaaja' : '→ Admin'}
            </button>
            <button class="btn-table del" onclick="adminPanel.deleteUser('${u._id}', '${escHtml(u.username)}')">Poista</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination('admin-users-pagination', res.pagination, (p) => loadUsers(p));
  }

  // ---- Muokkaa käyttäjää ----
  async function editUser(id, username) {
    const newUsername = prompt(`Uusi käyttäjätunnus (nykyinen: ${username})`);
    if (!newUsername || newUsername === username) return;

    const res = await api.admin.updateUser(id, { username: newUsername });
    if (res.ok) {
      toast(`Käyttäjä ${username} päivitetty`, 'success');
      loadUsers(userPage);
    } else {
      toast(res.message || 'Virhe', 'error');
    }
  }

  // ---- Vaihda rooli ----
  async function toggleRole(id, currentRole, username) {
    const newRole = currentRole === 'admin' ? 'player' : 'admin';
    const confirmed = confirm(`Vaihdetaanko ${username} rooli: ${currentRole} → ${newRole}?`);
    if (!confirmed) return;

    const res = await api.admin.changeRole(id, { role: newRole });
    if (res.ok) {
      toast(`Rooli vaihdettu: ${username} on nyt ${newRole}`, 'success');
      loadUsers(userPage);
    } else {
      toast(res.message || 'Virhe', 'error');
    }
  }

  // ---- Poista käyttäjä ----
  async function deleteUser(id, username) {
    const confirmed = confirm(`Poistetaanko käyttäjä ${username}? Tätä ei voi peruuttaa.`);
    if (!confirmed) return;

    const res = await api.admin.deleteUser(id);
    if (res.ok) {
      toast(`Käyttäjä ${username} poistettu`, 'success');
      loadUsers(userPage);
    } else {
      toast(res.message || 'Virhe', 'error');
    }
  }

  // ---- Hakusuodatin ----
  let searchTimer;
  document.getElementById('admin-user-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadUsers(1), 400);
  });
  document.getElementById('admin-role-filter').addEventListener('change', () => loadUsers(1));

  // ---- Lokitapahtumat ----
  async function loadLogs(page = 1) {
    logPage = page;
    const event     = document.getElementById('admin-log-event').value;
    const startDate = document.getElementById('admin-log-start').value;
    const endDate   = document.getElementById('admin-log-end').value;

    const params = { page, limit: 20 };
    if (event) params.event = event;
    if (startDate) params.startDate = startDate;
    if (endDate)   params.endDate   = endDate + 'T23:59:59';

    const res = await api.admin.getLogs(params);
    if (!res.ok) return;

    const tbody = document.getElementById('admin-logs-tbody');
    tbody.innerHTML = '';

    if (!res.logs?.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Ei lokitapahtumia</td></tr>';
      return;
    }

    res.logs.forEach(log => {
      const tr = document.createElement('tr');
      const time = new Date(log.timestamp).toLocaleString('fi-FI', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });
      const eventClass = ['login','login_failed','register','logout','quiz_finished','role_changed','account_deleted'].includes(log.event)
        ? log.event : 'default';

      tr.innerHTML = `
        <td style="white-space:nowrap;font-size:12px;color:var(--muted)">${time}</td>
        <td>${escHtml(log.username || '—')}</td>
        <td><span class="event-badge ${eventClass}">${log.event}</span></td>
        <td>${log.targetUsername ? escHtml(log.targetUsername) : '—'}</td>
        <td style="font-size:12px;color:var(--muted)">${log.metadata?.details || log.metadata?.ipAddress || '—'}</td>
      `;
      tbody.appendChild(tr);
    });

    renderPagination('admin-logs-pagination', res.pagination, (p) => loadLogs(p));
  }

  document.getElementById('btn-filter-logs').addEventListener('click', () => loadLogs(1));

  // ---- Tilastot ----
  async function loadStats() {
    const res = await api.admin.getStats();
    if (!res.ok) return;

    const s = res.stats;
    document.getElementById('stat-players').textContent = s.totalUsers ?? '—';
    document.getElementById('stat-admins').textContent  = s.totalAdmins ?? '—';
    document.getElementById('stat-scores').textContent  = s.totalScores ?? '—';

    if (s.recentLogs?.length) {
      const container = document.getElementById('stats-recent-logs');
      container.innerHTML = '';
      const ul = document.createElement('ul');
      ul.style.cssText = 'list-style:none;display:flex;flex-direction:column;gap:8px';

      s.recentLogs.forEach(log => {
        const li = document.createElement('li');
        li.style.cssText = 'display:flex;gap:12px;align-items:center;padding:10px 14px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:13px';
        const time = new Date(log.timestamp).toLocaleString('fi-FI', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
        const eventClass = ['login','login_failed','register','logout','quiz_finished','role_changed','account_deleted'].includes(log.event) ? log.event : 'default';
        li.innerHTML = `
          <span style="color:var(--muted);white-space:nowrap">${time}</span>
          <span class="event-badge ${eventClass}">${log.event}</span>
          <span style="color:var(--parchment)">${escHtml(log.username || '—')}</span>
        `;
        ul.appendChild(li);
      });
      container.appendChild(ul);
    }
  }

  // ---- Sivutus ----
  function renderPagination(containerId, pagination, callback) {
    const container = document.getElementById(containerId);
    if (!container || !pagination || pagination.pages <= 1) {
      if (container) container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    const { page, pages } = pagination;

    // Näytä sivunumerot ikkunan kautta
    const range = [];
    for (let i = Math.max(1, page - 2); i <= Math.min(pages, page + 2); i++) {
      range.push(i);
    }

    if (range[0] > 1) {
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.textContent = '1';
      btn.onclick = () => callback(1);
      container.appendChild(btn);
      if (range[0] > 2) container.appendChild(Object.assign(document.createElement('span'), { textContent: '…', style: 'color:var(--muted);padding:0 6px' }));
    }

    range.forEach(p => {
      const btn = document.createElement('button');
      btn.className = `page-btn${p === page ? ' active' : ''}`;
      btn.textContent = p;
      btn.onclick = () => callback(p);
      container.appendChild(btn);
    });

    if (range[range.length - 1] < pages) {
      if (range[range.length - 1] < pages - 1) container.appendChild(Object.assign(document.createElement('span'), { textContent: '…', style: 'color:var(--muted);padding:0 6px' }));
      const btn = document.createElement('button');
      btn.className = 'page-btn';
      btn.textContent = pages;
      btn.onclick = () => callback(pages);
      container.appendChild(btn);
    }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  return { open, editUser, toggleRole, deleteUser };
})();

window.adminPanel = adminPanel;
