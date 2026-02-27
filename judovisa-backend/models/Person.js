// models/Person.js
// Henkilötiedot - erillään tunnistautumisesta (Users-kokoelmasta)

const mongoose = require('mongoose');
const validator = require('validator');

const personSchema = new mongoose.Schema(
  {
    // Viittaus Users-kokoelmaan
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    // Käyttäjänimen näyttömuoto — säilyttää alkuperäisen kirjoitusasun (esim. "Jarppa")
    // User.username on aina lowercase (haku/vertailu), displayName on näyttämistä varten
    displayName: {
      type: String,
      trim: true,
      maxlength: [30, 'Näyttönimi max 30 merkkiä'],
    },
    firstName: {
      type: String,
      required: [true, 'Etunimi vaaditaan'],
      trim: true,
      maxlength: [50, 'Etunimi max 50 merkkiä'],
    },
    lastName: {
      type: String,
      required: [true, 'Sukunimi vaaditaan'],
      trim: true,
      maxlength: [50, 'Sukunimi max 50 merkkiä'],
    },
    email: {
      type: String,
      required: [true, 'Sähköposti vaaditaan'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: [validator.isEmail, 'Virheellinen sähköpostiosoite'],
    },
  },
  {
    timestamps: true,
  }
);

personSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

module.exports = mongoose.model('Person', personSchema);
