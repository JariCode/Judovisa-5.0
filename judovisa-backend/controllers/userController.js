// controllers/userController.js
// Käyttäjän omien tietojen muokkaus — henkilötiedot Person-kokoelmaan

const User = require('../models/User');
const Person = require('../models/Person');
const Score = require('../models/Score');
const { createLog } = require('../utils/logUtils');
const { clearAuthCookies } = require('../utils/tokenUtils');
const validator = require('validator');

// ---- PÄIVITÄ OMAT TIEDOT ----
exports.updateMe = async (req, res) => {
  try {
    const { firstName, lastName, email, username } = req.body;

    const userUpdates   = {};
    const personUpdates = {};

    // Käyttäjätunnus → Users-kokoelma
    if (username !== undefined) {
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
        return res.status(400).json({
          success: false,
          message: 'Käyttäjätunnus: 3-30 merkkiä, vain kirjaimet/numerot/_/-',
        });
      }
      const exists = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: req.user._id },
      });
      if (exists) return res.status(400).json({ success: false, message: 'Käyttäjätunnus on jo käytössä' });
      userUpdates.username = username.toLowerCase();
    }

    // Henkilötiedot → Person-kokoelma
    if (firstName !== undefined) {
      if (!firstName.trim()) return res.status(400).json({ success: false, message: 'Etunimi ei voi olla tyhjä' });
      personUpdates.firstName = firstName.trim();
    }
    if (lastName !== undefined) {
      if (!lastName.trim()) return res.status(400).json({ success: false, message: 'Sukunimi ei voi olla tyhjä' });
      personUpdates.lastName = lastName.trim();
    }
    if (email !== undefined) {
      if (!validator.isEmail(email)) {
        return res.status(400).json({ success: false, message: 'Virheellinen sähköpostiosoite' });
      }
      const exists = await Person.findOne({
        email: email.toLowerCase(),
        userId: { $ne: req.user._id },
      });
      if (exists) return res.status(400).json({ success: false, message: 'Sähköposti on jo käytössä' });
      personUpdates.email = email.toLowerCase();
    }

    if (Object.keys(userUpdates).length === 0 && Object.keys(personUpdates).length === 0) {
      return res.status(400).json({ success: false, message: 'Ei päivitettäviä tietoja' });
    }

    // Päivitä molemmat kokoelmat tarvittaessa
    let updatedUser   = await User.findById(req.user._id);
    let updatedPerson = await Person.findOne({ userId: req.user._id });

    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(req.user._id, userUpdates, { new: true, runValidators: true });
    }
    if (Object.keys(personUpdates).length > 0) {
      updatedPerson = await Person.findOneAndUpdate(
        { userId: req.user._id },
        personUpdates,
        { new: true, runValidators: true }
      );
    }

    await createLog({
      userId: req.user._id,
      username: updatedUser.username,
      event: 'account_updated',
      req,
      details: `Päivitetty: ${[...Object.keys(userUpdates), ...Object.keys(personUpdates)].join(', ')}`,
    });

    res.json({
      success: true,
      message: 'Tiedot päivitetty',
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        role: updatedUser.role,
        firstName: updatedPerson?.firstName || '',
        lastName: updatedPerson?.lastName || '',
        email: updatedPerson?.email || '',
      },
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    console.error('Päivitysvirhe:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- VAIHDA SALASANA ----
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Molemmat salasanat vaaditaan' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Uusi salasana min 8 merkkiä' });
    }

    const user = await User.findById(req.user._id).select('+password +refreshTokens');
    const isCorrect = await user.comparePassword(currentPassword);

    if (!isCorrect) {
      return res.status(401).json({ success: false, message: 'Nykyinen salasana on väärin' });
    }

    user.password = newPassword;
    user.refreshTokens = []; // Kirjaa ulos muilta laitteilta
    await user.save();

    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'password_reset_complete',
      req,
      details: 'Salasana vaihdettu käyttäjän toimesta',
    });

    clearAuthCookies(res);
    res.json({ success: true, message: 'Salasana vaihdettu. Kirjaudu uudelleen.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- POISTA OMA TILI ----
exports.deleteMe = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'Vahvista salasanalla' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isCorrect = await user.comparePassword(password);

    if (!isCorrect) {
      return res.status(401).json({ success: false, message: 'Väärä salasana' });
    }
    // Kirjaa poisto ja tee kova poisto kaikista käyttäjään liittyvistä tiedoista
    await createLog({
      userId: req.user._id,
      username: req.user.username,
      event: 'account_deleted',
      req,
      details: 'Käyttäjä poisti oman tilinsä (hard delete)',
    });

    // Poista kaikki pistetiedot
    await Score.deleteMany({ userId: req.user._id });
    // Poista henkilötiedot
    await Person.findOneAndDelete({ userId: req.user._id });
    // Poista käyttäjä (tämä poistaa myös index-arvot käyttäjädokumentista)
    await User.findByIdAndDelete(req.user._id);

    clearAuthCookies(res);
    res.json({ success: true, message: 'Tilisi ja siihen liittyvät tiedot on poistettu' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- HAE OMAT PISTEET ----
exports.getMyScores = async (req, res) => {
  try {
    const scores = await Score.find({ userId: req.user._id })
      .sort({ quizDate: -1 })
      .limit(50);

    const stats = scores.length > 0 ? {
      totalGames: scores.length,
      avgPercentage: Math.round(scores.reduce((s, sc) => s + (sc.percentage || 0), 0) / scores.length),
      bestPercentage: Math.max(...scores.map(s => s.percentage || 0)),
    } : null;

    res.json({ success: true, scores, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};
