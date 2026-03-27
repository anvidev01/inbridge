package config

import (
	"os"

	"github.com/rs/zerolog/log"
)

type Config struct {
	Port                string
	DBURL               string
	RedisURL            string
	JWT_PrivateKey      string
	JWT_PublicKey       string
	UIDAI_API_URL       string
	DigiLockerClientID  string
	DigiLockerClientSec string
	PMKisanAPIKey       string
}

func LoadConfig() Config {
	cfg := Config{
		Port:                os.Getenv("PORT"), // typically 8080
		DBURL:               os.Getenv("DB_URL"),
		RedisURL:            os.Getenv("REDIS_URL"),
		JWT_PrivateKey:      os.Getenv("JWT_PRIVATE_KEY"),
		JWT_PublicKey:       os.Getenv("JWT_PUBLIC_KEY"),
		UIDAI_API_URL:       os.Getenv("UIDAI_API_URL"),
		DigiLockerClientID:  os.Getenv("DIGILOCKER_CLIENT_ID"),
		DigiLockerClientSec: os.Getenv("DIGILOCKER_CLIENT_SECRET"),
		PMKisanAPIKey:       os.Getenv("PM_KISAN_API_KEY"),
	}

	// Fails fast if required secrets are missing
	validate(cfg)

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	return cfg
}

func validate(c Config) {
	required := map[string]string{
		"DB_URL":                   c.DBURL,
		"REDIS_URL":                c.RedisURL,
		"JWT_PRIVATE_KEY":          c.JWT_PrivateKey,
		"JWT_PUBLIC_KEY":           c.JWT_PublicKey,
		"UIDAI_API_URL":            c.UIDAI_API_URL,
		"DIGILOCKER_CLIENT_ID":     c.DigiLockerClientID,
		"DIGILOCKER_CLIENT_SECRET": c.DigiLockerClientSec,
		"PM_KISAN_API_KEY":         c.PMKisanAPIKey,
	}

	for key, val := range required {
		if val == "" {
			log.Fatal().Msgf("Missing required environment variable: %s", key)
		}
	}
}
