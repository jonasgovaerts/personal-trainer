package handlers

import (
	"bytes"
	"fmt"
	"log"

	"github.com/muktihari/fit/decoder"
	"github.com/muktihari/fit/profile/mesgdef"
	"github.com/muktihari/fit/profile/typedef"
)

// ParseFitFile parses an uploaded binary .FIT file and extracts activity details
func ParseFitFile(fileBytes []byte) (calories int, activityName string, durationMinutes int, err error) {
	reader := bytes.NewReader(fileBytes)
	dec := decoder.New(reader)

	fitFile, err := dec.Decode()
	if err != nil {
		return 0, "", 0, fmt.Errorf("failed to decode fit file: %w", err)
	}

	// Set default values in case no session message is found
	calories = 0
	activityName = "Workout"
	durationMinutes = 0

	var foundSession bool
	for _, msg := range fitFile.Messages {
		if msg.Num == typedef.MesgNumSession {
			session := mesgdef.NewSession(&msg)
			
			// Extract sport / activity type
			if session.Sport != typedef.SportInvalid {
				activityName = session.Sport.String()
			}
			
			// Extract Calories
			calories = int(session.TotalCalories)
			
			// Extract Duration in Minutes
			// TotalTimerTimeScaled() returns float64 in seconds
			timerTimeSeconds := session.TotalTimerTimeScaled()
			if timerTimeSeconds > 0 {
				durationMinutes = int(timerTimeSeconds / 60.0)
			} else {
				// Fallback to elapsed time if timer time is not available
				elapsedTimeSeconds := session.TotalElapsedTimeScaled()
				if elapsedTimeSeconds > 0 {
					durationMinutes = int(elapsedTimeSeconds / 60.0)
				}
			}
			
			foundSession = true
			log.Printf("INFO: Native FIT parser extracted sport: %s, calories: %d kcal, duration: %d min", activityName, calories, durationMinutes)
			break
		}
	}

	if !foundSession {
		log.Printf("WARN: No session messages found in FIT file")
	}

	return calories, activityName, durationMinutes, nil
}
