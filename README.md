# Personal Trainer AI

A comprehensive fitness and nutrition platform built with Go, React, and Google's Gemini AI. This application helps users track workouts, manage nutrition via AI-powered image analysis, and follow personalized training programs.

## Features

- **Dashboard:** Overview of your fitness journey and daily goals.
- **Workout Builder:** Create and customize your own workout routines.
- **Active Workout:** Real-time tracking of your sets, reps, and weights.
- **AI Nutrition Analysis:** Upload photos of your meals or barcodes for instant nutritional breakdown using Gemini AI.
- **Progress Tracking:** Detailed history and charts for workouts and nutrition.
- **Personalized Profile:** Tailor the experience based on your available equipment and fitness level.

## Tech Stack

- **Backend:** Go 1.22+ with GORM (PostgreSQL)
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide React, Framer Motion
- **AI:** Google Gemini AI (Generative AI Go SDK)
- **Database:** PostgreSQL

---

## Getting Started Locally

### Prerequisites

- [Go](https://go.dev/doc/install) (1.22 or later)
- [Node.js](https://nodejs.org/) (v18 or later) & npm
- [PostgreSQL](https://www.postgresql.org/download/) (Running locally or via Docker)
- [Gemini API Key](https://aistudio.google.com/app/apikey)

### 1. Database Setup

Ensure you have a PostgreSQL database running. By default, the application looks for a database named `personal_trainer`.

If you have Docker installed, you can quickly start a Postgres instance:

```bash
docker run --name pt-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=personal_trainer -p 5432:5432 -d postgres
```

### 2. Backend Setup

1.  Navigate to the root directory.
2.  Set the required environment variables:

    ```bash
    export GEMINI_API_KEY=your_api_key_here
    export DB_HOST=localhost
    export DB_PORT=5432
    export DB_USER=postgres
    export DB_PASSWORD=postgres
    export DB_NAME=personal_trainer
    ```

3.  Install Go dependencies:

    ```bash
    go mod download
    ```

4.  Run the backend server:

    ```bash
    go run cmd/server/main.go
    ```

    The server will start on `http://localhost:8080`. It will automatically perform database migrations and seed initial data (equipment and exercises) on the first run.

### 3. Frontend Setup

1.  Navigate to the `frontend` directory:

    ```bash
    cd frontend
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Run the development server:

    ```bash
    npm run dev
    ```

    The frontend will be available at `http://localhost:5173`. It is configured to proxy API requests to the backend at `http://localhost:8080`.

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Port for the Go server to listen on | `8080` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | PostgreSQL database name | `personal_trainer` |
| `GEMINI_API_KEY` | Your Google Gemini API Key | **Required** |

---

## Production-like Local Run

To run the application as a single unit (backend serving the frontend):

1.  Build the frontend:

    ```bash
    cd frontend
    npm run build
    ```

2.  Copy the build output to the backend's static directory:

    ```bash
    # From the root directory
    mkdir -p static
    cp -r frontend/dist/* static/
    ```

3.  Run the backend:

    ```bash
    go run cmd/server/main.go
    ```

    Now, visit `http://localhost:8080` to see the full application.

## Docker

You can also run the entire application using Docker:

```bash
docker build -t personal-trainer .
docker run -p 8080:8080 -e GEMINI_API_KEY=your_api_key_here personal-trainer
```

*(Note: Ensure your database is accessible from the container, or use a Docker Compose setup for a complete environment.)*
