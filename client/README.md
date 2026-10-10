# Client

The client is a React 19 single-page application built with Vite. It provides the login, signup, OTP verification, role-specific onboarding, and student and teacher dashboard experiences.

## Setup

From this directory, install dependencies:

```bash
npm install
```

For local development, copy `.env.example` to `.env` in this directory:

```env
VITE_API_URL=http://localhost:5000
```

For a Vercel deployment, set `VITE_API_URL` in the Vercel project's **Environment Variables** to the HTTPS URL of the deployed Render API (for example, `https://your-api.onrender.com`). Vite embeds this value at build time, so redeploy after changing it. Production builds reject missing or localhost API URLs rather than silently calling a developer machine.

The backend must be running before authenticated features can load data. Configure its `CLIENT_ORIGIN` to the exact Vercel site origin; see [the server setup](../server/README.md).

## Commands

```bash
npm run dev       # Start the Vite development server
npm run lint      # Run ESLint
npm run build     # Create a production build
npm run preview   # Preview the production build
```

The development server normally runs at `http://localhost:5173`.

## Routes

- `/`: login
- `/signup`: create a student or instructor account
- `/verify-otp`: verify a signup or password-reset OTP
- `/forgot-password`: request a password reset OTP
- `/student/dashboard`: protected student dashboard
- `/teacher/dashboard`: protected teacher dashboard
- `/teacher/onboarding`: protected teacher profile onboarding

Users are redirected to role-specific onboarding until their profile is complete. Protected routes require the JWT and user data stored by the login flow in `localStorage`.

## Source Sections

- `src/pages/`: route-level screens for authentication, onboarding, and dashboards.
- `src/components/`: reusable layout and interface components.
- `src/services/api.js`: shared `fetch` wrapper. It applies the API base URL, JSON headers, credentials, and Bearer token, and converts failed responses into JavaScript errors.
- `src/assets/`: imported frontend assets.
- `public/`: static files served as-is by Vite.

## Backend Contract

The client communicates with the Express server under these API prefixes:

- `/api/auth`
- `/api/profile`
- `/api/dashboard`
- `/api/ai`

The server runs on port `5000` by default. See [../server/README.md](../server/README.md) for environment variables and backend startup instructions.
