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
- Node.js (v18 or higher recommended; v22 supported)
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
