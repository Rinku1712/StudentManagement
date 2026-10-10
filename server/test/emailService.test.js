const assert = require('node:assert/strict');
const test = require('node:test');
const { EmailDeliveryError, sendOtpEmail } = require('../services/emailService');

const originalFetch = global.fetch;
const originalApiKey = process.env.RESEND_API_KEY;
const originalSender = process.env.EMAIL_FROM;

test.beforeEach(() => {
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'AcademiaOS <test@example.com>';
});

test.afterEach(() => {
  global.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalApiKey;
  if (originalSender === undefined) delete process.env.EMAIL_FROM;
  else process.env.EMAIL_FROM = originalSender;
});

test('Resend HTTPS API acceptance resolves without exposing its message id', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer re_test_key');
    const payload = JSON.parse(options.body);
    assert.deepEqual(payload.to, ['student@example.com']);
    assert.match(payload.text, /123456/);
    return { ok: true, status: 200, json: async () => ({ id: 'provider-message-id' }) };
  };

  assert.deepEqual(
    await sendOtpEmail({ email: 'student@example.com', otp: '123456' }),
    { accepted: true },
  );
});

test('provider rejection returns a safe failure and never treats it as accepted', async () => {
  global.fetch = async () => ({
    ok: false,
    status: 403,
    json: async () => ({ message: 'private provider response' }),
  });

  await assert.rejects(
    sendOtpEmail({ email: 'student@example.com', otp: '123456' }),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.statusCode, 503);
      assert.doesNotMatch(error.message, /private provider response|re_test_key/);
      return true;
    },
  );
});

test('provider network failures are surfaced as delivery errors', async () => {
  global.fetch = async () => {
    throw new Error('private network details');
  };

  await assert.rejects(
    sendOtpEmail({ email: 'student@example.com', otp: '123456' }),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.statusCode, 503);
      assert.doesNotMatch(error.message, /private network details/);
      return true;
    },
  );
});

test('missing provider credentials fail explicitly without a fallback delivery mode', async () => {
  delete process.env.RESEND_API_KEY;
  await assert.rejects(
    sendOtpEmail({ email: 'student@example.com', otp: '123456' }),
    (error) => {
      assert.ok(error instanceof EmailDeliveryError);
      assert.equal(error.statusCode, 503);
      assert.match(error.message, /not configured/);
      return true;
    },
  );
});
