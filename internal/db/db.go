package db

import (
	"fmt"
	"log"
	"os"

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

	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Connected to PostgreSQL database.")

	// Auto-migrate the schema
	err = DB.AutoMigrate(
		&models.User{},
		&models.Equipment{},
		&models.Exercise{},
		&models.Workout{},
		&models.WorkoutLog{},
		&models.NutritionLog{},
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

// SeedDatabase populates the DB with initial equipment and exercises if empty.
func SeedDatabase(db *gorm.DB) {
	var count int64
	db.Model(&models.Equipment{}).Count(&count)
	if count > 0 {
		log.Println("Database already seeded. Skipping.")
		return
	}

	log.Println("Seeding database...")

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
	db.Create(&equipmentList)

	// Helper to find equipment by name
	getEq := func(name string) models.Equipment {
		var e models.Equipment
		db.Where("name = ?", name).First(&e)
		return e
	}

	bw := getEq("Lichaamsgewicht")
	dbell := getEq("Halters (Dumbbells)")
	kbell := getEq("Kettlebells")
	mball := getEq("Medicijnbal")
	bands := getEq("Weerstandsbanden")

	// 2. Seed Exercises
	exercises := []models.Exercise{
		{
			Name:          "Bulgarian Split Squats",
			Description:   "Plaats één voet op een bankje achter je. Laat je heupen zakken totdat beide knieën in een hoek van 90 graden gebogen zijn. Duw jezelf terug naar de startpositie.",
			HockeyBenefit: "Unilaterale beenkracht, verbetert de kracht en balans van de schaatsbeweging.",
			VideoURL:      "https://www.youtube.com/watch?v=2C-uNgKwPLE",
			ImageURL:      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw, dbell, kbell},
		},
		{
			Name:          "Medicine Ball Rotational Throws",
			Description:   "Sta loodrecht op een muur. Houd een medicijnbal vast, draai je romp van de muur af, draai dan explosief terug en gooi de bal tegen de muur.",
			HockeyBenefit: "Roterende kernkracht, vertaalt zich direct naar schotsnelheid (slapshot/polsschot).",
			VideoURL:      "https://www.youtube.com/watch?v=z68C-BpMcyc",
			ImageURL:      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{mball},
		},
		{
			Name:          "Skater Jumps",
			Description:   "Spring zijwaarts van de ene voet naar de andere en zwaai je armen mee voor momentum. Land zachtjes en spring direct terug naar de andere kant.",
			HockeyBenefit: "Zijwaartse explosiviteit, bootst de schaatsbeweging na.",
			VideoURL:      "https://www.youtube.com/watch?v=W_Yn3eDmbxY",
			ImageURL:      "https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Cossack Squats",
			Description:   "Sta met je benen wijd. Zak door één been terwijl je het andere been recht opzij houdt. Houd je borst vooruit.",
			HockeyBenefit: "Mobiliteit/kracht in liezen en heupen, cruciaal voor schaatstechniek en blessurepreventie.",
			VideoURL:      "https://www.youtube.com/watch?v=tpqEZbI1kQo",
			ImageURL:      "https://images.unsplash.com/photo-1594737625785-a2bad332f13e?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw, dbell, kbell},
		},
		{
			Name:          "Pallof Press",
			Description:   "Bevestig een weerstandsband op borsthoogte. Ga zijwaarts ten opzichte van het anker staan, houd de band met beide handen voor je borst vast en druk recht naar voren, waarbij je de rotatiekracht weerstaat.",
			HockeyBenefit: "Anti-roterende rompstabiliteit, helpt bij het winnen van duels in de hoeken.",
			VideoURL:      "https://www.youtube.com/watch?v=nNGAOQ4L93w",
			ImageURL:      "https://images.unsplash.com/photo-1598971639058-fab3c3109a00?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bands},
		},
		{
			Name:          "Goblet Squats",
			Description:   "Houd een halter of kettlebell verticaal op borsthoogte vast. Zak door je knieën totdat je hamstrings je kuiten raken, duw jezelf dan weer omhoog.",
			HockeyBenefit: "Kracht in het onderlichaam en rompstabiliteit.",
			VideoURL:      "https://www.youtube.com/watch?v=MeIiIdhgxtI",
			ImageURL:      "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{dbell, kbell},
		},
		{
			Name:          "Plank met Shoulder Taps",
			Description:   "Begin in een hoge plankpositie. Houd je heupen stil, til één hand op en tik de tegenovergestelde schouder aan. Wissel van kant.",
			HockeyBenefit: "Rompstabiliteit en schouderuithoudingsvermogen.",
			VideoURL:      "https://www.youtube.com/watch?v=1rYkLh0RhhA",
			ImageURL:      "https://images.unsplash.com/photo-1566241142559-40e1dab266c6?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Single-Leg Romanian Deadlift (RDL)",
			Description:   "Buig vanuit je heupen, til één been recht naar achteren op terwijl je je romp laat zakken. Houd je rug recht.",
			HockeyBenefit: "Kracht in hamstrings en bilspieren, balans voor fasen waarbij je op één schaats staat.",
			VideoURL:      "https://www.youtube.com/watch?v=Gk74iYpI9S0",
			ImageURL:      "https://images.unsplash.com/photo-1526506114842-835ec7fb3d2f?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw, dbell, kbell},
		},
		{
			Name:          "Glute Bridges",
			Description:   "Ga op je rug liggen met gebogen knieën. Span je bilspieren aan en til je heupen richting het plafond. Houd dit kort vast.",
			HockeyBenefit: "Bilspieractivatie, belangrijk voor heupextensie tijdens het schaatsen.",
			VideoURL:      "https://www.youtube.com/watch?v=OUgsJ8-ViO8",
			ImageURL:      "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Russian Twists",
			Description:   "Zit met gebogen knieën en leun iets naar achteren. Draai je romp van links naar rechts, eventueel met een gewicht in je handen.",
			HockeyBenefit: "Roterende rompkracht.",
			VideoURL:      "https://www.youtube.com/watch?v=wkD8rjkodUI",
			ImageURL:      "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw, mball, dbell},
		},
		{
			Name:          "Pull-ups",
			Description:   "Hang aan een optrekstang met je handen iets breder dan schouderbreedte. Trek jezelf op totdat je kin boven de stang is, en laat je langzaam weer zakken.",
			HockeyBenefit: "Bovenrug- en grijpkracht, belangrijk voor puckbescherming en het winnen van fysieke duels.",
			VideoURL:      "https://www.youtube.com/watch?v=eGo4IYtlcy3",
			ImageURL:      "https://images.unsplash.com/photo-1540206276207-3af25c08abbb?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{getEq("Optrekstang")},
		},
		{
			Name:          "Dumbbell Rows",
			Description:   "Steun met één knie en hand op een bankje. Trek met je vrije hand een dumbbell richting je heup, houd je rug recht.",
			HockeyBenefit: "Unilaterale trekkracht, essentieel voor een sterke core en balans tijdens het schaatsen en vechten om de puck.",
			VideoURL:      "https://www.youtube.com/watch?v=pYcpY20QaE8",
			ImageURL:      "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{dbell},
		},
		{
			Name:          "Push-ups",
			Description:   "Start in een hoge plankpositie. Laat je lichaam zakken tot je borst bijna de vloer raakt, en duw jezelf krachtig weer omhoog.",
			HockeyBenefit: "Bovenlichaam duwkracht en core stabiliteit, helpt bij het afhouden van tegenstanders.",
			VideoURL:      "https://www.youtube.com/watch?v=IODxDxX7oi4",
			ImageURL:      "https://images.unsplash.com/photo-1599058917233-35f9933c000e?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Lunges",
			Description:   "Stap met één been naar voren en laat je heupen zakken totdat beide knieën in een hoek van 90 graden zijn. Duw jezelf terug naar de startpositie.",
			HockeyBenefit: "Unilaterale beenkracht en balans, belangrijk voor stabiliteit op het ijs.",
			VideoURL:      "https://www.youtube.com/watch?v=QOVaHwm-Q6U",
			ImageURL:      "https://images.unsplash.com/photo-1574680178050-55c6f6997ea6?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw, dbell},
		},
		{
			Name:          "Bicep Curls",
			Description:   "Houd een gewicht in elke hand met de handpalmen naar voren. Buig je ellebogen om de gewichten naar je schouders te brengen.",
			HockeyBenefit: "Armkracht, nuttig voor het vasthouden van je stick en face-offs.",
			VideoURL:      "https://www.youtube.com/watch?v=in7PaeYlhrM",
			ImageURL:      "https://images.unsplash.com/photo-1583454110551-21f2fa2adfcd?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{dbell, bands},
		},
		{
			Name:          "Deadbugs",
			Description:   "Ga op je rug liggen met je armen en benen omhoog. Laat langzaam de tegenovergestelde arm en het been zakken, net boven de vloer, en breng ze terug.",
			HockeyBenefit: "Diepe core-stabiliteit en anti-extensie, voorkomt rugblessures.",
			VideoURL:      "https://www.youtube.com/watch?v=4XkHbmeA3X4",
			ImageURL:      "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Burpees",
			Description:   "Begin staand, zak in een squatpositie, plaats je handen op de grond, spring met je voeten naar achteren in een plank, doe een push-up, spring terug en spring explosief in de lucht.",
			HockeyBenefit: "Volledige lichaamsconditie en explosiviteit, ideaal voor hoge hartslagen zoals tijdens een shift.",
			VideoURL:      "https://www.youtube.com/watch?v=dZgVxmi6cgI",
			ImageURL:      "https://images.unsplash.com/photo-1434682881908-b43d0467b798?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Overhead Press",
			Description:   "Houd gewichten op schouderhoogte en duw ze recht boven je hoofd totdat je armen volledig zijn gestrekt. Laat ze gecontroleerd zakken.",
			HockeyBenefit: "Schouderkracht en stabiliteit, belangrijk voor fysieke gevechten langs de boarding.",
			VideoURL:      "https://www.youtube.com/watch?v=B-aVuyhvLHU",
			ImageURL:      "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{dbell, kbell},
		},
		{
			Name:          "Jump Squats",
			Description:   "Maak een squat en spring zo explosief mogelijk omhoog. Land zachtjes en ga direct over in de volgende squat.",
			HockeyBenefit: "Maximale explosiviteit in het onderlichaam voor sprintvermogen.",
			VideoURL:      "https://www.youtube.com/watch?v=CVaEhXotL7M",
			ImageURL:      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Calf Raises",
			Description:   "Ga op de bal van je voeten staan en duw jezelf omhoog totdat je kuiten volledig aangespannen zijn. Laat langzaam zakken.",
			HockeyBenefit: "Kuitkracht, helpt bij de laatste fase van de afzet tijdens het schaatsen.",
			VideoURL:      "https://www.youtube.com/watch?v=gwLzBJYoWlI",
			ImageURL:      "https://images.unsplash.com/photo-1594381898411-846e7d193883?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw, dbell},
		},
		{
			Name:          "Tricep Dips",
			Description:   "Plaats je handen achter je op een bankje of stoel en strek je benen. Laat je lichaam zakken door je ellebogen te buigen tot 90 graden, en duw weer op.",
			HockeyBenefit: "Triceps kracht, ondersteunt push-bewegingen en schotkracht.",
			VideoURL:      "https://www.youtube.com/watch?v=0326dy_-CzM",
			ImageURL:      "https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Leg Raises",
			Description:   "Ga op je rug liggen en til je gestrekte benen langzaam op tot ze loodrecht op de vloer staan. Laat ze gecontroleerd zakken zonder de vloer aan te raken.",
			HockeyBenefit: "Versterkt de lage buikspieren, helpt bij algemene rompspanning.",
			VideoURL:      "https://www.youtube.com/watch?v=l4kQd9eFSfc",
			ImageURL:      "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
		{
			Name:          "Plank",
			Description:   "Steun op je onderarmen en tenen, en houd je lichaam in een rechte lijn als een plank. Span je buik- en bilspieren aan.",
			HockeyBenefit: "Fundamentele core-stabiliteit.",
			VideoURL:      "https://www.youtube.com/watch?v=ASdvN_XEl_c",
			ImageURL:      "https://images.unsplash.com/photo-1548690312-e3b507d17a47?auto=format&fit=crop&q=80&w=400&h=400",
			Equipment:     []models.Equipment{bw},
		},
	}

	db.Create(&exercises)
	log.Println("Database seeded successfully.")
}
