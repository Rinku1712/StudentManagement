const assert = require('node:assert/strict');
const test = require('node:test');
const { generateOtp, hashOtp, isOtpExpired, matchesOtp } = require('../services/otpService');

test('OTP generation returns six cryptographically generated decimal digits', () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    assert.match(generateOtp(), /^\d{6}$/);
  }
});

test('OTP is stored as a keyed hash and only matches the correct value', () => {
  const originalSecret = process.env.OTP_SECRET;
  process.env.OTP_SECRET = 't'.repeat(64);

  try {
    const otp = '004271';
    const hash = hashOtp(otp);
    assert.notEqual(hash, otp);
    assert.match(hash, /^[a-f\d]{64}$/);
    assert.equal(matchesOtp(otp, hash), true);
    assert.equal(matchesOtp('004272', hash), false);
    assert.equal(matchesOtp(otp, 'invalid'), false);
  } finally {
    if (originalSecret === undefined) delete process.env.OTP_SECRET;
    else process.env.OTP_SECRET = originalSecret;
  }
});

test('OTP expiry rejects missing, invalid, and elapsed expiry dates', () => {
  const now = Date.now();
  assert.equal(isOtpExpired(null, now), true);
  assert.equal(isOtpExpired('not-a-date', now), true);
  assert.equal(isOtpExpired(new Date(now), now), true);
  assert.equal(isOtpExpired(new Date(now + 1000), now), false);
});

test('OTP hashing fails closed when its server secret is missing', () => {
  const originalSecret = process.env.OTP_SECRET;
  delete process.env.OTP_SECRET;

  try {
    assert.throws(
      () => hashOtp('123456'),
      (error) => error.statusCode === 503 && /OTP_SECRET/.test(error.message),
    );
  } finally {
    if (originalSecret !== undefined) process.env.OTP_SECRET = originalSecret;
  }
});
