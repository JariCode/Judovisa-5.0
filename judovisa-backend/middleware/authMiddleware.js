// middleware/authMiddleware.js
// Reittien suojaus - JWT-tokenin tarkistus

const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');

// ---- Suojaa reitti: vaatii kirjautumisen ----
const protect = async (req, res, next) => {
  try {
    let token;

    // 1. Hae token cookiesta (ensisijainen - turvallisempi kuin header)
    if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }
    // 2. Vaihtoehto: Authorization header (API-clienteille)
    else if (
      req.headers.authorization?.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Kirjaudu sisään päästäksesi tähän sisältöön',
      });
    }

    // Verifioi token
    const decoded = verifyAccessToken(token);

    // Tarkista että käyttäjä on edelleen olemassa
    const currentUser = await User.findById(decoded.id).select('+isActive');

    if (!currentUser || !currentUser.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Tämä käyttäjätili ei ole enää voimassa',
      });
    }

    // Lisää käyttäjä requestiin - käytettävissä kaikissa seuraavissa middlewareissa
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Virheellinen token - kirjaudu uudelleen',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Istunto on vanhentunut - kirjaudu uudelleen',
        code: 'TOKEN_EXPIRED', // Frontend voi tunnistaa ja yrittää refresh
      });
    }
    next(error);
  }
};

// ---- Vaadi tietty rooli ----
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Sinulla ei ole oikeutta tähän toimintoon',
      });
    }
    next();
  };
};

// Valmiit oikotiet
const adminOnly = requireRole('admin');
const playerOrAdmin = requireRole('player', 'admin');

module.exports = { protect, requireRole, adminOnly, playerOrAdmin };
