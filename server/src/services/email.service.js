const nodemailer = require("nodemailer");

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log("Ethereal email account:", testAccount.user);
  return transporter;
}

async function sendVerificationEmail(email, token) {
  const transport = await getTransporter();
  const link = `http://localhost:5001/api/auth/verify-email?token=${token}`;
  const info = await transport.sendMail({
    from: '"CDMP" <noreply@cdmp.ca>',
    to: email,
    subject: "Verify your CDMP account",
    html: `<p>Click the link below to verify your email:</p><a href="${link}">${link}</a>`,
  });
  console.log("Verification email preview:", nodemailer.getTestMessageUrl(info));
  return nodemailer.getTestMessageUrl(info);
}

async function sendPasswordResetEmail(email, token) {
  const transport = await getTransporter();
  const link = `http://localhost:8080/reset-password?token=${token}`;
  const info = await transport.sendMail({
    from: '"CDMP" <noreply@cdmp.ca>',
    to: email,
    subject: "Reset your CDMP password",
    html: `<p>Click the link below to reset your password:</p><a href="${link}">${link}</a><p>This link expires in 1 hour.</p>`,
  });
  console.log("Password reset email preview:", nodemailer.getTestMessageUrl(info));
  return nodemailer.getTestMessageUrl(info);
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };