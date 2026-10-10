# Server

The server is an Express API for the student-teacher dashboard. It handles authentication, OTP email verification, role-based access, onboarding profiles, dashboard data, discussions, and AI chat.

## Setup

Install dependencies from the repository root:

```bash
npm install
```

The backend uses Mongoose 9 and the built-in Node.js Fetch API; run it with Node.js `20.19.0` or newer.

Create `server/.env` from `.env.example`. Keep this file out of Git:

```env
PORT=5000
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=replace-with-a-long-random-secret
OTP_SECRET=replace-with-a-random-64-character-hex-secret
RESEND_API_KEY=re_your_resend_api_key
EMAIL_FROM=AcademiaOS <no-reply@your-verified-domain.com>
CLIENT_ORIGIN=http://localhost:5173
```

OTP delivery uses Resend's HTTPS API; it does not use SMTP. In Resend, create an API key and verify the sending domain used in `EMAIL_FROM`. The sender must use an address on that verified domain. Generate independent, high-entropy values for `JWT_SECRET` and `OTP_SECRET`; do not reuse credentials or commit them.

On Render, add `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `OTP_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and `CLIENT_ORIGIN` under the web service's **Environment** settings. Set `CLIENT_ORIGIN` to the exact deployed Vercel origin, including `https://` and without a path. Comma-separate origins only if multiple trusted sites need access. Render supplies `PORT`.

For local development, use the local values in `server/.env`; keep the production secrets in Render only. The example file contains placeholders, not working credentials. Signup requires a working MongoDB connection for persistent accounts in production.

## Commands

Run the server with automatic restart during development:

```bash
npm run dev
```

Run the server normally:

```bash
npm start
```

The API listens on `http://localhost:5000` by default. Its health check is `GET /api/health`.

## Storage

`server/config/db.js` attempts to connect to MongoDB using `MONGO_URI`. When the connection is unavailable, the server continues with the temporary store in `server/dataStore.js`. The fallback is useful for local UI work, but its data is cleared whenever the process restarts; signup fails closed in production when persistent MongoDB storage is unavailable. `GET /api/health` returns 503 in production until MongoDB and the required authentication/email configuration are ready.

Signup verification codes are generated with a cryptographically secure random source and stored as keyed hashes using `OTP_SECRET`. Codes expire after 10 minutes, allow at most five verification attempts, and have a 30-second resend cooldown with a five-resends-per-hour limit. Legacy plaintext OTP fields are removed from MongoDB at startup. The API confirms signup only after Resend accepts the email request.

## API Sections

### Authentication: `/api/auth`

Signup, login, OTP verification, verification-code resend, forgot-password, and password-reset endpoints are defined in `routes/authRoutes.js` and implemented by `controllers/authController.js`. Email delivery is handled by `services/emailService.js`; OTP generation, hashing, and expiry checks are in `services/otpService.js`.

### Profiles: `/api/profile`

Student academic profiles and teacher profiles are validated and saved through `routes/profileRoutes.js`. These endpoints require a valid JWT and the appropriate role.

### Dashboard: `/api/dashboard`

Protected dashboard endpoints expose student profiles, assignments, tests, discussions, and teacher management actions. Role checks are applied with `middleware/authMiddleware.js`.

### AI: `/api/ai`

`POST /api/ai/chat` is protected and delegates to `controllers/aiController.js`. Configure the AI provider credentials required by that controller before using it.

## Source Sections

- `index.js`: environment loading, middleware, route registration, and server startup.
- `routes/`: Express route definitions and endpoint-level role wiring.
- `controllers/`: complex request and response logic.
- `models/`: Mongoose schemas for persisted entities.
- `middleware/`: JWT authentication and role authorization.
- `services/`: integrations such as Resend email delivery and OTP utilities.
- `config/`: infrastructure configuration, including MongoDB.
- `dataStore.js`: temporary in-memory fallback data.

## Client Integration

In development, the Vite client defaults to this API at `http://localhost:5000`. CORS allows `http://localhost:5173` and `http://127.0.0.1:5173` by default and also allows origins listed in `CLIENT_ORIGIN`. Set `CLIENT_ORIGIN` to the deployed frontend origin in production.
