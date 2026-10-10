const RESEND_API_URL = 'https://api.resend.com/emails';

class EmailDeliveryError extends Error {
  constructor(message, statusCode = 503) {
    super(message);
    this.name = 'EmailDeliveryError';
    this.statusCode = statusCode;
  }
}

const sendOtpEmail = async ({ email, otp, purpose = 'verification' }) => {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    throw new EmailDeliveryError('Email delivery is not configured on the server.');
  }

  const isPasswordReset = purpose === 'reset';
  const subject = isPasswordReset ? 'AcademiaOS Reset Code' : 'AcademiaOS Verification Code';
  const description = isPasswordReset ? 'password reset' : 'account verification';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
      <h2 style="margin: 0 0 12px; color: #0f172a;">AcademiaOS</h2>
      <p style="color: #334155; margin-bottom: 18px;">Your ${description} code is:</p>
      <div style="display: inline-block; padding: 14px 18px; background: #2563eb; color: white; border-radius: 10px; font-size: 28px; letter-spacing: 4px; font-weight: 700;">${otp}</div>
      <p style="margin-top: 18px; color: #475569;">This code expires in 10 minutes.</p>
    </div>
  `;

  let response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
        text: `Your ${description} code is ${otp}. It expires in 10 minutes.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    console.error('Resend request failed before receiving a provider response.', {
      name: error?.name,
      code: error?.cause?.code || error?.code,
    });
    throw new EmailDeliveryError('The email provider is temporarily unavailable.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok || typeof result?.id !== 'string' || !result.id) {
    console.error(`Resend rejected OTP email with HTTP ${response.status}.`);
    throw new EmailDeliveryError('The email provider could not accept the message.');
  }

  return { accepted: true };
};

module.exports = { EmailDeliveryError, sendOtpEmail };
