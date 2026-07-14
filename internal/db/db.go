package db

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/user/personal-trainer/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB initializes the database connection and performs migrations.
func InitDB() {
	// Standard PostgreSQL connection string format. Defaulting to local dev values.
	host := getEnv("DB_HOST", "localhost")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "postgres")
	dbname := getEnv("DB_NAME", "personal_trainer")
	port := getEnv("DB_PORT", "5432")

	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=UTC",
		host, user, password, dbname, port)

	log.Printf("INFO: Attempting to connect to database at %s:%s", host, port)
	var err error
	for i := 0; i < 10; i++ {
		DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("WARN: Failed to connect to database (attempt %d/10): %v. Retrying in 2s...", i+1, err)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatalf("Failed to connect to database after 10 attempts: %v", err)
	}

	log.Println("INFO: Connected to PostgreSQL database.")

	// Auto-migrate the schema
	err = DB.AutoMigrate(
		&models.User{},
		&models.Equipment{},
		&models.Exercise{},
		&models.Workout{},
		&models.WorkoutLog{},
		&models.NutritionLog{},
		&models.BarcodeProduct{},
		&models.BodyMeasurement{},
		&models.Meal{},
		&models.MealItem{},
		&models.WorkoutRoutine{},
		&models.RoutineExercise{},
		&models.WaterLog{},
		&models.ProgressPhoto{},
		&models.HealthActivity{},
		&models.HealthMetric{},
	)
	if err != nil {
		log.Fatalf("Failed to auto-migrate: %v", err)
	}

	log.Println("Database migration completed.")

	SeedDatabase(DB)
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

// SeedDatabase populates the DB with initial equipment and exercises and performs updates.
func SeedDatabase(db *gorm.DB) {
	log.Println("INFO: Seeding/updating database...")

	// 1. Seed Equipment
	equipmentList := []models.Equipment{
		{Name: "Halters (Dumbbells)"},
		{Name: "Halterstang (Barbell)"},
		{Name: "Weerstandsbanden"},
		{Name: "Kettlebells"},
		{Name: "Optrekstang"},
		{Name: "Lichaamsgewicht"},
		{Name: "Fitnessbal (Swiss Ball)"},
		{Name: "Medicijnbal"},
	}

	for _, eq := range equipmentList {
		var existing models.Equipment
		if err := db.Where("name = ?", eq.Name).First(&existing).Error; err != nil {
			db.Create(&eq)
		}
	}

	// Helper to find equipment by name
	getEq := func(name string) models.Equipment {
		var e models.Equipment
		db.Where("name = ?", name).First(&e)
		return e
	}

	bw := getEq("Lichaamsgewicht")
	dbell := getEq("Halters (Dumbbells)")
	kbell := getEq("Kettlebells")
	bbell := getEq("Halterstang (Barbell)")
	mball := getEq("Medicijnbal")
	bands := getEq("Weerstandsbanden")
	optrek := getEq("Optrekstang")

	// 2. Seed Exercises
	exercises := []models.Exercise{
		{
			Name:          "Bulgarian Split Squats",
			Description:   "Plaats één voet op een bankje achter je. Laat je heupen zakken totdat beide knieën in een hoek van 90 graden gebogen zijn. Duw jezelf terug naar de startpositie.",
			HockeyBenefit: "Unilaterale beenkracht, verbetert de kracht en balans van de schaatsbeweging.",
			VideoURL:      "https://www.youtube.com/watch?v=2C-uNgKwPLE",
			ImageURL:      "https://img.youtube.com/vi/2C-uNgKwPLE/hqdefault.jpg",
			Equipment:     []models.Equipment{bw, dbell, kbell},
		},
		{
			Name:          "Medicine Ball Rotational Throws",
			Description:   "Sta loodrecht op een muur. Houd een medicijnbal vast, draai je romp van de muur af, draai dan explosief terug en gooi de bal tegen de muur.",
			HockeyBenefit: "Roterende kernkracht, vertaalt zich direct naar schotsnelheid (slapshot/polsschot).",
			VideoURL:      "https://www.youtube.com/watch?v=z68C-BpMcyc",
			ImageURL:      "https://img.youtube.com/vi/z68C-BpMcyc/hqdefault.jpg",
			Equipment:     []models.Equipment{mball},
		},
		{
			Name:          "Skater Jumps",
			Description:   "Spring zijwaarts van de ene voet naar de andere en zwaai je armen mee voor momentum. Land zachtjes en spring direct terug naar de andere kant.",
			HockeyBenefit: "Zijwaartse explosiviteit, bootst de schaatsbeweging na.",
			VideoURL:      "https://www.youtube.com/watch?v=JQUqVHxbYEw",
			ImageURL:      "https://img.youtube.com/vi/JQUqVHxbYEw/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Cossack Squats",
			Description:   "Sta met je benen wijd. Zak door één been terwijl je het andere been recht opzij houdt. Houd je borst vooruit.",
			HockeyBenefit: "Mobiliteit/kracht in liezen en heupen, cruciaal voor schaatstechniek en blessurepreventie.",
			VideoURL:      "https://www.youtube.com/watch?v=JaCbmoDqUc4",
			ImageURL:      "https://img.youtube.com/vi/JaCbmoDqUc4/hqdefault.jpg",
			Equipment:     []models.Equipment{bw, dbell, kbell},
		},
		{
			Name:          "Pallof Press",
			Description:   "Bevestig een weerstandsband op borsthoogte. Ga zijwaarts ten opzichte van het anker staan, houd de band met beide handen voor je borst vast en druk recht naar voren, waarbij je de rotatiekracht weerstaat.",
			HockeyBenefit: "Anti-roterende rompstabiliteit, helpt bij het winnen van duels in de hoeken.",
			VideoURL:      "https://www.youtube.com/watch?v=axgv7H_VQOo",
			ImageURL:      "https://img.youtube.com/vi/axgv7H_VQOo/hqdefault.jpg",
			Equipment:     []models.Equipment{bands},
		},
		{
			Name:          "Goblet Squats",
			Description:   "Houd een halter of kettlebell verticaal op borsthoogte vast. Zak door je knieën totdat je hamstrings je kuiten raken, duw jezelf dan weer omhoog.",
			HockeyBenefit: "Kracht in het onderlichaam en rompstabiliteit.",
			VideoURL:      "https://www.youtube.com/watch?v=k_EhLGvM8TQ",
			ImageURL:      "https://img.youtube.com/vi/k_EhLGvM8TQ/hqdefault.jpg",
			Equipment:     []models.Equipment{dbell, kbell},
		},
		{
			Name:          "Plank met Shoulder Taps",
			Description:   "Begin in een hoge plankpositie. Houd je heupen stil, til één hand op en tik de tegenovergestelde schouder aan. Wissel van kant.",
			HockeyBenefit: "Rompstabiliteit en schouderuithoudingsvermogen.",
			VideoURL:      "https://www.youtube.com/watch?v=gKA5LBy7WAI",
			ImageURL:      "https://img.youtube.com/vi/gKA5LBy7WAI/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Single-Leg Romanian Deadlift (RDL)",
			Description:   "Buig vanuit je heupen, til één been recht naar achteren op terwijl je je romp laat zakken. Houd je rug recht.",
			HockeyBenefit: "Kracht in hamstrings en bilspieren, balans voor fasen waarbij je op één schaats staat.",
			VideoURL:      "https://www.youtube.com/watch?v=Zfr6wizR8rs",
			ImageURL:      "https://img.youtube.com/vi/Zfr6wizR8rs/hqdefault.jpg",
			Equipment:     []models.Equipment{bw, dbell, kbell, bbell},
		},
		{
			Name:          "Glute Bridges",
			Description:   "Ga op je rug liggen met gebogen knieën. Span je bilspieren aan en til je heupen richting het plafond. Houd dit kort vast.",
			HockeyBenefit: "Bilspieractivatie, belangrijk voor heupextensie tijdens het schaatsen.",
			VideoURL:      "https://www.youtube.com/watch?v=wPM8icPu6H8",
			ImageURL:      "https://img.youtube.com/vi/wPM8icPu6H8/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Russian Twists",
			Description:   "Zit met gebogen knieën en leun iets naar achteren. Draai je romp van links naar rechts, eventueel met een gewicht in je handen.",
			HockeyBenefit: "Roterende rompkracht.",
			VideoURL:      "https://www.youtube.com/watch?v=wkD8rjkodUI",
			ImageURL:      "https://img.youtube.com/vi/wkD8rjkodUI/hqdefault.jpg",
			Equipment:     []models.Equipment{bw, mball, dbell},
		},
		{
			Name:          "Pull-ups",
			Description:   "Hang aan een optrekstang met je handen iets breder dan schouderbreedte. Trek jezelf op totdat je kin boven de stang is, en laat je langzaam weer zakken.",
			HockeyBenefit: "Bovenrug- en grijpkracht, belangrijk voor puckbescherming en het winnen van fysieke duels.",
			VideoURL:      "https://www.youtube.com/watch?v=6zyx46Vpato",
			ImageURL:      "https://img.youtube.com/vi/6zyx46Vpato/hqdefault.jpg",
			Equipment:     []models.Equipment{optrek},
		},
		{
			Name:          "Dumbbell Rows",
			Description:   "Steun met één knie en hand op een bankje. Trek met je vrije hand een dumbbell richting je heup, houd je rug recht.",
			HockeyBenefit: "Unilaterale trekkracht, essentieel voor een sterke core en balans tijdens het schaatsen en vechten om de puck.",
			VideoURL:      "https://www.youtube.com/watch?v=pYcpY20QaE8",
			ImageURL:      "https://img.youtube.com/vi/pYcpY20QaE8/hqdefault.jpg",
			Equipment:     []models.Equipment{dbell},
		},
		{
			Name:          "Push-ups",
			Description:   "Start in een hoge plankpositie. Laat je lichaam zakken tot je borst bijna de vloer raakt, en duw jezelf krachtig weer omhoog.",
			HockeyBenefit: "Bovenlichaam duwkracht en core stabiliteit, helpt bij het afhouden van tegenstanders.",
			VideoURL:      "https://www.youtube.com/watch?v=IODxDxX7oi4",
			ImageURL:      "https://img.youtube.com/vi/IODxDxX7oi4/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Lunges",
			Description:   "Stap met één been naar voren en laat je heupen zakken totdat beide knieën in een hoek van 90 graden zijn. Duw jezelf terug naar de startpositie.",
			HockeyBenefit: "Unilaterale beenkracht en balans, belangrijk voor stabiliteit op het ijs.",
			VideoURL:      "https://www.youtube.com/watch?v=QOVaHwm-Q6U",
			ImageURL:      "https://img.youtube.com/vi/QOVaHwm-Q6U/hqdefault.jpg",
			Equipment:     []models.Equipment{bw, dbell, kbell, bbell},
		},
		{
			Name:          "Bicep Curls",
			Description:   "Houd een gewicht in elke hand met de handpalmen naar voren. Buig je ellebogen om de gewichten naar je schouders te brengen.",
			HockeyBenefit: "Armkracht, nuttig voor het vasthouden van je stick en face-offs.",
			VideoURL:      "https://www.youtube.com/watch?v=in7PaeYlhrM",
			ImageURL:      "https://img.youtube.com/vi/in7PaeYlhrM/hqdefault.jpg",
			Equipment:     []models.Equipment{dbell, bands, kbell, bbell},
		},
		{
			Name:          "Deadbugs",
			Description:   "Ga op je rug liggen met je armen en benen omhoog. Laat langzaam de tegenovergestelde arm en het been zakken, net boven de vloer, en breng ze terug.",
			HockeyBenefit: "Diepe core-stabiliteit en anti-extensie, voorkomt rugblessures.",
			VideoURL:      "https://www.youtube.com/watch?v=g_BYB0R-4Ws",
			ImageURL:      "https://img.youtube.com/vi/g_BYB0R-4Ws/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Burpees",
			Description:   "Begin staand, zak in een squatpositie, plaats je handen op de grond, spring met je voeten naar achteren in een plank, doe een push-up, spring terug en spring explosief in de lucht.",
			HockeyBenefit: "Volledige lichaamsconditie en explosiviteit, ideaal voor hoge hartslagen zoals tijdens een shift.",
			VideoURL:      "https://www.youtube.com/watch?v=qLBImHhCXSw",
			ImageURL:      "https://img.youtube.com/vi/qLBImHhCXSw/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Overhead Press",
			Description:   "Houd gewichten op schouderhoogte en duw ze recht boven je hoofd totdat je armen volledig zijn gestrekt. Laat ze gecontroleerd zakken.",
			HockeyBenefit: "Schouderkracht en stabiliteit, belangrijk voor fysieke gevechten langs de boarding.",
			VideoURL:      "https://www.youtube.com/watch?v=B-aVuyhvLHU",
			ImageURL:      "https://img.youtube.com/vi/B-aVuyhvLHU/hqdefault.jpg",
			Equipment:     []models.Equipment{dbell, kbell, bbell},
		},
		{
			Name:          "Jump Squats",
			Description:   "Maak een squat en spring zo explosief mogelijk omhoog. Land zachtjes en ga direct over in de volgende squat.",
			HockeyBenefit: "Maximale explosiviteit in het onderlichaam voor sprintvermogen.",
			VideoURL:      "https://www.youtube.com/watch?v=CVaEhXotL7M",
			ImageURL:      "https://img.youtube.com/vi/CVaEhXotL7M/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Calf Raises",
			Description:   "Ga op de bal van je voeten staan en duw jezelf omhoog totdat je kuiten volledig aangespannen zijn. Laat langzaam zakken.",
			HockeyBenefit: "Kuitkracht, helpt bij de laatste fase van de afzet tijdens het schaatsen.",
			VideoURL:      "https://www.youtube.com/watch?v=gwLzBJYoWlI",
			ImageURL:      "https://img.youtube.com/vi/gwLzBJYoWlI/hqdefault.jpg",
			Equipment:     []models.Equipment{bw, dbell, kbell, bbell},
		},
		{
			Name:          "Tricep Dips",
			Description:   "Plaats je handen achter je op een bankje of stoel en strek je benen. Laat je lichaam zakken door je ellebogen te buigen tot 90 graden, en duw weer op.",
			HockeyBenefit: "Triceps kracht, ondersteunt push-bewegingen en schotkracht.",
			VideoURL:      "https://www.youtube.com/watch?v=0326dy_-CzM",
			ImageURL:      "https://img.youtube.com/vi/0326dy_-CzM/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Leg Raises",
			Description:   "Ga op je rug liggen en til je gestrekte benen langzaam op tot ze loodrecht op de vloer staan. Laat ze gecontroleerd zakken zonder de vloer aan te raken.",
			HockeyBenefit: "Versterkt de lage buikspieren, helpt bij algemene rompspanning.",
			VideoURL:      "https://www.youtube.com/watch?v=xJJu-WiROM8",
			ImageURL:      "https://img.youtube.com/vi/xJJu-WiROM8/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Plank",
			Description:   "Steun op je onderarmen en tenen, en houd je lichaam in een rechte lijn als een plank. Span je buik- en bilspieren aan.",
			HockeyBenefit: "Fundamentele core-stabiliteit.",
			VideoURL:      "https://www.youtube.com/watch?v=ASdvN_XEl_c",
			ImageURL:      "https://img.youtube.com/vi/ASdvN_XEl_c/hqdefault.jpg",
			Equipment:     []models.Equipment{bw},
		},
		// New exercises: Barbell, Dumbbell, Kettlebell
		{
			Name:          "Barbell Back Squat",
			Description:   "Plaats de halterstang op je bovenrug. Zet je voeten op schouderbreedte. Zak gecontroleerd door je knieën alsof je op een stoel gaat zitten, houd je rug recht en duw jezelf weer omhoog.",
			HockeyBenefit: "Fundamentele kracht in de benen en heupen voor krachtige schaatsafzetten.",
			VideoURL:      "https://www.youtube.com/watch?v=8PMjqgR8Wa8",
			ImageURL:      "https://img.youtube.com/vi/8PMjqgR8Wa8/hqdefault.jpg",
			Equipment:     []models.Equipment{bbell},
		},
		{
			Name:          "Kettlebell Swings",
			Description:   "Sta met je voeten iets breder dan schouderbreedte. Buig vanuit de heupen, pak de kettlebell en zwaai deze krachtig naar voren tot ooghoogte door je heupen explosief te strekken.",
			HockeyBenefit: "Explosieve heupkracht en uithoudingsvermogen, essentieel voor snelle starts en sprints.",
			VideoURL:      "https://www.youtube.com/watch?v=YSxHifyI6s8",
			ImageURL:      "https://img.youtube.com/vi/YSxHifyI6s8/hqdefault.jpg",
			Equipment:     []models.Equipment{kbell},
		},
		{
			Name:          "Barbell Deadlift",
			Description:   "Sta met je voeten op heupbreedte onder de stang. Buig door je knieën en heupen, pak de stang vast en til deze met een rechte rug omhoog door je heupen en knieën te strekken.",
			HockeyBenefit: "Totale achterste keten kracht en core-stabiliteit om stevig op het ijs te staan en fysieke duels te domineren.",
			VideoURL:      "https://www.youtube.com/watch?v=r4MzxtBKyNE",
			ImageURL:      "https://img.youtube.com/vi/r4MzxtBKyNE/hqdefault.jpg",
			Equipment:     []models.Equipment{bbell},
		},
		{
			Name:          "Dumbbell Bench Press",
			Description:   "Lig plat op je rug op een bankje. Houd een dumbbell in elke hand op borsthoogte en duw ze recht omhoog tot je armen volledig gestrekt zijn. Laat ze gecontroleerd zakken.",
			HockeyBenefit: "Bovenlichaam duwkracht voor het afhouden van tegenstanders en stabiliteit in duels.",
			VideoURL:      "https://www.youtube.com/watch?v=5Y3VZsLb1Ys",
			ImageURL:      "https://img.youtube.com/vi/5Y3VZsLb1Ys/hqdefault.jpg",
			Equipment:     []models.Equipment{dbell},
		},
		{
			Name:          "Barbell Bent Over Row",
			Description:   "Buig voorover met een rechte rug, pak de barbell met een bovenhandse greep en trek de stang richting je navel terwijl je je schouderbladen samentrekt.",
			HockeyBenefit: "Krachtige rugspieren voor een stabiele, diepe schaatshouding en sterke trekkracht aan de stick.",
			VideoURL:      "https://www.youtube.com/watch?v=9efgcAjQe7E",
			ImageURL:      "https://img.youtube.com/vi/9efgcAjQe7E/hqdefault.jpg",
			Equipment:     []models.Equipment{bbell},
		},
		{
			Name:          "Kettlebell Clean & Press",
			Description:   "Breng de kettlebell explosief vanaf de grond naar je schouder (clean) en duw hem vervolgens recht omhoog boven je hoofd (press).",
			HockeyBenefit: "Unilaterale coördinatie, schouderstabiliteit en explosieve krachtoverdracht.",
			VideoURL:      "https://www.youtube.com/watch?v=lbuIHb_C4FU",
			ImageURL:      "https://img.youtube.com/vi/lbuIHb_C4FU/hqdefault.jpg",
			Equipment:     []models.Equipment{kbell},
		},
	}

	for _, ex := range exercises {
		var existing models.Exercise
		// Scope to global (seeded) exercises so a user's custom exercise with the same name is not clobbered.
		if err := db.Where("name = ? AND user_id IS NULL", ex.Name).First(&existing).Error; err != nil {
			db.Create(&ex)
		} else {
			// Exercise exists, update it
			existing.Description = ex.Description
			existing.HockeyBenefit = ex.HockeyBenefit
			existing.VideoURL = ex.VideoURL
			existing.ImageURL = ex.ImageURL
			db.Save(&existing)
			db.Model(&existing).Association("Equipment").Replace(ex.Equipment)
		}
	}
	log.Println("INFO: Database seeded and updated successfully.")
}
