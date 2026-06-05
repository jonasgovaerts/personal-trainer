# AI Implementation Guide: Ice Hockey Personal Trainer App

## 1. Project Overview
This document serves as the master blueprint for an AI coding assistant to build a mobile-first web application. The app acts as a personal trainer specifically tailored for ice hockey players. 

**Core Value Proposition:**
1. Focuses on hockey-specific physical development (explosiveness, core stability, lower-body power).
2. Filters exercises based on the user's available home gym equipment.
3. Tracks workout progress and ensures correct form.

## 2. Tech Stack Requirements
* **Backend:** Go (Golang) using standard library `net/http` or a lightweight router like `chi` or `gorilla/mux`.
* **Frontend:** Vanilla HTML5, JavaScript (ES6+), and Tailwind CSS (via CDN for rapid prototyping, or configured via npm if a build step is preferred).
* **Database:** PostgreSQL.
* **Architecture:** Client-Server model. The frontend should communicate with the Go backend via RESTful JSON APIs.

---

## 3. Core Features & Functional Requirements

### 3.1 User Profile & Equipment Inventory
* **Profile:** Store user stats (e.g., current weight, height, primary hockey position, fitness goals).
* **Equipment Selector:** A UI where users toggle the equipment they currently own (e.g., Dumbbells, Barbell, Resistance Bands, Kettlebells, Pull-up Bar, Bodyweight-only, Swiss Ball, Medicine Ball).

### 3.2 Exercise Database (Hockey-Specific)
* **Filtering:** The system must filter available exercises by the user's selected equipment.
* **Data Structure:** Each exercise must include:
    * Name (e.g., "Bulgarian Split Squats", "Medicine Ball Rotational Throws").
    * Target Muscle Groups & Hockey Benefit (e.g., "Glutes/Quads - Improves skating stride power").
    * Required Equipment.
    * Form Instructions (Step-by-step text description).

### 3.3 Workout Generation & Tracking
* **Daily Workout:** Suggest a workout routine based on the user's profile and available equipment.
* **Logging:** Users can log sets, reps, and weight used for each exercise.
* **Progress Dashboard:** Visual representation of strength progression over time (e.g., increase in dumbbell weight used for lunges).

---

## 4. Database Schema (PostgreSQL)

Please implement the following schema using raw SQL migrations or a Go ORM like GORM:

```sql
-- Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    hockey_position VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Equipment Table (Lookup)
CREATE TABLE equipment (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- User Equipment Mapping
CREATE TABLE user_equipment (
    user_id INT REFERENCES users(id),
    equipment_id INT REFERENCES equipment(id),
    PRIMARY KEY (user_id, equipment_id)
);

-- Exercises Table
CREATE TABLE exercises (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    hockey_benefit TEXT,
    video_url VARCHAR(255)
);

-- Exercise Equipment Mapping (What equipment is needed for an exercise)
CREATE TABLE exercise_equipment (
    exercise_id INT REFERENCES exercises(id),
    equipment_id INT REFERENCES equipment(id),
    PRIMARY KEY (exercise_id, equipment_id)
);

-- Workouts (Sessions)
CREATE TABLE workouts (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    date DATE DEFAULT CURRENT_DATE,
    notes TEXT
);

-- Workout Logs (Sets/Reps)
CREATE TABLE workout_logs (
    id SERIAL PRIMARY KEY,
    workout_id INT REFERENCES workouts(id),
    exercise_id INT REFERENCES exercises(id),
    sets INT NOT NULL,
    reps INT NOT NULL,
    weight_kg DECIMAL(5,2),
    completed BOOLEAN DEFAULT FALSE
);
```

---

## 5. Backend API Design (Go)

Implement the following RESTful endpoints:

* **Users & Equipment:**
* `GET /api/user/{id}` - Fetch user details.
* `PUT /api/user/{id}/equipment` - Update user's available equipment.


* **Exercises:**
* `GET /api/exercises` - Fetch all exercises.
* `GET /api/exercises?user_id={id}` - Fetch exercises filtered by the user's available equipment inventory.


* **Workouts:**
* `POST /api/workouts` - Create a new workout session.
* `POST /api/workouts/{id}/log` - Add a set/rep log to a workout.
* `GET /api/workouts/history?user_id={id}` - Get past workouts for progress tracking.

---

## 6. Frontend UI/UX Guidelines

* **Mobile-First:** Ensure the design using Tailwind CSS looks like a native mobile app. Use a bottom navigation bar for core tabs: `[Home/Dashboard]`, `[Exercises]`, `[Track Workout]`, `[Profile]`.
* **Tailwind Styling:** Use clean, high-contrast UI suitable for gym environments. E.g., dark mode by default (`bg-gray-900`, `text-white`, `accent-blue-500`).
* **Form Cues:** Include "Form Tips" cards that are easily expandable (accordion style) when a user is actively tracking an exercise so they can double-check their posture.

---

## 7. Execution Instructions for AI Agent

**Phase 1: Project Setup & Database**

1. Initialize Go module.
2. Set up PostgreSQL connection (e.g., using `pgx` or `gorm`).
3. Execute the SQL schema to create tables.
4. Seed the database with 10-15 hockey-specific exercises (e.g., Skater Jumps, Cossack Squats, Paloff Press) and map them to their required equipment.

**Phase 2: API Development**

1. Build the Go HTTP server and define the routes.
2. Implement handlers for CRUD operations on exercises, equipment, and workout tracking.
3. Test API responses (return structured JSON).

**Phase 3: Frontend Implementation**

1. Create standard `index.html` structure.
2. Link Tailwind CSS.
3. Write vanilla JS to fetch data from the Go backend.
4. Implement the Equipment Selector UI, the Exercise Library, and the Workout Tracker UI.

**Phase 4: Refinement**

1. Add basic error handling on the frontend (e.g., "Please select equipment first").
2. Ensure the layout is responsive and mobile-friendly.

**Phase 5: Deployment & Infrastructure**

1. Create a `Dockerfile` to build the application into a container image.
2. Create a GitHub Actions workflow to automatically build the Docker image for both `amd64` and `arm64` architectures.
3. Push the multi-architecture image to a container registry.
4. Create Kubernetes deployment manifests (YAML files) for both the application and the PostgreSQL database, including necessary Deployments, Services, and PersistentVolumeClaims.