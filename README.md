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
