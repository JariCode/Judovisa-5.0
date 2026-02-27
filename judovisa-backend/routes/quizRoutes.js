// routes/quizRoutes.js
const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { protect } = require('../middleware/authMiddleware');
const rateLimit = require('express-rate-limit');

// Rajoita visa-yrityksiä (ei spammausta)
const quizLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuutti
  max: 5,
  message: { success: false, message: 'Hidasta - liikaa visa-yrityksiä' },
});

// Vastausten tarkistukselle löysempi limit (jokainen kirjain voi laukaista)
const answerLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuutti
  max: 120,            // max 120 vastausta/min per IP
  message: { success: false, message: 'Hidasta - liikaa vastausyrityksiä' },
});

// Kaikki vaativat kirjautumisen
router.use(protect);

router.get('/questions', quizLimiter, quizController.getQuestions);
router.post('/check-answer', answerLimiter, quizController.checkAnswer);
router.post('/submit', quizLimiter, quizController.submitAnswers);

// Top 10 leaderboard — paras pisteet per pelaaja, laskevassa järjestyksessä
router.get('/leaderboard', async (req, res) => {
  try {
    const Score = require('../models/Score');
    const scores = await Score.aggregate([
      { $group: {
          _id: '$userId',
          username:       { $first: '$username' },
          bestScore:      { $max: '$correct' },
          bestPercentage: { $max: '$percentage' },
      }},
      { $sort: { bestScore: -1, bestPercentage: -1 } },
      { $limit: 10 },
      // Hae displayName Person-kokoelmasta (alkuperäinen kirjoitusasu)
      { $lookup: {
          from: 'people',
          localField: '_id',
          foreignField: 'userId',
          as: 'person',
      }},
      { $project: {
          _id: 0,
          // Käytä displayName jos löytyy, muuten fallback username-kenttään
          username: { $ifNull: [{ $arrayElemAt: ['$person.displayName', 0] }, '$username'] },
          bestScore: 1,
          bestPercentage: 1,
      }},
    ]);
    res.json({ success: true, scores });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
});

// Tallenna pisteet visan jälkeen
router.post('/save-score', async (req, res) => {
  try {
    const Score = require('../models/Score');
    const { createLog } = require('../utils/logUtils');
    const { correct, wrong, totalQuestions } = req.body;

    if (correct === undefined || wrong === undefined || !totalQuestions) {
      return res.status(400).json({ success: false, message: 'correct, wrong ja totalQuestions vaaditaan' });
    }

    const score = await Score.create({
      userId: req.user._id,
      username: req.user.username,
      correct: Number(correct),
      wrong: Number(wrong),
      totalQuestions: Number(totalQuestions),
    });

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'quiz_finished',
      req,
      details: `${correct}/${totalQuestions} (${score.percentage}%)`,
    });

    res.json({ success: true, score });
  } catch (err) {
    console.error('save-score virhe:', err);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
});

module.exports = router;
