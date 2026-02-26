// config/db.js
// MongoDB Atlas yhteys - turvallinen konfiguraatio

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Mongoose 8+ ei enää tarvitse useNewUrlParser / useUnifiedTopology
      // Nämä asetukset parantavat tietoturvaa ja suorituskykyä:
      serverSelectionTimeoutMS: 5000,  // Timeout jos Atlas ei vastaa
      socketTimeoutMS: 45000,          // Yhteyden timeout
      maxPoolSize: 10,                 // Max samanaikaiset yhteydet
    });

    console.log(`✅ MongoDB Atlas yhdistetty: ${conn.connection.host}`);

    // Kuuntele yhteysvirheitä käynnistyksen jälkeen
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB yhteys katkesi:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️  MongoDB yhteys katkesi, yritetään uudelleen...');
    });

  } catch (error) {
    console.error('❌ MongoDB Atlas yhdistäminen epäonnistui:', error.message);
    process.exit(1); // Lopeta prosessi jos tietokantaan ei saada yhteyttä
  }
};

module.exports = connectDB;
