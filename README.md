# Student-Teacher Dashboard

A full-stack dashboard for students and teachers. The project includes a React/Vite client and an Express API with role-based authentication, OTP verification, onboarding profiles, assignments, tests, discussions, and an authenticated AI chat endpoint.

## Project Structure

```text
.
├── client/                 React + Vite frontend
│   └── src/
│       ├── components/     Shared UI components
│       ├── pages/          Login, signup, onboarding, and dashboard screens
│       └── services/       HTTP client helpers
├── server/                 Express backend
│   ├── controllers/        Request handlers
│   ├── models/             Mongoose models
│   ├── routes/             API route definitions
│   ├── middleware/         Authentication and authorization middleware
│   └── services/           Integrations such as email delivery
└── package.json            Backend scripts and dependencies
```

## Requirements

- Node.js 18 or newer
- npm
- MongoDB (recommended for persistent data)
- SMTP credentials for email OTP delivery

The server can start without MongoDB and will use temporary in-memory authentication storage. Data in that fallback is lost when the server restarts.

## Setup

Install backend dependencies from the repository root:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
```

Create `server/.env` from `server/.env.example` and set the MongoDB, JWT, and SMTP values. The frontend uses `http://localhost:5000` by default. To use another API URL, create `client/.env` with:

```env
VITE_API_URL=http://localhost:5000
```

## Run Locally

Start the API from the repository root:

```bash
npm run dev
```

Start the frontend in a second terminal:

```bash
cd client
npm run dev
```

Open `http://localhost:5173`. The API health check is available at `http://localhost:5000/api/health`.

For a production client build:

```bash
cd client
npm run build
npm run preview
```

## Application Flow

1. Create a student or instructor account at `/signup`.
2. Verify the email OTP at `/verify-otp`.
3. Sign in at `/`.
4. Complete the role-specific academic or teacher profile.
5. Use the protected dashboard for assignments, tests, discussions, and profile data.

The client stores the JWT and user summary in `localStorage`. API requests include the token as a Bearer token when one is available.

## API Sections

- `/api/auth`: signup, login, OTP verification, forgot password, and password reset.
- `/api/profile`: student and teacher onboarding profiles.
- `/api/dashboard`: protected dashboards, assignments, tests, and discussions.
- `/api/ai`: authenticated AI chat at `POST /api/ai/chat`.
- `/api/health`: server health check.

See [server/README.md](server/README.md) for backend details and [client/README.md](client/README.md) for frontend routes and scripts.

## Development Checks

```bash
cd client
npm run lint
npm run build
```
