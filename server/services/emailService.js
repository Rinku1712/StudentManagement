const nodemailer = require("nodemailer");

const buildTransporter = () => {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_SECURE,
  } = process.env;

  if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
    console.error("❌ Email configuration is missing.");
    console.error("EMAIL_HOST:", !!EMAIL_HOST);
    console.error("EMAIL_USER:", !!EMAIL_USER);
    console.error("EMAIL_PASS:", !!EMAIL_PASS);
    return null;
  }

  const transporter = nodemailer.createTransport({
    host: EMAIL_HOST,
    port: Number(EMAIL_PORT || 587),
    secure: EMAIL_SECURE === "true",
    auth: {
      user: EMAIL_USER.trim(),
      pass: EMAIL_PASS.replace(/\s+/g, ""),
    },
  });

  return transporter;
};

// Test Gmail SMTP connection
const testEmailConnection = async () => {
  const transporter = buildTransporter();

  if (!transporter) {
    console.error("❌ SMTP transporter could not be created.");
    return false;
  }

  try {
    await transporter.verify();

    console.log("✅ Gmail SMTP connection successful!");
    console.log("📧 Email:", process.env.EMAIL_USER);

    return true;
  } catch (error) {
    console.error("❌ Gmail SMTP connection failed!");
    console.error("Error:", error.message);

    return false;
  }
};

const sendOtpEmail = async ({
  email,
  otp,
  purpose = "verification",
}) => {
  const transporter = buildTransporter();

  if (!transporter) {
    console.error("❌ Email transporter is not configured.");
    return {
      sent: false,
      fallback: true,
    };
  }

  const subject =
    purpose === "reset"
      ? "AcademiaOS Reset Code"
      : "AcademiaOS Verification Code";

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: email,
      subject,

      html: `
        <div style="
          font-family: Arial, sans-serif;
          max-width: 520px;
          margin: 0 auto;
          padding: 24px;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          background: #f8fafc;
        ">
          <h2 style="margin: 0 0 12px; color: #0f172a;">
            AcademiaOS
          </h2>

          <p style="color: #334155; margin-bottom: 18px;">
            Your ${
              purpose === "reset"
                ? "password reset"
                : "account verification"
            } code is:
          </p>

          <div style="
            display: inline-block;
            padding: 14px 18px;
            background: #2563eb;
            color: white;
            border-radius: 10px;
            font-size: 28px;
            letter-spacing: 4px;
            font-weight: 700;
          ">
            ${otp}
          </div>

          <p style="margin-top: 18px; color: #475569;">
            This code expires in 10 minutes.
          </p>
        </div>
      `,
    });

    console.log("✅ OTP email sent successfully!");
    console.log("📧 To:", email);
    console.log("📨 Message ID:", info.messageId);

    return {
      sent: true,
      fallback: false,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("❌ OTP email failed!");
    console.error("Error:", error.message);

    throw error;
  }
};

module.exports = {
  sendOtpEmail,
  testEmailConnection,
};