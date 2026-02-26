// models/User.js
// Vain tunnistautumistiedot - henkilötiedot Person-kokoelmassa

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Käyttäjätunnus vaaditaan'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Käyttäjätunnus min 3 merkkiä'],
      maxlength: [30, 'Käyttäjätunnus max 30 merkkiä'],
      match: [/^[a-zA-Z0-9_-]+$/, 'Käyttäjätunnus voi sisältää vain kirjaimia, numeroita, _ ja -'],
    },
    password: {
      type: String,
      required: [true, 'Salasana vaaditaan'],
      minlength: [8, 'Salasana min 8 merkkiä'],
      select: false,
    },
    role: {
      type: String,
      enum: ['player', 'admin'],
      default: 'player',
    },
    // Salasanan palautus
    passwordResetToken: {
      type: String,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      select: false,
    },
    // Refresh tokenit (tukee useita laitteita)
    refreshTokens: {
      type: [String],
      select: false,
      default: [],
    },
    // Kirjautumisyritysten rajoitus
    loginAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    lockUntil: {
      type: Date,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ---- Hashataan salasana ennen tallennusta ----
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ---- Tarkista salasana ----
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// ---- Onko tili lukittu? ----
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// ---- Kasvata kirjautumisyrityksiä ----
userSchema.methods.incrementLoginAttempts = async function () {
  const MAX_ATTEMPTS = 5;
  const LOCK_TIME = 15 * 60 * 1000;

  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS) {
    updates.$set = { lockUntil: Date.now() + LOCK_TIME };
  }
  return this.updateOne(updates);
};

// ---- Luo salasanan palautustoken ----
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.passwordResetExpires = Date.now() + process.env.PASSWORD_RESET_EXPIRES;
  return resetToken;
};

// Poistetaan arkaluontoiset kentät JSON-vastauksista
userSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.refreshTokens;
    delete ret.loginAttempts;
    delete ret.lockUntil;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
