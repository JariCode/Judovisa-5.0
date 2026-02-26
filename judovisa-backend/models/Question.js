// models/Question.js
// Kysymysmalli - kategoriadokumentit joilla vastauslista ja yritysmäärä

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, 'Tyyppi vaaditaan'],
      unique: true,
      trim: true,
      lowercase: true,
      // Esim: osaekomi, shimewaza, kansetsuwaza...
    },
    category: {
      type: String,
      required: [true, 'Kategoria vaaditaan'],
      trim: true,
      // Esim: "Osaekomi-Waza"
    },
    jpName: {
      type: String,
      trim: true,
      // Esim: "抑込技"
    },
    questionText: {
      type: String,
      required: [true, 'Kysymysteksti vaaditaan'],
      trim: true,
      // Esim: "Kerro kuusi sidontaa."
    },
    answers: {
      type: [String],
      required: [true, 'Vastaukset vaaditaan'],
      validate: {
        validator: (arr) => arr.length >= 1,
        message: 'Vähintään yksi vastaus vaaditaan',
      },
    },
    attempts: {
      type: Number,
      required: [true, 'Yritysmäärä vaaditaan'],
      min: [1, 'Yritysmäärä min 1'],
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

module.exports = mongoose.model('Question', questionSchema);
