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

// ---- Leaderboard endpoint — lisätään quiz-routeen backendissä ----
// Huom: lisää tämä reitti judovisa-backend/routes/quizRoutes.js:iin:
//
// router.get('/leaderboard', protect, async (req, res) => {
//   try {
//     const Score = require('../models/Score');
//     const scores = await Score.aggregate([
//       { $group: { _id: '$userId', username: { $first: '$username' }, bestScore: { $max: '$correct' } } },
//       { $sort: { bestScore: -1 } },
//       { $limit: 10 },
//       { $project: { _id: 0, username: 1, bestScore: 1 } }
//     ]);
//     res.json({ ok: true, success: true, scores });
//   } catch { res.status(500).json({ success: false }); }
// });
//
// Ja save-score endpoint:
// router.post('/save-score', protect, async (req, res) => {
//   try {
//     const Score = require('../models/Score');
//     const Log = require('../models/Log');
//     const { correct, wrong, totalQuestions } = req.body;
//     const score = await Score.create({ userId: req.user._id, username: req.user.username, correct, wrong, totalQuestions });
//     await Log.create({ userId: req.user._id, username: req.user.username, event: 'quiz_finished', metadata: { details: `${correct}/${totalQuestions} (${score.percentage}%)` } });
//     res.json({ success: true, score });
//   } catch { res.status(500).json({ success: false }); }
// });

document.addEventListener('DOMContentLoaded', init);
