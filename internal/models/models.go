package models

import (
	"time"
)

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
	GoalCarbs        int         `json:"goal_carbs"`
	GoalFat          int         `json:"goal_fat"`
	GoalWaterML      int         `json:"goal_water_ml"`
	HealthAPIKey     string      `json:"health_api_key,omitempty" gorm:"index;size:80"`
	HockeyPosition   string      `json:"hockey_position" gorm:"size:50"`
	LastWeightUpdate time.Time   `json:"last_weight_update"`
	CreatedAt        time.Time   `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	Equipment      []Equipment `json:"equipment,omitempty" gorm:"many2many:user_equipment;"`
	Workouts       []Workout   `json:"workouts,omitempty"`
}

// Equipment represents a type of gym equipment.
type Equipment struct {
	ID   uint   `json:"id" gorm:"primarykey"`
	Name string `json:"name" gorm:"unique;not null;size:50"`
}

// Exercise represents a hockey-specific exercise.
// UserID is nil for global (seeded) exercises and set for user-defined custom exercises.
type Exercise struct {
	ID            uint        `json:"id" gorm:"primarykey"`
	UserID        *uint       `json:"user_id,omitempty" gorm:"index"`
	Name          string      `json:"name" gorm:"not null;size:100"`
	Description   string      `json:"description" gorm:"type:text"`
	HockeyBenefit string      `json:"hockey_benefit" gorm:"type:text"`
	VideoURL      string      `json:"video_url" gorm:"size:255"`
	ImageURL      string      `json:"image_url" gorm:"size:255"`
	Equipment     []Equipment `json:"equipment,omitempty" gorm:"many2many:exercise_equipment;"`
}

// WorkoutRoutine is a reusable, editable workout template owned by a user.
type WorkoutRoutine struct {
	ID        uint              `json:"id" gorm:"primarykey"`
	UserID    uint              `json:"user_id" gorm:"index"`
	Name      string            `json:"name" gorm:"not null;size:100"`
	Exercises []RoutineExercise `json:"exercises" gorm:"foreignKey:RoutineID;constraint:OnDelete:CASCADE"`
	CreatedAt time.Time         `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// RoutineExercise is a single exercise entry within a WorkoutRoutine.
// Reps is a free-form string to preserve ranges like "8-10".
type RoutineExercise struct {
	ID         uint     `json:"id" gorm:"primarykey"`
	RoutineID  uint     `json:"routine_id" gorm:"index"`
	ExerciseID uint     `json:"exercise_id"`
	Exercise   Exercise `json:"exercise" gorm:"foreignKey:ExerciseID"`
	Position   int      `json:"position"`
	Sets       int      `json:"sets"`
	Reps       string   `json:"reps" gorm:"size:50"`
	Rest       string   `json:"rest" gorm:"size:50"`
}

// Workout represents a training session.
type Workout struct {
	ID             uint         `json:"id" gorm:"primarykey"`
	UserID         uint         `json:"user_id"`
	Date           time.Time    `json:"date" gorm:"type:date;default:CURRENT_DATE"`
	Notes          string       `json:"notes" gorm:"type:text"`
	CaloriesBurned int          `json:"calories_burned"`
	Logs           []WorkoutLog `json:"logs" gorm:"foreignKey:WorkoutID"`
}

// WorkoutLog represents a set within a workout.
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

// NutritionLog represents a food or drink item logged by the user.
type NutritionLog struct {
	ID           uint      `json:"id" gorm:"primarykey"`
	UserID       uint      `json:"user_id"`
	Barcode      string    `json:"barcode" gorm:"size:100"`
	Name         string    `json:"name" gorm:"not null"`
	Calories     int       `json:"calories" gorm:"not null"`
	Protein      float64   `json:"protein"`
	Carbs        float64   `json:"carbs"`
	Fat          float64   `json:"fat"`
	Fiber        float64   `json:"fiber"`
	PortionGrams float64   `json:"portion_grams"`
	Type         string    `json:"type" gorm:"size:20"` // 'food' or 'drink'
	Meal         string    `json:"meal" gorm:"size:50"` // 'breakfast', 'lunch', etc.
	Timestamp    time.Time `json:"timestamp" gorm:"default:CURRENT_TIMESTAMP"`
}

// Meal represents a reusable meal composed of multiple food items.
type Meal struct {
	ID        uint       `json:"id" gorm:"primarykey"`
	UserID    uint       `json:"user_id" gorm:"index"`
	Name      string     `json:"name" gorm:"not null;size:100"`
	Servings  float64    `json:"servings" gorm:"default:1"`
	Items     []MealItem `json:"items" gorm:"foreignKey:MealID;constraint:OnDelete:CASCADE"`
	CreatedAt time.Time  `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// MealItem is a single food item within a saved Meal, with values for the stored portion.
type MealItem struct {
	ID           uint    `json:"id" gorm:"primarykey"`
	MealID       uint    `json:"meal_id" gorm:"index"`
	Barcode      string  `json:"barcode" gorm:"size:100"`
	Name         string  `json:"name" gorm:"not null"`
	Calories     int     `json:"calories"`
	Protein      float64 `json:"protein"`
	Carbs        float64 `json:"carbs"`
	Fat          float64 `json:"fat"`
	Fiber        float64 `json:"fiber"`
	PortionGrams float64 `json:"portion_grams"`
	Type         string  `json:"type" gorm:"size:20"` // 'food' or 'drink'
}

// HealthActivity is a workout/activity imported from Apple Health (via Health Auto Export).
type HealthActivity struct {
	ID               uint      `json:"id" gorm:"primarykey"`
	UserID           uint      `json:"user_id" gorm:"index"`
	ExternalID       string    `json:"external_id" gorm:"index;size:120"`
	Name             string    `json:"name" gorm:"size:100"`
	Start            time.Time `json:"start"`
	End              time.Time `json:"end"`
	DurationSec      int       `json:"duration_sec"`
	ActiveEnergyKcal float64   `json:"active_energy_kcal"`
	TotalEnergyKcal  float64   `json:"total_energy_kcal"`
	DistanceKM       float64   `json:"distance_km"`
	AvgHeartRate     int       `json:"avg_heart_rate"`
	MaxHeartRate     int       `json:"max_heart_rate"`
	StepCount        int       `json:"step_count"`
	CreatedAt        time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// HealthMetric is a daily aggregated Apple Health metric (e.g. heart rate, active energy, steps).
type HealthMetric struct {
	ID     uint      `json:"id" gorm:"primarykey"`
	UserID uint      `json:"user_id" gorm:"index"`
	Name   string    `json:"name" gorm:"index;size:60"`
	Date   time.Time `json:"date" gorm:"index"`
	Min    float64   `json:"min"`
	Max    float64   `json:"max"`
	Avg    float64   `json:"avg"`
	Qty    float64   `json:"qty"`
	Units  string    `json:"units" gorm:"size:30"`
}

// WaterLog is a single hydration entry in millilitres.
type WaterLog struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	UserID    uint      `json:"user_id" gorm:"index"`
	ML        int       `json:"ml"`
	Timestamp time.Time `json:"timestamp" gorm:"default:CURRENT_TIMESTAMP"`
}

// ProgressPhoto is a user progress photo stored in object storage (S3/MinIO).
type ProgressPhoto struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	UserID    uint      `json:"user_id" gorm:"index"`
	ObjectKey string    `json:"-" gorm:"size:255"`
	URL       string    `json:"url" gorm:"-"` // populated at read time with a presigned URL
	Note      string    `json:"note" gorm:"size:255"`
	TakenAt   time.Time `json:"taken_at"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
}

// BodyMeasurement represents a snapshot of the user's body measurements in cm (weight in kg).
type BodyMeasurement struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	UserID    uint      `json:"user_id" gorm:"index"`
	WeightKG  float64   `json:"weight_kg"`
	Chest     float64   `json:"chest"`
	Waist     float64   `json:"waist"`
	Hips      float64   `json:"hips"`
	Bicep     float64   `json:"bicep"`
	Thigh     float64   `json:"thigh"`
	Calf      float64   `json:"calf"`
	Neck      float64   `json:"neck"`
	Timestamp time.Time `json:"timestamp" gorm:"default:CURRENT_TIMESTAMP"`
}

// BarcodeProduct represents a cached or user-corrected product mapping.
type BarcodeProduct struct {
	ID        uint      `json:"id" gorm:"primarykey"`
	Barcode   string    `json:"barcode" gorm:"uniqueIndex;not null;size:100"`
	Name      string    `json:"name" gorm:"not null"`
	Brand     string    `json:"brand"`
	Calories  float64   `json:"calories"`
	Protein   float64   `json:"protein"`
	Carbs     float64   `json:"carbs"`
	Fat       float64   `json:"fat"`
	Fiber     float64   `json:"fiber"`
	Type      string    `json:"type" gorm:"size:20"`
	Image     string    `json:"image"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

