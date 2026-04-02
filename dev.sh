#!/bin/bash
# InBridge Local Development Startup Script
# Run this instead of Docker when developing locally.
# Requires: Go, Node.js, Postgres on :5432, Redis on :6379

set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 Starting InBridge local dev environment..."

# --- Check Postgres & Redis ---
echo "🔍 Checking Postgres on :5432..."
if ! nc -z localhost 5432 2>/dev/null; then
  echo "❌ Postgres is NOT running on :5432. Please start Docker Desktop or run postgres locally."
  exit 1
fi
echo "✅ Postgres is up"

echo "🔍 Checking Redis on :6379..."
if ! nc -z localhost 6379 2>/dev/null; then
  echo "❌ Redis is NOT running on :6379. Please start Docker Desktop."
  exit 1
fi
echo "✅ Redis is up"

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
export CORS_ALLOWED_ORIGINS="http://localhost:3000"

go run ./... &
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
