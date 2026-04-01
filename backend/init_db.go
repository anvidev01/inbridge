package main

import (
	"context"
	"fmt"
	"os"

	"github.com/MeitY/inbridge-backend/config"
	"github.com/MeitY/inbridge-backend/db"
)

func main() {
	cfg := config.LoadConfig()
	if cfg.DBURL == "" {
		fmt.Println("Error: DB_URL environment variable is not set")
		os.Exit(1)
	}

	ctx := context.Background()
	pool, err := db.InitPostgres(ctx, cfg.DBURL)
	if err != nil {
		fmt.Printf("Error connecting to database: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()

	sqlFile := "db/init.sql"
	content, err := os.ReadFile(sqlFile)
	if err != nil {
		fmt.Printf("Error reading %s: %v\n", sqlFile)
		os.Exit(1)
	}

	fmt.Println("Applying database schema...")
	_, err = pool.Exec(ctx, string(content))
	if err != nil {
		fmt.Printf("Error executing schema: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("✅ Database schema initialized successfully!")
}
