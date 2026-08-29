const nodemailer = require("nodemailer");
const crypto = require("crypto");

function createOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}

function hashOTP(otp) {
    return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function getTransporter() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!user || !pass) return null;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: { user, pass }
    });
}

async function sendOTP(email, otp) {
    const transporter = getTransporter();

    // Development fallback: if SMTP is not configured, show OTP in terminal.
    if (!transporter) {
        console.log(`OTP for ${email}: ${otp}`);
        return { sentByEmail: false };
    }

    await transporter.sendMail({
        from: process.env.OTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: "Your E-Commerce Verification OTP",
        text: `Your OTP is ${otp}. It expires in 5 minutes. If you did not request this, ignore this email.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:24px;border:1px solid #ddd;border-radius:12px"><h2>E-Commerce Email Verification</h2><p>Your verification OTP is:</p><div style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:20px 0">${otp}</div><p>This OTP expires in <b>5 minutes</b>.</p><p>If you did not request this code, you can safely ignore this email.</p></div>`
    });

    return { sentByEmail: true };
}

module.exports = { createOTP, hashOTP, sendOTP };
