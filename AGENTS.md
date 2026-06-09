# AI Implementation Guide: Ice Hockey Personal Trainer App

## 1. Project Overview
This document serves as the master blueprint for an AI coding assistant to build an enterprise-grade, mobile-first web application. The app acts as a personal trainer specifically tailored for ice hockey players, acting as a single-user dashboard for both physical training and nutrition tracking.

**Core Value Proposition:**
1. Focuses on hockey-specific physical development (explosiveness, core stability, lower-body power).
2. Intelligently filters exercises and predefined workout routines based on the user's available home gym equipment.
3. Tracks workout progress (sets, reps, weight) via an interactive stepper interface.
4. Integrates a Gemini AI-powered Nutrition Tracker to estimate calories and macros from photos and barcodes.

## 2. Tech Stack Requirements
* **Backend:** Go (Golang) using standard library `net/http` router (Go 1.22+).
* **Frontend:** React + TypeScript (Vite), Tailwind CSS, Framer Motion, Recharts, Lucide Icons, and React Router.
* **Database:** PostgreSQL managed via GORM.
* **Architecture:** Client-Server SPA model. The frontend communicates with the Go backend via RESTful JSON APIs.
* **AI Integration:** Google Generative AI SDK (`gemini-2.5-flash` model).

---

## 3. Core Features & Functional Requirements

### 3.1 Setup Wizard & User Profile
* **Onboarding:** A multi-step setup wizard that captures Gender, Birth Date, Height, Current Weight, Target Weight, Activity Level, and Available Equipment.
* **Dynamic Goals:** Uses the Mifflin-St Jeor equation to dynamically calculate BMR, TDEE, and personalized daily goals for Calories, Protein, Carbs, and Fat based on whether the user is cutting, maintaining, or bulking.

### 3.2 Exercise Database & Equipment Filtering (Hockey-Specific)
* **Intelligent Filtering:** The system must strictly filter available exercises by the user's selected equipment (using a `hasAny` logic: if an exercise supports Bodyweight OR Dumbbells, owning either unlocks it). "Bodyweight" is permanently assumed as available.
* **Data Structure:** Each exercise includes:
    * Name, Description, Hockey Benefit.
    * `VideoURL` (YouTube) and `ImageURL`.
    * Required Equipment.

### 3.3 Workout Generation & Tracking
* **Predefined Plans:** Categorized 1-hour routines (Full Body, Lower Body, Core, Upper Body) explicitly defining Sets, Reps, and Weight for each exercise. Plans are visibly disabled if the user lacks equipment.
* **Custom Workout Builder:** A drag-and-drop interface (`framer-motion`) to build custom routines from the filtered exercise library.
* **Active Session Stepper:** A guided, exercise-by-exercise interface. Supports "Standard Mode" (finish all sets per exercise) and "Circuit Mode" (looping 1 set per exercise). Includes inline auto-playing video tutorials.
* **History Timeline:** A detailed, grouped timeline view of all completed past workouts.

### 3.4 AI Nutrition Tracker
* **Dashboard:** Tracks daily consumption of Calories, Protein, Carbs, and Fat against calculated goals using circular and linear progress bars.
* **Meal Categories:** Logs are split into Breakfast, Lunch, Dinner, and Snacks.
* **AI Camera/Barcode Scanner:** Utilizes HTML5 `navigator.mediaDevices` to capture webcam photos. Sends images to the Go backend where `gemini-2.5-flash` analyzes them:
    * **Plate Mode:** Estimates TOTAL calories and macros for the whole meal.
    * **Barcode Mode:** Estimates calories and macros per 100g, prompting the user to input grams for a dynamic calculation.
* **Manual Entry & Deletion:** Users can manually log items and delete existing logs.

### 3.5 Internationalization (i18n)
* The entire React frontend is wrapped in `react-i18next`, supporting instantaneous switching between **English (en)** and **Dutch (nl)**.

---

## 4. Database Schema (PostgreSQL via GORM)

```go
// User represents a user in the application.
type User struct {
	ID             uint        `json:"id" gorm:"primarykey"`
	Username       string      `json:"username" gorm:"unique;not null;size:50"`
	Name           string      `json:"name" gorm:"size:100"`
	Gender         string      `json:"gender" gorm:"size:20"`
	BirthDate      string      `json:"birth_date" gorm:"size:20"`
	Height         float64     `json:"height"`
	CurrentWeight  float64     `json:"current_weight"`
	TargetWeight   float64     `json:"target_weight"`
	ActivityLevel  string      `json:"activity_level" gorm:"size:20"`
	GoalCalories   int         `json:"goal_calories"`
	GoalProtein    int         `json:"goal_protein"`
	GoalCarbs      int         `json:"goal_carbs"`
	GoalFat        int         `json:"goal_fat"`
	HockeyPosition string      `json:"hockey_position" gorm:"size:50"`
	CreatedAt      time.Time   `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	Equipment      []Equipment `json:"equipment,omitempty" gorm:"many2many:user_equipment;"`
	Workouts       []Workout   `json:"workouts,omitempty"`
}

type Equipment struct {
	ID   uint   `json:"id" gorm:"primarykey"`
	Name string `json:"name" gorm:"unique;not null;size:50"`
}

type Exercise struct {
	ID            uint        `json:"id" gorm:"primarykey"`
	Name          string      `json:"name" gorm:"not null;size:100"`
	Description   string      `json:"description" gorm:"type:text"`
	HockeyBenefit string      `json:"hockey_benefit" gorm:"type:text"`
	VideoURL      string      `json:"video_url" gorm:"size:255"`
	ImageURL      string      `json:"image_url" gorm:"size:255"`
	Equipment     []Equipment `json:"equipment,omitempty" gorm:"many2many:exercise_equipment;"`
}

type Workout struct {
	ID      uint         `json:"id" gorm:"primarykey"`
	UserID  uint         `json:"user_id"`
	Date    time.Time    `json:"date" gorm:"type:date;default:CURRENT_DATE"`
	Notes   string       `json:"notes" gorm:"type:text"`
	Logs    []WorkoutLog `json:"logs" gorm:"foreignKey:WorkoutID"`
}

type WorkoutLog struct {
	ID         uint      `json:"id" gorm:"primarykey"`
	WorkoutID  uint      `json:"workout_id"`
	ExerciseID uint      `json:"exercise_id"`
	Exercise   Exercise  `json:"exercise" gorm:"foreignKey:ExerciseID"`
	Sets       int       `json:"sets" gorm:"not null"`
	Reps       int       `json:"reps" gorm:"not null"`
	WeightKG   float64   `json:"weight_kg" gorm:"type:decimal(5,2)"`
	Completed  bool      `json:"completed" gorm:"default:false"`
}

type NutritionLog struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	UserID    uint      `json:"user_id"`
	Name      string    `json:"name" gorm:"not null"`
	Calories  int       `json:"calories" gorm:"not null"`
	Protein   float64   `json:"protein"`
	Carbs     float64   `json:"carbs"`
	Fat       float64   `json:"fat"`
	Type      string    `json:"type" gorm:"size:20"` // 'food' or 'drink'
	Meal      string    `json:"meal" gorm:"size:50"` // 'breakfast', 'lunch', etc.
	Timestamp time.Time `json:"timestamp" gorm:"default:CURRENT_TIMESTAMP"`
}
```

---

## 5. Backend API Design (Go)

Implement the following RESTful endpoints:

* **Users & Profile:**
* `GET /api/user/{id}` - Fetch user details, goals, and equipment.
* `PUT /api/user/{id}/profile` - Update user metrics and generated goals.
* `PUT /api/user/{id}/equipment` - Update user's available equipment.


* **Exercises & Equipment:**
* `GET /api/equipment` - Fetch all equipment types.
* `GET /api/exercises` - Fetch all exercises.
* `GET /api/exercises?user_id={id}` - Fetch exercises strictly filtered by the user's available equipment inventory (implicitly allows bodyweight).


* **Workouts:**
* `POST /api/workouts` - Create a new workout session.
* `POST /api/workouts/{id}/log` - Add a set/rep log to a workout.
* `GET /api/workouts/history?user_id={id}` - Get past workouts grouped by exercise.

* **Nutrition & AI:**
* `GET /api/nutrition?user_id={id}` - Fetch daily nutrition logs.
* `POST /api/nutrition` - Save a new nutrition entry.
* `DELETE /api/nutrition/{id}` - Delete a specific nutrition log.
* `POST /api/nutrition/analyze?mode={barcode|plate}` - Send multipart image data to Gemini 2.5 Flash for JSON-formatted macro analysis.

---

## 6. Frontend UI/UX Guidelines

* **Ultra-Premium Design:** The application must utilize a modern, dark-themed UI (slate-950 background) with glassmorphism/neumorphism elements, matching premium tools like WHOOP or Apple Fitness.
* **Component Library:** Built with custom Tailwind classes and Lucide icons.
* **Feedback Systems:** Custom `UIContext` handling non-blocking Toasts (`success`, `error`, `info`) and beautiful Confirmation Modals, replacing all native browser alerts.
* **Responsiveness:** Sidebar navigation on desktop; flex/grid layouts must gracefully stack for mobile-first usage.

---

## 7. Deployment & Infrastructure

1. **Docker:** `Dockerfile` using multi-stage builds (golang builder -> alpine runtime) to compile the Go server and serve the Vite React static build (`/static`).
2. **CI/CD:** GitHub Actions workflow to automatically build the Docker image for both `amd64` and `arm64` architectures, pushing to the GitHub Container Registry.
3. **Kubernetes:** Manifests (`k8s/`) including Deployments, Services, and PersistentVolumeClaims for both the application and the PostgreSQL database. Includes a `Secret` for injecting the `GEMINI_API_KEY` environment variable.

---

## 8. Git & Deployment Permissions
* **Git Operations:** The AI assistant is explicitly authorized to commit and push changes directly to the remote Git repository to trigger automated CI/CD workflows and deployments.