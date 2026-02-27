// controllers/quizController.js
// Visa-logiikka: kysymysten haku ja tulosten tallennus

const Question = require('../models/Question');
const Score = require('../models/Score');
const { createLog } = require('../utils/logUtils');

// Normalisoi vastauksia:
// - pienet kirjaimet
// - diakriittiset merkit pois
// - KAIKKI välilyönnit, väliviivat ja alaviivat poistetaan
// Näin "Kesa Gatame", "kesa-gatame", "ke sa ga ta me", "KESA GATAME" kaikki täsmäävät
function normalizeAnswer(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // diakriittiset pois
    .replace(/[\s\-_]+/g, '');        // välilyönnit, väliviivat, alaviivat pois
}

// ---- HAE VISALON KYSYMYKSET ----
// TÄRKEÄÄ: answers ei koskaan palaudu frontendiin
exports.getQuestions = async (req, res) => {
  try {
    const { count = 10, category = '', difficulty = '' } = req.query;

    const query = { isActive: true };
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    // Hae satunnaisia kysymyksiä MongoDB aggregaatiolla
    const questions = await Question.aggregate([
      { $match: query },
      { $sample: { size: Number(count) } },
      // Poistetaan answers - ei koskaan frontendiin
      {
        $project: {
          _id: 1,
          questionText: 1,
          category: 1,
          jpName: 1,
          attempts: 1,
          // answers: EI MUKANA
        },
      },
    ]);

    if (questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kysymyksiä ei löydy',
      });
    }

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'quiz_started',
      req,
      details: `${questions.length} kysymystä`,
    });

    res.json({
      success: true,
      questions,
      totalCount: questions.length,
    });
  } catch (error) {
    console.error('Kysymysten haku virhe:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- TARKISTA YKSITTÄINEN VASTAUS ----
// Frontend lähettää: { questionId, given }
// Backend palauttaa: { correct: true/false }
// Oikeita vastauksia EI koskaan lähetetä takaisin frontendiin
exports.checkAnswer = async (req, res) => {
  try {
    const { questionId, given } = req.body;
    if (!questionId || typeof given !== 'string') {
      return res.status(400).json({ success: false, message: 'questionId ja given vaaditaan' });
    }

    const q = await Question.findById(questionId).lean();
    if (!q || !q.isActive) {
      return res.status(404).json({ success: false, message: 'Kysymystä ei löytynyt' });
    }

    // Normalisoi käyttäjän vastaus
    const normalGiven = normalizeAnswer(given);

    // Normalisoi kaikki hyväksytyt vastaukset ja tarkista täsmääkö
    const correctSet = new Set((q.answers || []).map(a => normalizeAnswer(a)));
    const isCorrect = correctSet.has(normalGiven);

    // Palautetaan VAIN oikeellisuus — ei oikeaa vastausta, ei vastauslistaa
    res.json({ success: true, correct: isCorrect });
  } catch (error) {
    console.error('checkAnswer virhe:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- TARKISTA VASTAUKSET JA TALLENNA PISTEET ----
exports.submitAnswers = async (req, res) => {
  try {
    const { answers } = req.body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vastaukset vaaditaan',
      });
    }

    const questionIds = answers.map((a) => a.questionId);
    const questions = await Question.find({
      _id: { $in: questionIds },
      isActive: true,
    }).select('+correctIndex');

    if (questions.length !== answers.length) {
      return res.status(400).json({
        success: false,
        message: 'Virheellisiä kysymyksiä',
      });
    }

    const results = answers.map((answer) => {
      const question = questions.find(
        (q) => q._id.toString() === answer.questionId
      );
      if (!question) return { questionId: answer.questionId, correct: false };

      const isCorrect = question.correctIndex === answer.selectedIndex;
      return {
        questionId: answer.questionId,
        selectedIndex: answer.selectedIndex,
        correctIndex: question.correctIndex,
        correct: isCorrect,
        question: question.question,
      };
    });

    const correctCount = results.filter((r) => r.correct).length;
    const wrongCount = results.length - correctCount;

    const score = await Score.create({
      userId: req.user._id,
      username: req.user.username,
      correct: correctCount,
      wrong: wrongCount,
      totalQuestions: answers.length,
    });

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'quiz_finished',
      req,
      details: `${correctCount}/${answers.length} oikein (${score.percentage}%)`,
    });

    res.json({
      success: true,
      results,
      score: {
        correct: correctCount,
        wrong: wrongCount,
        total: answers.length,
        percentage: score.percentage,
      },
    });
  } catch (error) {
    console.error('Vastausten tarkistusvirhe:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};
