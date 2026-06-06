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
type Exercise struct {
	ID            uint        `json:"id" gorm:"primarykey"`
	Name          string      `json:"name" gorm:"not null;size:100"`
	Description   string      `json:"description" gorm:"type:text"`
	HockeyBenefit string      `json:"hockey_benefit" gorm:"type:text"`
	VideoURL      string      `json:"video_url" gorm:"size:255"`
	ImageURL      string      `json:"image_url" gorm:"size:255"`
	Equipment     []Equipment `json:"equipment,omitempty" gorm:"many2many:exercise_equipment;"`
}

// Workout represents a training session.
type Workout struct {
	ID      uint         `json:"id" gorm:"primarykey"`
	UserID  uint         `json:"user_id"`
	Date    time.Time    `json:"date" gorm:"type:date;default:CURRENT_DATE"`
	Notes   string       `json:"notes" gorm:"type:text"`
	Logs    []WorkoutLog `json:"logs" gorm:"foreignKey:WorkoutID"`
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
	PortionGrams float64   `json:"portion_grams"`
	Type         string    `json:"type" gorm:"size:20"` // 'food' or 'drink'
	Meal         string    `json:"meal" gorm:"size:50"` // 'breakfast', 'lunch', etc.
	Timestamp    time.Time `json:"timestamp" gorm:"default:CURRENT_TIMESTAMP"`
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
	Image     string    `json:"image"`
	CreatedAt time.Time `json:"created_at" gorm:"default:CURRENT_TIMESTAMP"`
	UpdatedAt time.Time `json:"updated_at" gorm:"default:CURRENT_TIMESTAMP"`
}

