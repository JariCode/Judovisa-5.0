// server.js
// Judovisa Backend - pääohjelma
// Turvallisuus ensin: Helmet, CORS, rate limiting, sanitointi

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// ---- Yhdistä tietokantaan ----
connectDB();

const app = express();

// ============================================================
// TIETOTURVA MIDDLEWARE (ennen reittejä)
// ============================================================

// 1. Helmet - asettaa tietoturva-headerit automaattisesti
//    (XSS, clickjacking, MIME sniffing, jne.)
app.use(helmet());

// 2. CORS - salli vain frontendisi osoite
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true, // Salli cookies (tarvitaan httpOnly cookieille)
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// 3. Yleiset rate limit - kaikille API-kutsuille
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200, // Max 200 pyyntöä per IP per 15 min
  message: {
    success: false,
    message: 'Liikaa pyyntöjä - yritä hetken kuluttua',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

// 4. Body parser - rajoita koko (estää large payload attacks)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 5. Cookie parser
app.use(cookieParser());

// 6. MongoDB Sanitisointi - estää NoSQL injektiot
//    Poistaa $ ja . merkit käyttäjän syötteistä
app.use(mongoSanitize());

// 7. Trust proxy (tarvitaan jos Nginx/Cloudflare edessä)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ============================================================
// REITIT
// ============================================================

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/quiz', require('./routes/quizRoutes'));

// Terveystarkistus
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Judovisa API toimii',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 404 - reittiä ei löydy
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Reittiä ${req.originalUrl} ei löydy`,
  });
});

// ============================================================
// GLOBAALI VIRHEENKÄSITTELY
// ============================================================
app.use((err, req, res, next) => {
  console.error('🔴 Palvelinvirhe:', err);

  // Mongoose CastError (virheellinen ID)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Virheellinen ID-muoto',
    });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} on jo käytössä`,
    });
  }

  // Oletusvirhe
  res.status(err.statusCode || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Palvelinvirhe'
      : err.message,
  });
});

// ============================================================
// KÄYNNISTYS
// ============================================================
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`
🥋 ===================================
   Judovisa Backend käynnissä!
   Portti: ${PORT}
   Ympäristö: ${process.env.NODE_ENV}
   Aika: ${new Date().toLocaleString('fi-FI')}
===================================
  `);
});

// Käsittele prosessin sammutus siististi
process.on('unhandledRejection', (err) => {
  console.error('❌ Käsittelemätön promise-virhe:', err.message);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  console.log('SIGTERM vastaanotettu - suljetaan palvelin...');
  server.close(() => process.exit(0));
});
