// utils/tokenUtils.js
// JWT tokenien luonti ja hallinta

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ---- Luo lyhytikäinen Access Token (15 min) ----
const createAccessToken = (userId, role) => {
  return jwt.sign(
    {
      id: userId,
      role,
      // Lisätään tyyppi - helpottaa debuggausta
      type: 'access',
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES,
      issuer: 'judovisa-api',
      audience: 'judovisa-frontend',
    }
  );
};

// ---- Luo pitkäikäinen Refresh Token (7 päivää) ----
const createRefreshToken = (userId) => {
  return jwt.sign(
    {
      id: userId,
      type: 'refresh',
      // Satunnainen jti estää vanhojen tokenien uudelleenkäytön
      jti: crypto.randomBytes(16).toString('hex'),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES,
      issuer: 'judovisa-api',
      audience: 'judovisa-frontend',
    }
  );
};

// ---- Aseta Access Token httpOnly cookieen ----
const setAccessTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSameSite = isProduction ? 'strict' : 'lax';

  try {
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: cookieSameSite,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
  } catch (err) {
    console.error('⚠️  Error setting accessToken cookie:', err && err.message ? err.message : err);
  }
};

// ---- Aseta Refresh Token httpOnly cookieen ----
const setRefreshTokenCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieSameSite2 = isProduction ? 'strict' : 'lax';
  const refreshPath = isProduction ? '/api/auth/refresh' : '/';

  try {
    res.cookie('refreshToken', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: cookieSameSite2,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: refreshPath,
    });
  } catch (err) {
    console.error('⚠️  Error setting refreshToken cookie:', err && err.message ? err.message : err);
  }
};

// ---- Tyhjennä cookiet uloskirjautuessa ----
const clearAuthCookies = (res) => {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/api/auth/refresh' });
};

// ---- Verifioi Access Token ----
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
    issuer: 'judovisa-api',
    audience: 'judovisa-frontend',
  });
};

// ---- Verifioi Refresh Token ----
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
    issuer: 'judovisa-api',
    audience: 'judovisa-frontend',
  });
};

module.exports = {
  createAccessToken,
  createRefreshToken,
  setAccessTokenCookie,
  setRefreshTokenCookie,
  clearAuthCookies,
  verifyAccessToken,
  verifyRefreshToken,
};
