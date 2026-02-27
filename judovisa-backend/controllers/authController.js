// controllers/authController.js
// Rekisteröityminen luo sekä User- että Person-dokumentin

const crypto = require('crypto');
const User = require('../models/User');
const Person = require('../models/Person');
const {
  createAccessToken,
  createRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  verifyRefreshToken,
} = require('../utils/tokenUtils');
const { createLog } = require('../utils/logUtils');
const { sendPasswordResetEmail } = require('../utils/emailUtils');

// ---- Apufunktio: rakenna käyttäjävastaus ----
function buildUserResponse(user, person) {
  // displayName säilyttää alkuperäisen kirjoitusasun (esim. "Jarppa")
  // username on aina lowercase (haku/kirjautuminen)
  const displayName = person?.displayName || user.username;
  return {
    id: user._id,
    username: displayName,
    role: user.role,
    firstName: person?.firstName || '',
    lastName: person?.lastName || '',
    email: person?.email || '',
  };
}

// ---- REKISTERÖITYMINEN ----
exports.register = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(400).json({
        success: false,
        message: 'Kaikki kentät vaaditaan',
      });
    }

    // Tarkista onko tunnus jo käytössä
    const existingUser = await User.findOne({ username: username.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Käyttäjätunnus on jo käytössä' });
    }

    // Tarkista onko email jo käytössä (Person-kokoelmasta)
    const existingPerson = await Person.findOne({ email: email.toLowerCase() });
    if (existingPerson) {
      return res.status(400).json({ success: false, message: 'Sähköposti on jo käytössä' });
    }

    // Luo User (tunnistautumistiedot)
    const user = await User.create({
      username: username.toLowerCase(),
      password,
      role: 'player',
    });

    // Luo Person (henkilötiedot) — viittaa Useriin
    const person = await Person.create({
      userId: user._id,
      displayName: username.trim(), // alkuperäinen kirjoitusasu talteen
      firstName,
      lastName,
      email: email.toLowerCase(),
    });

    await createLog({
      userId: user._id,
      username: user.username,
      event: 'register',
      req,
    });

    // Kirjaa sisään heti
    const accessToken = createAccessToken(user._id, user.role);
    const refreshToken = createRefreshToken(user._id);

    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
    });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    res.status(201).json({
      success: true,
      message: 'Rekisteröityminen onnistui!',
      user: buildUserResponse(user, person),
    });
  } catch (error) {
    // Jos User luotiin mutta Person epäonnistui, poistetaan User
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages[0] });
    }
    console.error('Rekisteröitymisvirhe:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- KIRJAUTUMINEN ----
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Käyttäjätunnus ja salasana vaaditaan',
      });
    }

    const user = await User.findOne({ username: username.toLowerCase() }).select(
      '+password +loginAttempts +lockUntil +refreshTokens +isActive'
    );

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Virheellinen käyttäjätunnus tai salasana',
      });
    }

    if (user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        success: false,
        message: `Tili on lukittu. Yritä ${minutesLeft} min kuluttua.`,
      });
    }

    const isPasswordCorrect = await user.comparePassword(password);

    if (!isPasswordCorrect) {
      await user.incrementLoginAttempts();
      await createLog({ userId: user._id, username: user.username, event: 'login_failed', req });
      return res.status(401).json({
        success: false,
        message: 'Virheellinen käyttäjätunnus tai salasana',
      });
    }

    if (user.loginAttempts > 0) {
      await User.findByIdAndUpdate(user._id, {
        $set: { loginAttempts: 0 },
        $unset: { lockUntil: 1 },
      });
    }

    // Hae henkilötiedot Person-kokoelmasta
    const person = await Person.findOne({ userId: user._id });

    const accessToken = createAccessToken(user._id, user.role);
    const refreshToken = createRefreshToken(user._id);

    const currentTokens = user.refreshTokens || [];
    await User.findByIdAndUpdate(user._id, {
      refreshTokens: [...currentTokens.slice(-4), refreshToken],
    });

    await createLog({ userId: user._id, username: user.username, event: 'login', req });

    setAccessTokenCookie(res, accessToken);
    setRefreshTokenCookie(res, refreshToken);

    res.json({
      success: true,
      message: 'Kirjautuminen onnistui',
      user: buildUserResponse(user, person),
    });
  } catch (error) {
    console.error('Kirjautumisvirhe:', error);
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- ULOSKIRJAUTUMINEN ----
exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken && req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: refreshToken },
      });
      await createLog({ userId: req.user._id, username: req.user.username, event: 'logout', req });
    }

    clearAuthCookies(res);
    res.json({ success: true, message: 'Uloskirjautuminen onnistui' });
  } catch (error) {
    clearAuthCookies(res);
    res.json({ success: true, message: 'Uloskirjautunut' });
  }
};

// ---- TOKENIN PÄIVITYS ----
exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Kirjaudu sisään uudelleen' });
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Istunto vanhentunut' });
    }

    const user = await User.findById(decoded.id).select('+refreshTokens +isActive');

    if (!user || !user.isActive || !user.refreshTokens.includes(refreshToken)) {
      clearAuthCookies(res);
      return res.status(401).json({ success: false, message: 'Virheellinen istunto' });
    }

    const person = await Person.findOne({ userId: user._id });

    const newAccessToken = createAccessToken(user._id, user.role);
    const newRefreshToken = createRefreshToken(user._id);

    await User.findByIdAndUpdate(user._id, {
      refreshTokens: user.refreshTokens.filter(t => t !== refreshToken).concat(newRefreshToken),
    });

    setAccessTokenCookie(res, newAccessToken);
    setRefreshTokenCookie(res, newRefreshToken);

    res.json({
      success: true,
      user: buildUserResponse(user, person),
    });
  } catch (error) {
    clearAuthCookies(res);
    res.status(401).json({ success: false, message: 'Kirjaudu uudelleen' });
  }
};

// ---- SALASANAN PALAUTUSPYYNTÖ ----
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const safeMessage = 'Jos sähköpostiosoite on rekisteröity, lähetimme palautuslinkin.';

    if (!email) return res.json({ success: true, message: safeMessage });

    // Hae Person sähköpostilla → User sen kautta
    const person = await Person.findOne({ email: email.toLowerCase() });
    if (!person) return res.json({ success: true, message: safeMessage });

    const user = await User.findById(person.userId).select('+passwordResetToken +passwordResetExpires');
    if (!user || !user.isActive) return res.json({ success: true, message: safeMessage });

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    try {
      await sendPasswordResetEmail({
        email: person.email,
        resetToken,
        username: user.username,
      });
      await createLog({ userId: user._id, username: user.username, event: 'password_reset_request', req });
      res.json({ success: true, message: safeMessage });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      res.status(500).json({ success: false, message: 'Sähköpostin lähetys epäonnistui' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- SALASANAN VAIHTO TOKENILLA ----
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token ja salasana vaaditaan' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires +refreshTokens');

    if (!user) {
      return res.status(400).json({ success: false, message: 'Linkki on vanhentunut tai virheellinen' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Salasana min 8 merkkiä' });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    await createLog({ userId: user._id, username: user.username, event: 'password_reset_complete', req });

    clearAuthCookies(res);
    res.json({ success: true, message: 'Salasana vaihdettu. Kirjaudu sisään.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};

// ---- HAE KIRJAUTUNUT KÄYTTÄJÄ ----
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const person = await Person.findOne({ userId: req.user._id });

    res.json({
      success: true,
      user: buildUserResponse(user, person),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Palvelinvirhe' });
  }
};
