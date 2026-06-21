#!/bin/bash
# InBridge Local Development Startup Script
# Usage: ./dev.sh
#
# Starts: Postgres + Redis (via Docker), Go backend (:8080), Next.js frontend (:3000)
# Requires: Go 1.23+, Node.js 20+, Docker Desktop running

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting InBridge local dev environment..."

# --- Start Postgres & Redis via Docker ---
echo "🐳 Starting Postgres + Redis via Docker Compose..."
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker Desktop is not running. Please start Docker Desktop and try again."
  exit 1
fi

cd "$ROOT/infra" && docker-compose up -d postgres redis && cd "$ROOT"

echo "⏳ Waiting for Postgres and Redis to be ready..."
for i in {1..15}; do
  if nc -z localhost 5432 2>/dev/null && nc -z localhost 6379 2>/dev/null; then
    echo "✅ Postgres and Redis are ready"
    break
  fi
  sleep 1
  if [ $i -eq 15 ]; then
    echo "❌ Timed out waiting for DB/Redis. Check Docker logs."
    exit 1
  fi
done

# --- Kill any existing processes on used ports ---
kill_port() {
  local port=$1
  local pid
  pid=$(lsof -ti tcp:$port 2>/dev/null || true)
  if [ -n "$pid" ]; then
    echo "🛑 Killing existing process on port $port (PID $pid)"
    kill -9 $pid 2>/dev/null || true
    sleep 1
  fi
}

kill_port 8080
kill_port 3000

# --- Start Go Backend ---
echo ""
echo "🔧 Starting Go backend on :8080..."
cd "$ROOT/backend"
export DB_URL="postgres://inbridge:inbridge_secret@localhost:5432/inbridge_db?sslmode=disable"
export REDIS_URL="redis://:redis_secret@localhost:6379/0"
export PORT=8080
export CORS_ALLOWED_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://192.168.29.250:3000"

go run main.go > /tmp/inbridge-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

# Wait for backend to be ready
echo "   Waiting for backend to start..."
for i in {1..15}; do
  if curl -s http://localhost:8080/api/v1/health > /dev/null 2>&1; then
    echo "✅ Backend is ready"
    break
  fi
  sleep 1
  if [ $i -eq 15 ]; then
    echo "❌ Backend failed to start. Check logs above."
    exit 1
  fi
done

# --- Start Next.js Frontend ---
echo ""
echo "🎨 Starting Next.js frontend on :3000..."
cd "$ROOT"
export NEXT_PUBLIC_API_URL="http://localhost:8080"

# Source NVM if it exists
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  \. "$NVM_DIR/nvm.sh"
fi

npm run dev -- --port 3000 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

echo ""
echo "✅ InBridge dev environment is running!"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:8080"
echo "   Health:   http://localhost:8080/api/v1/health"
echo ""
echo "Press Ctrl+C to stop all services."

# Trap shutdown
cleanup() {
  echo ""
  echo "🛑 Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  echo "Done."
}
trap cleanup SIGINT SIGTERM

wait
