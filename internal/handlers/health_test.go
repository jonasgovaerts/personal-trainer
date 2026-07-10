package handlers

import (
	"testing"
	"time"

	"github.com/user/personal-trainer/internal/models"
)

func TestIsDuplicateActivity(t *testing.T) {
	now := time.Now()

	activityA := models.HealthActivity{
		Start:            now,
		DurationSec:      1800,
		DistanceKM:       5.0,
		AvgHeartRate:     140,
		ActiveEnergyKcal: 300,
	}

	// 1. Exact copy
	activityB := activityA
	if !isDuplicateActivity(activityA, activityB) {
		t.Error("Expected exact copy to be a duplicate")
	}

	// 2. Start time within 2 minutes
	activityC := activityA
	activityC.Start = now.Add(1 * time.Minute)
	if !isDuplicateActivity(activityA, activityC) {
		t.Error("Expected activities within 1 minute start difference to be duplicate")
	}

	// Start time more than 2 minutes
	activityD := activityA
	activityD.Start = now.Add(3 * time.Minute)
	if isDuplicateActivity(activityA, activityD) {
		t.Error("Expected activities with 3 minutes start difference NOT to be duplicate")
	}

	// 3. Duration within 10 seconds
	activityE := activityA
	activityE.DurationSec = 1805
	if !isDuplicateActivity(activityA, activityE) {
		t.Error("Expected activities within 5 seconds duration difference to be duplicate")
	}

	activityF := activityA
	activityF.DurationSec = 1815
	if isDuplicateActivity(activityA, activityF) {
		t.Error("Expected activities with 15 seconds duration difference NOT to be duplicate")
	}

	// 4. Distance within 0.05 km
	activityG := activityA
	activityG.DistanceKM = 5.02
	if !isDuplicateActivity(activityA, activityG) {
		t.Error("Expected activities within 0.02 km distance difference to be duplicate")
	}

	activityH := activityA
	activityH.DistanceKM = 5.1
	if isDuplicateActivity(activityA, activityH) {
		t.Error("Expected activities with 0.1 km distance difference NOT to be duplicate")
	}

	// 5. Avg Heart Rate within 3 bpm
	activityI := activityA
	activityI.AvgHeartRate = 142
	if !isDuplicateActivity(activityA, activityI) {
		t.Error("Expected activities within 2 bpm average heart rate difference to be duplicate")
	}

	activityJ := activityA
	activityJ.AvgHeartRate = 145
	if isDuplicateActivity(activityA, activityJ) {
		t.Error("Expected activities with 5 bpm average heart rate difference NOT to be duplicate")
	}
}
