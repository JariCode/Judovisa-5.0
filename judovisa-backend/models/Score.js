// models/Score.js
// Pisteet-malli - tallentaa visa-tuloshistorian

const mongoose = require('mongoose');

const scoreSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Nopea haku käyttäjän pisteisiin
    },
    username: {
      type: String,
      required: true,
    },
    correct: {
      type: Number,
      required: true,
      min: 0,
    },
    wrong: {
      type: Number,
      required: true,
      min: 0,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    quizDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Laske prosentti automaattisesti ennen tallennusta
scoreSchema.pre('save', function (next) {
  if (this.totalQuestions > 0) {
    this.percentage = Math.round((this.correct / this.totalQuestions) * 100);
  }
  next();
});

module.exports = mongoose.model('Score', scoreSchema);
