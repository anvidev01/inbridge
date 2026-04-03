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
		// Trim quotes safely
		val := strings.Trim(envVal, "\"'` \t\r\n")

		// Flow 1: Base64-encoded PEM
		// If it's missing the BEGIN header, maybe it's just raw Base64.
		if !strings.Contains(val, "-----BEGIN") {
			base64Clean := strings.ReplaceAll(val, "\n", "")
			base64Clean = strings.ReplaceAll(base64Clean, "\r", "")
			base64Clean = strings.ReplaceAll(base64Clean, " ", "")
			decoded, err := base64.StdEncoding.DecodeString(base64Clean)
			if err == nil && strings.Contains(string(decoded), "-----BEGIN") {
				val = string(decoded)
			}
		}

		// Flow 2 & 3: Literal \n escapes or pre-formatted multiline
		if strings.Contains(val, "-----BEGIN") {
			// Convert litreal \n or \r to actual newlines
			val = strings.ReplaceAll(val, "\\n", "\n")
			val = strings.ReplaceAll(val, "\\r", "")

			// Failsafe for extreme space-collapsed PEMs
			if !strings.Contains(val, "\n") && strings.Contains(val, " -----END") {
				val = strings.Replace(val, "-----BEGIN RSA PRIVATE KEY----- ", "-----BEGIN RSA PRIVATE KEY-----\n", 1)
				val = strings.Replace(val, "-----BEGIN PRIVATE KEY----- ", "-----BEGIN PRIVATE KEY-----\n", 1)
				val = strings.Replace(val, "-----BEGIN PUBLIC KEY----- ", "-----BEGIN PUBLIC KEY-----\n", 1)
				val = strings.Replace(val, " -----END RSA PRIVATE KEY-----", "\n-----END RSA PRIVATE KEY-----", 1)
				val = strings.Replace(val, " -----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----", 1)
				val = strings.Replace(val, " -----END PUBLIC KEY-----", "\n-----END PUBLIC KEY-----", 1)

				lines := strings.Split(val, "\n")
				if len(lines) == 3 {
					body := strings.ReplaceAll(lines[1], " ", "") // remove spaces from the base64 part
					val = lines[0] + "\n" + body + "\n" + lines[2]
				}
			}

			// Final trim
			val = strings.TrimSpace(val)
			
			// Header Validation Check
			if !strings.HasPrefix(val, "-----BEGIN RSA PRIVATE KEY-----") && 
			   !strings.HasPrefix(val, "-----BEGIN PRIVATE KEY-----") &&
			   !strings.HasPrefix(val, "-----BEGIN PUBLIC KEY-----") {
				log.Warn().Str("prefix", val).Msg("Key contains 'BEGIN' but its prefix does not exactly match standard PKCS1/PKCS8 boundaries")
			}

			return val
		}
		
		return val
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
