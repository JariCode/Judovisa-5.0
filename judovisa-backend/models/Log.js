// models/Log.js
// Lokitapahtuma-malli - kirjaa kaikki tilitoiminnot

const mongoose = require('mongoose');

// Sallitut tapahtumatyypit (vastaa MongoDB-kaaviotasi)
const EVENTS = [
  'register',
  'login',
  'login_failed',
  'logout',
  'password_reset_request',
  'password_reset_complete',
  'quiz_started',
  'quiz_finished',
  'score_saved',
  'account_deleted',
  'account_updated',
  'role_changed',
  'admin_viewed_logs',
  'admin_viewed_users',
  'admin_updated_user',
  'admin_deleted_user',
];

const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    // Admin-toiminnoissa: kohteena oleva käyttäjä
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    targetUsername: {
      type: String,
    },
    event: {
      type: String,
      enum: EVENTS,
      required: true,
    },
    // Lisätietoja tapahtumasta (esim. IP-osoite, selain)
    metadata: {
      ipAddress: String,
      userAgent: String,
      details: String,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    // Ei timestamps tähän - käytetään omaa timestamp-kenttää
    versionKey: false,
  }
);

// TTL-indeksi: Loki poistetaan automaattisesti 1 vuoden jälkeen
// Poista tämä jos haluat pitää lokit ikuisesti
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

module.exports = mongoose.model('Log', logSchema);

// Exportataan myös sallitut tapahtumat
module.exports.EVENTS = EVENTS;
