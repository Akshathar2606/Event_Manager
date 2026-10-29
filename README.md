# EventFlow - Multi-Role Event Management Platform

EventFlow is a professional, full-stack Event Management Platform built for educational institutions, corporate settings, and multi-venue organizations. It streamlines the end-to-end event lifecycle across four distinct user roles:

1. **Administrator**: Manages shared college/campus venues, reviews venue booking requests, and supervises system resources.
2. **Event Organizer**: Creates events, checks venue availability, books venues and catering, organizes schedules, and tracks attendees.
3. **Catering Vendor**: Manages food menu packages, sets pricing and availability, and accepts or rejects event catering requests.
4. **Participant**: Discovers published events, views schedules/catering menus, and registers with real-time seat tracking.

---

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS, React Router, Lucide Icons, Axios
- **Backend**: Node.js, Express.js, JSON Web Tokens (JWT), Bcrypt.js
- **Database**: MongoDB Atlas (Mongoose ODM)
- **Version Control**: Git

---

## Project Structure

```
Event_Manager/
├── client/          # React + Vite + Tailwind CSS frontend
├── server/          # Node.js + Express.js + Mongoose backend
├── .gitignore       # Git ignore patterns
└── README.md        # Project documentation
```

---

## Getting Started

### Prerequisites
- Node.js (v20 or higher; v22 recommended)
- npm (v9 or higher)
- MongoDB Atlas cluster URI or local MongoDB instance

### Backend Setup
1. Navigate to the server directory:
   ```bash
   cd server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file and configure your credentials:
   ```bash
   cp .env.example .env
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### One-Time Initial Administrator Bootstrap

Public registration intentionally does not allow administrator accounts. To provision the initial administrator, run this script manually from PowerShell after confirming the backend `.env` is configured. The script uses the existing Mongoose `User` model, bcrypt hashing, and a MongoDB transaction. It refuses to run if an active administrator already exists, if the email is already registered, or if the one-time bootstrap marker already exists.

From the repository root, enter the administrator name (optional), email, and password when prompted:

```powershell
$env:ADMIN_NAME = Read-Host "Administrator name (optional)"
$env:ADMIN_EMAIL = Read-Host "Administrator email"
$securePassword = Read-Host "Administrator password" -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
try {
  npm --prefix server run bootstrap:admin
} finally {
  Remove-Item Env:ADMIN_NAME, Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD -ErrorAction SilentlyContinue
  Remove-Variable securePassword -ErrorAction SilentlyContinue
}
```

The password is not echoed by the prompt. The process environment is cleared after the command, and the script clears its own credential variables on exit. Do not put credentials in source files or commit them. After a successful bootstrap, the script cannot be run a second time; future administrator onboarding must use a separate trusted process.

### Frontend Setup
1. Navigate to the client directory:
   ```bash
   cd client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```

### Password Recovery

Users can select **Forgot Password?** from the sign-in page, enter their registered email, and follow the emailed link to choose a new password. Recovery responses do not disclose whether an account exists. Reset links expire after 15 minutes, are stored in the database only as SHA-256 token hashes, and can be consumed only once. A successful reset invalidates existing JWTs; users must sign in again.

Configure these values in `server/.env` (never commit that file):

| Variable | Description |
| --- | --- |
| `SMTP_HOST` | Hostname of the SMTP provider |
| `SMTP_PORT` | SMTP port, commonly `587` for STARTTLS or `465` for implicit TLS |
| `SMTP_SECURE` | `true` for implicit TLS, otherwise `false` |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password or provider-issued app password |
| `EMAIL_FROM` | Verified sender address, for example `EventFlow <no-reply@example.com>` |
| `CLIENT_BASE_URL` | Trusted frontend origin used to construct reset links, e.g. `http://localhost:5173` |

`CLIENT_BASE_URL` is independent of the incoming request's Host header. Use the actual frontend URL in each deployment; production must use HTTPS. The `CLIENT_URL` value remains the backend CORS origin setting.

For local development, use a local SMTP capture service or a provider sandbox and set its SMTP credentials only in `server/.env`. Do not use a real user's mailbox or production SMTP credentials for development. If SMTP settings are incomplete, recovery fails with a temporary-unavailability response instead of claiming an email was sent. Delivery errors invalidate the pending token and are logged without including addresses, reset links, tokens, or credentials.

The recovery endpoints allow five requests per client IP and endpoint per 15-minute window. Counters are stored in MongoDB with a TTL index, so they are shared by application instances; MongoDB TTL deletion is eventual, and expired counter documents may remain briefly. The service fails closed when MongoDB is unavailable. Behind a reverse proxy, configure Express to trust only the known proxy hops so `req.ip` represents the client; do not blindly trust arbitrary forwarded headers. The rate limit is a baseline abuse control, not a substitute for provider-side SMTP quotas or edge-level protection.

After copying `server/.env.example`, replace every placeholder, including the SMTP settings and `CLIENT_BASE_URL`. Set the frontend's `client/.env` `VITE_API_URL` to the backend API URL as needed; this setting is separate from the backend's trusted reset-link base URL.

### Event Benefits and Eligible Years

Organizers can set AICTE point and attendance availability independently while creating or editing an event. Each is stored as a Boolean (`aictePointsAvailable` and `attendanceProvided`). Organizers can also choose one or more eligible student years from First through Fourth Year; the server stores only the fixed enum values (`first`, `second`, `third`, `fourth`) in `eligibleYears`. The “All Years” checkbox selects the complete set and reflects whether all four individual options are selected.

For compatibility, omitted availability fields default to `false` and omitted eligible years default to all four years. Existing MongoDB events are not migrated or rewritten; schema defaults and the frontend's legacy-data fallback provide these values when needed. The participant event cards and event details, as well as organizer event cards, display the benefits and eligibility.

### Tests

Run the backend and frontend test suites and frontend production build:

```bash
cd server
npm test
cd ../client
npm test
npm run build
```

Password-recovery controller tests use in-memory mock user/email stores and do not verify live SMTP delivery or MongoDB concurrency. Atomic token consumption and rate-limit counters use MongoDB conditional updates in normal operation; test success is not a claim of live Atlas integration. Verify SMTP credentials and deliverability in a staging environment before production rollout.
