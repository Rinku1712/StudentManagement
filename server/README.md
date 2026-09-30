# Server

The server is an Express API for the student-teacher dashboard. It handles authentication, OTP email verification, role-based access, onboarding profiles, dashboard data, discussions, and AI chat.

## Setup

Install dependencies from the repository root:

```bash
npm install
```

Create `server/.env` from `.env.example`:

```env
PORT=5000
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=replace-with-a-long-random-secret
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-gmail-address@gmail.com
EMAIL_PASS=your-16-character-google-app-password
EMAIL_FROM=your-gmail-address@gmail.com
```

For Gmail, enable two-step verification and use an app password. Keep `.env` private.

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

`server/config/db.js` attempts to connect to MongoDB using `MONGO_URI`. When the connection is unavailable, the server continues with the temporary store in `server/dataStore.js`. The fallback is useful for local UI work, but its data is cleared whenever the process restarts.

## API Sections

### Authentication: `/api/auth`

Signup, login, OTP verification, forgot-password, and password-reset endpoints are defined in `routes/authRoutes.js` and implemented by `controllers/authController.js`.

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
- `services/`: integrations such as OTP email delivery.
- `config/`: infrastructure configuration, including MongoDB.
- `dataStore.js`: temporary in-memory fallback data.

## Client Integration

The Vite client defaults to this API at `http://localhost:5000`. CORS allows `http://localhost:5173` and `http://127.0.0.1:5173` by default. Set `CLIENT_ORIGIN` in the server environment when the frontend runs elsewhere.
