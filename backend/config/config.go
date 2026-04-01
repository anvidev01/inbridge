package config

import (
	"encoding/base64"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"github.com/rs/zerolog/log"
)

type Config struct {
	Port                string
	DBURL               string
	RedisURL            string
	JWT_PrivateKey      string
	JWT_PublicKey       string
	CORSAllowedOrigins string
	UIDAI_API_URL       string
	DigiLockerClientID  string
	DigiLockerClientSec string
	PMKisanAPIKey       string
}

func LoadConfig() Config {
	// Attempt to load .env from current dir or ../infra/
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../infra/.env")

	cfg := Config{
		Port:                os.Getenv("PORT"),
		DBURL:               os.Getenv("DB_URL"),
		RedisURL:            os.Getenv("REDIS_URL"),
		JWT_PrivateKey:      loadKey(os.Getenv("JWT_PRIVATE_KEY"), "keys/jwt.key"),
		JWT_PublicKey:       loadKey(os.Getenv("JWT_PUBLIC_KEY"), "keys/jwt.key.pub"),
		CORSAllowedOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),
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
	if cfg.CORSAllowedOrigins == "" {
		cfg.CORSAllowedOrigins = "http://localhost:3000"
	}

	return cfg
}

func loadKey(envVal, filePath string) string {
	// 1. Try reading from file first (most reliable)
	content, err := os.ReadFile(filePath)
	if err == nil {
		return string(content)
	}

	// 2. Fallback to env value
	if envVal != "" {
		trimmed := strings.Trim(envVal, "\"")
		trimmed = strings.TrimSpace(trimmed)
		
		// If it looks like a PEM block, return it (handle escaped \n)
		if strings.Contains(trimmed, "-----BEGIN") {
			return strings.ReplaceAll(trimmed, "\\n", "\n")
		}

		// Try Base64 decoding
		decoded, err := base64.StdEncoding.DecodeString(trimmed)
		if err == nil && strings.Contains(string(decoded), "-----BEGIN") {
			return string(decoded)
		}
	}

	return envVal
}

func decodeEnvVar(val string) string {
	if val == "" {
		return ""
	}

	// Strip surrounding quotes if present
	trimmed := strings.Trim(val, "\"")
	trimmed = strings.TrimSpace(trimmed)

	// Try Base64 decoding
	decoded, err := base64.StdEncoding.DecodeString(trimmed)
	if err == nil {
		str := string(decoded)
		prefix := str
		if len(prefix) > 40 {
			prefix = prefix[:40]
		}
		log.Debug().Int("len", len(decoded)).Str("prefix", prefix).Msg("Successfully decoded Base64 env var")
		return str
	}

	log.Debug().Err(err).Msg("Base64 decode failed, falling back to literal newline replacement")
	// Fallback: handle literal \n
	return strings.ReplaceAll(trimmed, "\\n", "\n")
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
