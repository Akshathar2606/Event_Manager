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

### Catering Discovery Filters

`GET /api/catering` keeps its existing paginated response and accepts `search`, `city`, `locality`, `cuisine`, `dietary`, `maxPrice`, `guestCount`, `latitude`, `longitude`, `radiusKm`, `page`, and `limit`. City and locality match case-insensitively; cuisine and dietary values may be comma-separated. Price, dietary, and capacity criteria are evaluated against the same active package, and archived packages do not qualify. Distance filtering is enabled only when valid latitude, longitude, and a positive radius are all supplied; distance is returned in `distanceKm`. City and locality searches continue to include legacy profiles without coordinates.

Vendor profiles may optionally include `city`, `locality`, `fullAddress`, and `location: { type: "Point", coordinates: [longitude, latitude] }`. Package `maxGuests` is optional and must be an integer no lower than `minOrder`; packages without it remain uncapped.

The catering model declares the `location` 2dsphere index. If a deployment disables Mongoose automatic index creation, provision that index before enabling radius searches; this requires no data migration or record changes.

### Fictional Catering Demo Listings

The optional demo seed creates up to three clearly labelled fictional Tumakuru catering profiles with illustrative prices and menus. It never creates vendor accounts and never overwrites an existing catering profile. Before running it, select one to three existing vendor account ObjectIds that are approved for demo use; the operation skips any selected account that already has a catering profile. No credentials or contact details are added to the demo listings.

Run from the repository root after configuring the server's MongoDB connection:

```powershell
node .\server\scripts\seed-catering-demos.js <existing-vendor-object-id> [<existing-vendor-object-id> ...]
```

The demo coordinates and locality labels are illustrative, not business addresses. Do not assign a demo profile to a real vendor account without that account owner's consent.

### Event Benefits and Eligible Years

Organizers can set AICTE point and attendance availability independently while creating or editing an event. Each is stored as a Boolean (`aictePointsAvailable` and `attendanceProvided`). Organizers can also choose one or more eligible student years from First through Fourth Year; the server stores only the fixed enum values (`first`, `second`, `third`, `fourth`) in `eligibleYears`. The “All Years” checkbox selects the complete set and reflects whether all four individual options are selected.

For compatibility, omitted availability fields default to `false` and omitted eligible years default to all four years. Existing MongoDB events are not migrated or rewritten; schema defaults and the frontend's legacy-data fallback provide these values when needed. The participant event cards and event details, as well as organizer event cards, display the benefits and eligibility.

### Event Lifecycle

The stored event status remains `draft`, `published`, or `cancelled`; API event reads also include a derived `lifecycleStatus` of `draft`, `upcoming`, `ongoing`, `completed`, or `cancelled`. Published event status is calculated from `startDateTime` and `endDateTime` on each API read and filter, so no scheduler or database migration is needed. Date values are compared as UTC instants; the event schema does not currently store a separate timezone.

Draft and cancelled events keep their stored state. If an event has no end timestamp, its lifecycle end is inferred as 24 hours after its start. An explicit end time is still required before publishing because venue approval must cover the booked event interval. A MongoDB-backed scheduler records completion activity after published events end without changing stored registration or booking history. Completed event schedules are read-only, while event, registration, venue, booking, and attendee history remains available.

### Notifications and Event Activity

Authenticated users can view their own paginated notifications at `GET /api/notifications`, check their unread count at `/api/notifications/unread-count`, and mark one or all notifications as read. Notification recipients are derived from persisted event, booking, catering, registration, and vendor-application relationships; clients cannot choose recipients. The AppLayout notification panel refreshes its unread count once per minute.

The backend records event creation, publication, important updates, cancellation, registration, venue booking, catering request, and completion activity. Activity history is available to the event's organizer and administrators at `GET /api/events/:id/activity`; it is not exposed to unrelated participants. Notifications and activity records use action-specific deduplication keys. Delivery failures are logged and do not roll back or change the response for a completed business action.

The persistent reminder scheduler stores reminder jobs in MongoDB, initializes their indexes before the HTTP server starts, and uses atomic leases, bounded retries (up to five attempts), and deduplication keys to coordinate workers and survive restarts. It runs once per minute outside automated test environments. Organizers are reminded 7 days and 24 hours before an event; active registered participants are reminded 24 hours and 1 hour before it. Pending venue bookings and unanswered catering requests are reminded every 24 hours after the initial 24-hour wait, while pending vendor applications are reminded every 48 hours after their initial 48-hour wait. Resolved or ineligible requests are cancelled, and reminders that are too late are not delivered. Recipients are looked up from current database relationships when a reminder is delivered.

Event completion remains a derived lifecycle state rather than a stored event status. The scheduler records a deduplicated completion activity after the scheduled end time; no write is triggered by an ordinary GET request. Notifications are polled by the client and are not real-time. Automated scheduling and event completion have mock-store test coverage; production persistence, cross-process atomic claims, and timing should also be verified against a staging MongoDB deployment.

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
