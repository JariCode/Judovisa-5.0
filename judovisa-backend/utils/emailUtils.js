// utils/emailUtils.js
// Sähköpostien lähetys - salasanan palautus

const nodemailer = require('nodemailer');

// ---- Luo transporter (kehitys tai tuotanto) ----
const createTransporter = async () => {
  // Kehityksessä: käytä Ethereal-testipalvelua
  if (process.env.NODE_ENV === 'development' && (!process.env.EMAIL_HOST || !process.env.EMAIL_HOST.includes('smtp'))) {
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    return { transporter, testAccount };
  }

  // Tuotanto / konfiguroitu SMTP
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_PORT === '465', // SSL port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // TLS asetukset tuotantoon
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return { transporter, testAccount: null };
};

// ---- Lähetä salasanan palautussähköposti ----
const sendPasswordResetEmail = async ({ email, resetToken, username }) => {
  const { transporter, testAccount } = await createTransporter();

  const resetURL = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM || 'Judovisa <noreply@judovisa.fi>',
    to: email,
    subject: 'Judovisa - Salasanan palautus',
    text: `
Hei ${username},

Pyysit salasanan palautusta Judovisa-tilillesi.

Klikkaa alla olevaa linkkiä vaihtaaksesi salasanasi:
${resetURL}

Linkki on voimassa 1 tunnin.

Jos et pyytänyt salasanan palautusta, voit jättää tämän viestin huomiotta.
Tilisi pysyy turvassa.

Terveisin,
Judovisa-tiimi
    `.trim(),
    html: `
<!DOCTYPE html>
<html lang="fi">
<head><meta charset="UTF-8"></head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
  <div style="background: #1a1a2e; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
    <h1 style="color: #e94560; margin: 0;">🥋 Judovisa</h1>
  </div>
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #ddd;">
    <h2>Hei ${username},</h2>
    <p>Pyysit salasanan palautusta Judovisa-tilillesi.</p>
    <p>Klikkaa alla olevaa nappia vaihtaaksesi salasanasi:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetURL}" 
         style="background: #e94560; color: white; padding: 14px 28px; 
                text-decoration: none; border-radius: 6px; font-size: 16px; 
                font-weight: bold; display: inline-block;">
        Vaihda salasana
      </a>
    </div>
    <p style="color: #666; font-size: 14px;">
      ⏰ Linkki on voimassa <strong>1 tunnin</strong>.
    </p>
    <p style="color: #666; font-size: 14px;">
      Jos et pyytänyt salasanan palautusta, jätä tämä viesti huomiotta. 
      Tilisi pysyy turvassa.
    </p>
    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
    <p style="color: #999; font-size: 12px;">
      Jos nappi ei toimi, kopioi tämä linkki selaimeesi:<br>
      <a href="${resetURL}" style="color: #e94560; word-break: break-all;">${resetURL}</a>
    </p>
  </div>
</body>
</html>
    `.trim(),
  };

  const info = await transporter.sendMail(mailOptions);

  // Kehityksessä: tulosta preview URL konsoliin
  if (testAccount || process.env.NODE_ENV === 'development') {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log('📧 Sähköpostin esikatselu (Ethereal):', previewUrl);
    }
  }

  return info;
};

module.exports = { sendPasswordResetEmail };
