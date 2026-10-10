const assert = require('node:assert/strict');
const test = require('node:test');

const { dataStore } = require('../dataStore');
const userModulePath = require.resolve('../models/User');
const databaseModulePath = require.resolve('../config/db');
const emailModulePath = require.resolve('../services/emailService');
const controllerModulePath = require.resolve('../controllers/authController');
const savedModules = new Map(
  [userModulePath, databaseModulePath, emailModulePath, controllerModulePath].map((path) => [
    path,
    require.cache[path],
  ]),
);

class TestEmailDeliveryError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 503;
  }
}

let emailBehavior;
let deliveredEmails;
let authController;
let dbConnected = false;
const userModel = {};

require.cache[userModulePath] = {
  id: userModulePath,
  filename: userModulePath,
  loaded: true,
  exports: userModel,
};
require.cache[databaseModulePath] = {
  id: databaseModulePath,
  filename: databaseModulePath,
  loaded: true,
  exports: { isDatabaseConnected: () => dbConnected },
};
require.cache[emailModulePath] = {
  id: emailModulePath,
  filename: emailModulePath,
  loaded: true,
  exports: {
    EmailDeliveryError: TestEmailDeliveryError,
    sendOtpEmail: (emailOptions) => emailBehavior(emailOptions),
  },
};
authController = require('../controllers/authController');

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const signup = async (email = 'student@example.com') => {
  const res = response();
  await authController.register(
    { body: { name: 'Student Example', email, password: 'password123', role: 'student' } },
    res,
  );
  return res;
};

const verify = async (email, otp) => {
  const res = response();
  await authController.verifyOtp({ body: { email, otp } }, res);
  return res;
};

const originalOtpSecret = process.env.OTP_SECRET;
const originalNodeEnv = process.env.NODE_ENV;

test.beforeEach(() => {
  process.env.OTP_SECRET = 't'.repeat(64);
  dbConnected = false;
  for (const key of Object.keys(userModel)) delete userModel[key];
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  dataStore.users.length = 0;
  deliveredEmails = [];
  emailBehavior = async (emailOptions) => {
    deliveredEmails.push(emailOptions);
    return { accepted: true };
  };
});

test.after(() => {
  if (originalOtpSecret === undefined) delete process.env.OTP_SECRET;
  else process.env.OTP_SECRET = originalOtpSecret;
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnv;
  for (const [path, cachedModule] of savedModules) {
    if (cachedModule) require.cache[path] = cachedModule;
    else delete require.cache[path];
  }
});

test('signup creates an account only after email acceptance and stores no plaintext OTP', async () => {
  const res = await signup();
  assert.equal(res.statusCode, 201);
  assert.match(res.body.message, /accepted/);
  assert.equal(dataStore.users.length, 1);
  assert.equal(Object.hasOwn(dataStore.users[0], 'otp'), false);
  assert.notEqual(dataStore.users[0].otpHash, deliveredEmails[0].otp);
  assert.equal(dataStore.users[0].otpPurpose, 'verification');
  assert.ok(dataStore.users[0].otpExpires > new Date());
});

test('email provider failure returns an error and creates no pending account', async () => {
  emailBehavior = async () => {
    throw new TestEmailDeliveryError('The email provider could not accept the message.');
  };

  const res = await signup();
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /provider/);
  assert.equal(dataStore.users.length, 0);
});

test('production signup fails closed when persistent auth storage is unavailable', async () => {
  process.env.NODE_ENV = 'production';
  const res = await signup();
  assert.equal(res.statusCode, 503);
  assert.equal(dataStore.users.length, 0);
  assert.equal(deliveredEmails.length, 0);
});

test('MongoDB operation failures become safe 503 responses, not misleading 500s', async () => {
  dbConnected = true;
  process.env.NODE_ENV = 'production';
  userModel.findOne = async () => {
    const error = new Error('connection details must not reach the client');
    error.name = 'MongoServerSelectionError';
    error.code = 'ENETUNREACH';
    throw error;
  };

  const res = await signup();
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.message, 'Database temporarily unavailable. Please retry shortly.');
  assert.doesNotMatch(res.body.message, /connection details|ENETUNREACH/);
  assert.equal(deliveredEmails.length, 0);
});

test('MongoDB account-creation failures do not send an OTP email', async () => {
  dbConnected = true;
  process.env.NODE_ENV = 'production';
  userModel.findOne = async () => null;
  userModel.create = async () => {
    const error = new Error('database operation detail must remain server-side');
    error.name = 'MongoNetworkError';
    error.code = 'ECONNRESET';
    throw error;
  };

  const res = await signup();
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.message, 'Database temporarily unavailable. Please retry shortly.');
  assert.equal(deliveredEmails.length, 0);
});

test('duplicate registrations distinguish pending and verified accounts without sending more email', async () => {
  await signup();
  const pendingDuplicate = await signup();
  assert.equal(pendingDuplicate.statusCode, 409);
  assert.equal(pendingDuplicate.body.code, 'ACCOUNT_UNVERIFIED');
  assert.equal(deliveredEmails.length, 1);

  dataStore.users[0].isVerified = true;
  const verifiedDuplicate = await signup();
  assert.equal(verifiedDuplicate.statusCode, 409);
  assert.equal(verifiedDuplicate.body.code, 'ACCOUNT_EXISTS');
  assert.equal(deliveredEmails.length, 1);
});

test('verification is email-bound, consumes the code once, and rejects expired codes', async () => {
  await signup();
  const code = deliveredEmails[0].otp;

  assert.equal((await verify('other@example.com', code)).statusCode, 404);
  assert.equal((await verify('student@example.com', code)).statusCode, 200);
  assert.equal((await verify('student@example.com', code)).statusCode, 409);
  assert.equal(dataStore.users[0].otpHash, null);

  await signup('expired@example.com');
  const expiredUser = dataStore.users.find((user) => user.email === 'expired@example.com');
  expiredUser.otpExpires = new Date(Date.now() - 1);
  const expiredCode = deliveredEmails.at(-1).otp;
  assert.equal((await verify('expired@example.com', expiredCode)).statusCode, 400);
  assert.equal(expiredUser.otpHash, null);
});

test('verification locks and consumes a code after five incorrect attempts', async () => {
  await signup();
  const wrongCode = deliveredEmails[0].otp === '999999' ? '000000' : '999999';

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    assert.equal((await verify('student@example.com', wrongCode)).statusCode, 400);
  }
  assert.equal((await verify('student@example.com', wrongCode)).statusCode, 429);
  assert.equal(dataStore.users[0].otpHash, null);
  assert.equal((await verify('student@example.com', wrongCode)).statusCode, 400);
});

test('resend respects cooldown and restores the previous code when email delivery fails', async () => {
  await signup();
  const user = dataStore.users[0];
  const originalCode = deliveredEmails[0].otp;
  const tooSoon = response();
  await authController.resendOtp({ body: { email: user.email } }, tooSoon);
  assert.equal(tooSoon.statusCode, 429);
  assert.equal(deliveredEmails.length, 1);

  user.otpLastSentAt = new Date(Date.now() - 31_000);
  emailBehavior = async () => {
    throw new TestEmailDeliveryError('The email provider could not accept the message.');
  };
  const failedResend = response();
  await authController.resendOtp({ body: { email: user.email } }, failedResend);
  assert.equal(failedResend.statusCode, 503);
  assert.equal(user.otpResendCount, 1);
  assert.equal((await verify(user.email, originalCode)).statusCode, 200);
});

test('resend is limited to five requests per hour', async () => {
  await signup();
  const user = dataStore.users[0];

  for (let attempt = 0; attempt < 5; attempt += 1) {
    user.otpLastSentAt = new Date(Date.now() - 31_000);
    const res = response();
    await authController.resendOtp({ body: { email: user.email } }, res);
    assert.equal(res.statusCode, 200);
  }

  user.otpLastSentAt = new Date(Date.now() - 31_000);
  const rateLimited = response();
  await authController.resendOtp({ body: { email: user.email } }, rateLimited);
  assert.equal(rateLimited.statusCode, 429);
  assert.equal(deliveredEmails.length, 6);
});

test('password-reset codes have a separate purpose and are consumed after reset', async () => {
  await signup();
  const user = dataStore.users[0];
  user.isVerified = true;
  user.otpLastSentAt = new Date(Date.now() - 31_000);

  const requested = response();
  await authController.forgotPassword({ body: { email: user.email } }, requested);
  assert.equal(requested.statusCode, 200);
  const resetCode = deliveredEmails.at(-1).otp;
  assert.equal(user.otpPurpose, 'reset');
  user.isVerified = false;
  assert.equal((await verify(user.email, resetCode)).statusCode, 400);
  user.isVerified = true;

  const reset = response();
  await authController.resetPassword(
    { body: { email: user.email, otp: resetCode, password: 'newpassword123' } },
    reset,
  );
  assert.equal(reset.statusCode, 200);
  assert.equal(await require('bcryptjs').compare('newpassword123', user.password), true);
  assert.equal(user.otpHash, null);
});
