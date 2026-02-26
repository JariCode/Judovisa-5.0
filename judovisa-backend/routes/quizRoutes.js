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

// Kaikki vaativat kirjautumisen
router.use(protect);

router.get('/questions', quizLimiter, quizController.getQuestions);
router.post('/submit', quizLimiter, quizController.submitAnswers);

// Top 10 leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const Score = require('../models/Score');
    const scores = await Score.aggregate([
      { $group: {
          _id: '$userId',
          username: { $first: '$username' },
          bestScore: { $max: '$correct' }
      }},
      { $sort: { bestScore: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, username: 1, bestScore: 1 } }
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

    const score = await Score.create({
      userId: req.user._id,
      username: req.user.username,
      correct,
      wrong,
      totalQuestions,
    });

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'quiz_finished',
      details: `${correct}/${totalQuestions} (${score.percentage}%)`,
    });

    res.json({ success: true, score });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
});

module.exports = router;
