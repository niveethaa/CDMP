const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendVerificationEmail(email, token) {
  const link = `http://localhost:5001/api/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"CDMP" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your CDMP account",
    html: `<p>Click the link below to verify your email:</p><a href="${link}">${link}</a>`,
  });
}

async function sendPasswordResetEmail(email, token) {
  const link = `http://localhost:8080/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"CDMP" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your CDMP password",
    html: `<p>Click the link below to reset your password:</p><a href="${link}">${link}</a><p>This link expires in 1 hour.</p>`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };