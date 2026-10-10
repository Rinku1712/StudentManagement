const { createHmac, randomInt, timingSafeEqual } = require('crypto');

const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const hashOtp = (otp) => {
  const secret = process.env.OTP_SECRET;
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    const error = new Error('OTP_SECRET must be configured with at least 32 bytes of random data.');
    error.statusCode = 503;
    throw error;
  }

  return createHmac('sha256', secret).update(otp).digest('hex');
};

const matchesOtp = (otp, storedHash) => {
  if (typeof otp !== 'string' || typeof storedHash !== 'string' || !/^[a-f\d]{64}$/i.test(storedHash)) {
    return false;
  }

  const expectedHash = Buffer.from(hashOtp(otp), 'hex');
  const actualHash = Buffer.from(storedHash, 'hex');
  return timingSafeEqual(expectedHash, actualHash);
};

const isOtpExpired = (expiresAt, now = Date.now()) => {
  const expiry = new Date(expiresAt).getTime();
  return !Number.isFinite(expiry) || expiry <= now;
};

module.exports = { generateOtp, hashOtp, isOtpExpired, matchesOtp };
