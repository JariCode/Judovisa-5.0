// js/game.js
// Visalogiikka: kysymykset, vastausten tarkistus, pisteet

const game = (() => {

  // Kaikki kategoriat ja kysymykset (vastaukset backendistä tai staattinen)
  // Rakenne: { id, category, jpName, text, answers[], attempts }
  const QUESTIONS = [
    {
      id: 'osaekomi',
      category: 'Osaekomi-Waza',
      jpName: '抑込技',
      text: 'Kerro kuusi sidontaa (Osaekomi-Waza)',
      attempts: 6,
      answers: [
        'kesa gatame','hon kesa gatame','kuzure kesa gatame','makura kesa gatame',
        'ushiro kesa gatame','kata gatame','kami shiho gatame','kuzure kami shiho gatame',
        'yoko shiho gatame','tate shiho gatame','uki gatame','ura gatame'
      ]
    },
    {
      id: 'shimewaza',
      category: 'Shime-Waza',
      jpName: '絞技',
      text: 'Kerro kuusi kuristusta (Shime-Waza)',
      attempts: 6,
      answers: [
        'nami juji jime','gyaku juji jime','kata juji jime','hadaka jime',
        'okuri eri jime','kataha jime','katate jime','ryote jime',
        'sode guruma jime','tsukkomi jime','sankaku jime','do jime','koshi jime'
      ]
    },
    {
      id: 'kansetsuwaza',
      category: 'Kansetsu-Waza',
      jpName: '関節技',
      text: 'Kerro kuusi nivellukkoa (Kansetsu-Waza)',
      attempts: 6,
      answers: [
        'ude garami','ude hishigi juji gatame','ude hishigi ude gatame','ude hishigi hiza gatame',
        'ude hishigi waki gatame','ude hishigi hara gatame','ude hishigi ashi gatame',
        'ude hishigi te gatame','ude hishigi sankaku gatame','ashi garami','juji gatame',
        'hiza gatame','waki gatame','te gatame','sankaku gatame','hara gatame','ashi gatame','ude gatame'
      ]
    },
    {
      id: 'tewaza',
      category: 'Te-Waza',
      jpName: '手技',
      text: 'Kerro kuusi käsiheittoa (Te-Waza)',
      attempts: 6,
      answers: [
        'seoi nage','ippon seoi nage','eri seoi nage','morote seoi nage','seoi otoshi',
        'tai otoshi','kata guruma','sukui nage','obi otoshi','uki otoshi','sumi otoshi',
        'yama arashi','obi tori gaeshi','morote gari','kuchiki taoshi','kibisu gaeshi',
        'uchi mata sukashi','ko uchi gaeshi'
      ]
    },
    {
      id: 'koshiwaza',
      category: 'Koshi-Waza',
      jpName: '腰技',
      text: 'Kerro kuusi lonkkaheittoa (Koshi-Waza)',
      attempts: 6,
      answers: [
        'uki goshi','o goshi','koshi guruma','tsuri komi goshi','sode tsuri komi goshi',
        'harai goshi','tsuri goshi','hane goshi','utsuri goshi','ushiro goshi'
      ]
    },
    {
      id: 'masutemiwaza',
      category: 'Ma-Sutemi-Waza',
      jpName: '真捨身技',
      text: 'Kerro neljä selälleen tehtävää uhrautumisheittoa (Ma-Sutemi-Waza)',
      attempts: 4,
      answers: [
        'tomoe nage','sumi gaeshi','hikikomi gaeshi','tawara gaeshi','ura nage'
      ]
    },
    {
      id: 'yokosutemiwaza',
      category: 'Yoko-Sutemi-Waza',
      jpName: '横捨身技',
      text: 'Kerro kuusi kyljelleen tehtävää uhrautumisheittoa (Yoko-Sutemi-Waza)',
      attempts: 6,
      answers: [
        'yoko otoshi','tani otoshi','hane makikomi','soto makikomi','uchi makikomi',
        'uki waza','yoko wakare','yoko guruma','yoko gake','daki wakare',
        'o soto makikomi','uchi mata makikomi','harai makikomi','ko uchi makikomi',
        'kani basami','kawazu gake'
      ]
    }
  ];

  // Pelin tila
  let state = {
    questions: [],       // sekoitettu kysymyslista
    currentIndex: 0,
    currentAttemptsLeft: 0,
    givenAnswers: [],    // { text, type: 'correct'|'wrong'|'same' }
    correctAnswersGiven: new Set(), // oikeiksi tunnistetut tässä kierroksessa
    sessionScores: [],   // { categoryId, correct, wrong, skipped }
    totalScore: 0,
    totalWrong: 0,
    totalSkipped: 0,
    running: false,
  };

  // ---- Apufunktiot ----
  function normalize(str) {
    return str.trim().toLowerCase()
      .replace(/\s+/g, ' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getQ() { return state.questions[state.currentIndex]; }

  // ---- Aloita peli ----
  function start() {
    state = {
      questions: shuffle([...QUESTIONS]),
      currentIndex: 0,
      currentAttemptsLeft: 0,
      givenAnswers: [],
      correctAnswersGiven: new Set(),
      sessionScores: [],
      totalScore: 0,
      totalWrong: 0,
      totalSkipped: 0,
      running: true,
    };
    showScreen('screen-question');
    loadQuestion();
    updateProgress();
  }

  // ---- Lataa kysymys ----
  function loadQuestion() {
    const q = getQ();
    if (!q) { endGame(); return; }

    state.currentAttemptsLeft = q.attempts;
    state.givenAnswers = [];
    state.correctAnswersGiven = new Set();

    // UI päivitys
    document.getElementById('q-category').textContent = `${q.jpName} · ${q.category}`;
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('answer-input').value = '';
    document.getElementById('feedback-area').innerHTML = '';
    document.getElementById('given-answers').innerHTML = '';
    document.getElementById('given-title').textContent = '';
    document.getElementById('answer-input').focus();

    renderAttemptDots();
    updateProgress();
  }

  // ---- Yrityspalkit ----
  function renderAttemptDots() {
    const q = getQ();
    const container = document.getElementById('attempts-dots');
    container.innerHTML = '';
    for (let i = 0; i < q.attempts; i++) {
      const dot = document.createElement('div');
      dot.className = 'attempt-dot' + (i >= state.currentAttemptsLeft ? ' used' : '');
      container.appendChild(dot);
    }
  }

  // ---- Edistymispalkki ----
  function updateProgress() {
    const total = state.questions.length;
    const current = state.currentIndex + 1;
    const pct = ((state.currentIndex) / total) * 100;

    document.getElementById('progress-fill').style.width = pct + '%';
    document.getElementById('progress-current').textContent = current;
    document.getElementById('progress-total').textContent = total;
  }

  // ---- Tarkista vastaus ----
  function checkAnswer() {
    if (!state.running) return;

    const input = document.getElementById('answer-input');
    const raw = input.value;
    const answer = normalize(raw);

    if (!answer) return;

    const q = getQ();

    // Onko yrityksiä jäljellä?
    if (state.currentAttemptsLeft <= 0) {
      showFeedback('Yrityksiä ei enää jäljellä!', 'out');
      return;
    }

    // Tarkista onko jo annettu sama vastaus (oikea tai väärä)
    const alreadyGiven = state.givenAnswers.find(a => normalize(a.text) === answer);
    if (alreadyGiven) {
      // SAMA vastaus — käyttää yrityksen
      state.currentAttemptsLeft--;
      renderAttemptDots();
      showFeedback('Olet jo antanut tämän vastauksen!', 'same');
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      addAnswerChip(raw, 'same');
      state.givenAnswers.push({ text: raw, type: 'same' });
      input.value = '';
      if (state.currentAttemptsLeft <= 0) nextQuestion(true);
      return;
    }

    // Tarkista onko oikea vastaus
    const isCorrect = q.answers.some(a => normalize(a) === answer);

    // VÄÄRÄ vastaus
    if (!isCorrect) {
      state.currentAttemptsLeft--;
      renderAttemptDots();
      showFeedback('Väärä vastaus — yritä uudelleen', 'wrong');
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      addAnswerChip(raw, 'wrong');
      state.givenAnswers.push({ text: raw, type: 'wrong' });
      state.totalWrong++;
      input.value = '';
      if (state.currentAttemptsLeft <= 0) nextQuestion(true);
      return;
    }

    // OIKEA vastaus
    state.correctAnswersGiven.add(answer);
    state.totalScore++;
    addAnswerChip(raw, 'correct');
    state.givenAnswers.push({ text: raw, type: 'correct' });
    showFeedback('✓ Oikein! +1 piste', 'correct');
    input.value = '';
    input.focus();
    renderAttemptDots();

    // Onko kaikki vaaditut vastaukset annettu?
    if (state.correctAnswersGiven.size >= q.attempts) {
      showFeedback(`✓ Erinomainen! Kaikki ${q.attempts} vastausta oikein!`, 'correct');
      setTimeout(() => nextQuestion(false), 1200);
    }
  }

  // ---- Palaute UI ----
  function showFeedback(text, type) {
    const area = document.getElementById('feedback-area');
    const msg = document.createElement('div');
    msg.className = `feedback-msg ${type}`;
    msg.textContent = text;
    area.innerHTML = '';
    area.appendChild(msg);
  }

  // ---- Lisää vastaussiru ----
  function addAnswerChip(text, type) {
    const list = document.getElementById('given-answers');
    document.getElementById('given-title').textContent = 'Annetut vastaukset:';

    const chip = document.createElement('div');
    chip.className = `answer-chip ${type}`;
    const icon = type === 'correct' ? '✓' : type === 'same' ? '↻' : '✗';
    chip.textContent = `${icon} ${text}`;
    list.appendChild(chip);
  }

  // ---- Siirry seuraavaan ----
  function nextQuestion(skipped = false) {
    if (skipped) state.totalSkipped++;

    // Tallenna kategorian tulos
    const q = getQ();
    const correctCount = state.correctAnswersGiven.size;
    const wrongCount = state.givenAnswers.filter(a => a.type === 'wrong').length;
    state.sessionScores.push({
      category: q.category,
      jpName: q.jpName,
      correct: correctCount,
      wrong: wrongCount,
      required: q.attempts,
      skipped,
    });

    state.currentIndex++;

    if (state.currentIndex >= state.questions.length) {
      endGame();
    } else {
      // Animoitu siirtymä
      const card = document.getElementById('question-card');
      card.style.animation = 'none';
      card.style.opacity = '0';
      card.style.transform = 'translateX(-30px)';
      setTimeout(() => {
        card.style.animation = '';
        card.style.opacity = '';
        card.style.transform = '';
        loadQuestion();
      }, 300);
    }
  }

  // ---- Peli päättyy ----
  async function endGame() {
    state.running = false;
    showScreen('screen-results');
    renderResults();

    // Tallenna pisteet backendiin
    try {
      // Rakennetaan answers-lista viimeisimmistä vastauksista
      // Tässä yksinkertaistettu: lähetetään yhteenveto suoraan
      await saveScoreToBackend();
    } catch (err) {
      console.warn('Pisteiden tallennus epäonnistui:', err);
    }

    // Päivitä top 10
    loadLeaderboard();
    loadMyScores();
  }

  // ---- Tallenna pisteet backendiin ----
  async function saveScoreToBackend() {
    // Luodaan yksinkertainen submit: yksi "yhteenveto-question" per kategoria
    // Koska backend odottaa questionId-arrayta, käytetään suoraan score-endpointia
    // Tässä lähetetään pisteet score_saved-lokin kautta
    const res = await fetch('http://localhost:5000/api/quiz/save-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        correct: state.totalScore,
        wrong: state.totalWrong,
        totalQuestions: state.questions.length,
      }),
    });
    return res.ok;
  }

  // ---- Tulokset UI ----
  function renderResults() {
    const total = state.questions.length;
    const pct = total > 0 ? Math.round((state.totalScore / (state.totalScore + state.totalWrong)) * 100) || 0 : 0;

    // Kanji ja otsikko pisteprosenttien mukaan
    let kanji = '頑', title = 'Hyvä yritys!';
    if (pct >= 90) { kanji = '優'; title = 'Erinomainen! 🏆'; }
    else if (pct >= 70) { kanji = '良'; title = 'Hyvä suoritus!'; }
    else if (pct >= 50) { kanji = '可'; title = 'Kohtuullinen!'; }
    else { kanji = '頑'; title = 'Harjoitus tekee mestarin!'; }

    document.getElementById('results-kanji').textContent = kanji;
    document.getElementById('results-title').textContent = title;
    document.getElementById('results-points').textContent = state.totalScore;
    document.getElementById('res-correct').textContent = state.totalScore;
    document.getElementById('res-wrong').textContent = state.totalWrong;
    document.getElementById('res-skipped').textContent = state.totalSkipped;
    document.getElementById('results-pct').textContent = pct + '% oikein';

    // Kategoriaerottelu
    const catContainer = document.getElementById('category-results');
    catContainer.innerHTML = '';
    state.sessionScores.forEach(s => {
      const pctCat = s.required > 0 ? Math.round((s.correct / s.required) * 100) : 0;
      const item = document.createElement('div');
      item.className = 'cat-result-item';
      item.innerHTML = `
        <div class="cat-result-name">
          <span>${s.jpName}</span>
          <small style="color:var(--muted);font-size:12px;display:block">${s.category}</small>
        </div>
        <div class="cat-result-bar-wrap">
          <div class="cat-result-bar" style="width:0%" data-pct="${pctCat}"></div>
        </div>
        <div class="cat-result-pct">${s.correct}/${s.required}</div>
      `;
      catContainer.appendChild(item);

      // Animoi palkki
      setTimeout(() => {
        item.querySelector('.cat-result-bar').style.width = pctCat + '%';
      }, 100);
    });
  }

  // ---- Lataa leaderboard ----
  async function loadLeaderboard() {
    const container = document.getElementById('leaderboard');
    try {
      const res = await api.scores.getTop10();
      if (!res.ok || !res.scores) {
        container.innerHTML = '<li class="lb-loading">Ei tuloksia</li>';
        return;
      }

      container.innerHTML = '';
      const medals = ['🥇', '🥈', '🥉'];

      res.scores.forEach((s, i) => {
        const li = document.createElement('li');
        li.className = 'lb-item';
        li.style.animationDelay = `${i * 0.06}s`;

        const isMe = window.currentUser && s.username === window.currentUser.username;
        const rankDisplay = medals[i] || `<span class="default">${i + 1}</span>`;

        li.innerHTML = `
          <div class="lb-rank">${rankDisplay}</div>
          <div class="lb-name ${isMe ? 'is-me' : ''}">${escHtml(s.username)}${isMe ? ' (sinä)' : ''}</div>
          <div class="lb-score">${s.bestScore}</div>
        `;
        container.appendChild(li);
      });
    } catch {
      container.innerHTML = '<li class="lb-loading">Virhe ladattaessa</li>';
    }
  }

  // ---- Lataa omat pisteet ----
  async function loadMyScores() {
    const container = document.getElementById('my-scores-list');
    try {
      const res = await api.user.getMyScores();
      if (!res.ok || !res.scores?.length) {
        container.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Ei vielä suorituksia</div>';
        return;
      }

      container.innerHTML = '';
      res.scores.slice(0, 5).forEach(s => {
        const div = document.createElement('div');
        div.className = 'my-score-item';
        const date = new Date(s.quizDate).toLocaleDateString('fi-FI', { day:'2-digit', month:'2-digit' });
        div.innerHTML = `
          <span>${s.correct} pistettä</span>
          <span class="my-score-pct">${s.percentage}%</span>
          <span class="my-score-date">${date}</span>
        `;
        container.appendChild(div);
      });

      // Paras tulos aloitusnäytölle
      if (res.stats) {
        document.getElementById('my-best-score').textContent =
          `Paras tuloksesi: ${res.stats.bestPercentage}% (${res.stats.totalGames} peliä)`;
      }
    } catch {
      container.innerHTML = '<div style="color:var(--muted);font-size:13px;text-align:center">Virhe</div>';
    }
  }

  // ---- Näytä screen ----
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  // ---- Escape html ----
  function escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ---- Event listeners ----
  document.getElementById('btn-start-game').addEventListener('click', start);

  document.getElementById('btn-check').addEventListener('click', checkAnswer);

  document.getElementById('answer-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') checkAnswer();
  });

  document.getElementById('btn-skip').addEventListener('click', () => {
    if (!state.running) return;
    nextQuestion(true);
  });

  document.getElementById('btn-play-again').addEventListener('click', start);

  return { loadLeaderboard, loadMyScores, start };
})();

window.game = game;
