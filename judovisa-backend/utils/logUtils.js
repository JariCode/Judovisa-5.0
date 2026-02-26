// utils/logUtils.js
// Apufunktio lokitapahtumien tallentamiseen

const Log = require('../models/Log');

/**
 * Tallenna lokitapahtuma tietokantaan
 * @param {Object} params
 * @param {string} params.userId - Toiminnon suorittaja
 * @param {string} params.username - Käyttäjätunnus
 * @param {string} params.event - Tapahtumatyyppi (Log.EVENTS)
 * @param {Object} [params.req] - Express request (IP, user-agent)
 * @param {string} [params.targetUserId] - Admin-toiminnoissa kohdekäyttäjä
 * @param {string} [params.targetUsername] - Kohdekäyttäjän tunnus
 * @param {string} [params.details] - Lisätietoja
 */
const createLog = async ({
  userId,
  username,
  event,
  req = null,
  targetUserId = null,
  targetUsername = null,
  details = null,
}) => {
  try {
    const logData = {
      userId,
      username,
      event,
    };

    if (targetUserId) logData.targetUserId = targetUserId;
    if (targetUsername) logData.targetUsername = targetUsername;

    // Poimi IP ja user-agent requestista
    if (req) {
      logData.metadata = {
        // Tukee reverse proxyn kautta tulevaa oikeaa IP:tä
        ipAddress:
          req.headers['x-forwarded-for']?.split(',')[0].trim() ||
          req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        details,
      };
    } else if (details) {
      logData.metadata = { details };
    }

    await Log.create(logData);
  } catch (error) {
    // Loki ei saa kaataa sovellusta - vain varoitus
    console.error('⚠️  Lokitapahtuman tallennus epäonnistui:', error.message);
  }
};

module.exports = { createLog };
