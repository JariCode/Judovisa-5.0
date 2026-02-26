// controllers/quizController.js
// Visa-logiikka: kysymysten haku ja tulosten tallennus

const Question = require('../models/Question');
const Score = require('../models/Score');
const { createLog } = require('../utils/logUtils');

// ---- HAE VISALON KYSYMYKSET ----
// TÄRKEÄÄ: correctIndex ei koskaan palaudu frontendiin
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
      // Poistetaan correctIndex aggregaatiossa - ei ikinä frontendiin
      {
        $project: {
          question: 1,
          answers: 1,
          category: 1,
          difficulty: 1,
          // correctIndex: EI MUKANA
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

// ---- TARKISTA VASTAUKSET JA TALLENNA PISTEET ----
// Vastausten tarkistus tapahtuu AINA backendissä
exports.submitAnswers = async (req, res) => {
  try {
    const { answers } = req.body;
    // answers: [{ questionId: "...", selectedIndex: 2 }, ...]

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vastaukset vaaditaan',
      });
    }

    // Hae oikeat vastaukset tietokannasta
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

    // Tarkista vastaukset
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

    // Tallenna pisteet
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
