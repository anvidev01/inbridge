# InBridge Go Backend 🚀

The high-performance, production-hardened Go backend for the InBridge platform.

## 🛡️ Production Hardening
This backend has undergone a comprehensive security and performance audit:
- **Authentication**: JWT (RS256) using RSA 4096-bit key pair. No development bypasses.
- **Rate Limiting**: Redis-backed sliding window rate limiting on all authentication routes.
- **Audit Logging**: Mandatory audit trail for all write operations (Grievances, Applications).
- **Masking**: Automatic PII masking (Aadhaar/VID) in all API responses.
- **Graceful Shutdown**: Handles OS signals (`SIGTERM`, `SIGINT`) to close DB connections and finish active requests.

## 🏗️ Architecture
- **Router**: [chi v5](https://github.com/go-chi/chi) for lightweight, idiomatic routing.
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [pgx v5](https://github.com/jackc/pgx) connection pooling.
- **Cache/RL**: [Redis](https://redis.io/) via [go-redis v8](https://github.com/go-redis/redis).
- **Logging**: [zerolog](https://github.com/rs/zerolog) for structured JSON logging.

## 🚀 Getting Started

### 1. Environment Configuration
Copy `.env.example` to `.env` and fill in the required values.
```bash
cp .env.example .env
```

### 2. Generate RSA Keys (for JWT)
```bash
ssh-keygen -t rsa -b 4096 -m PEM -f jwt.key
openssl rsa -in jwt.key -pubout -outform PEM -out jwt.key.pub
```
Ensure the content of these keys (including `---BEGIN...`) is placed in your `.env` file under `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`. Use double quotes and escape newlines if necessary depending on your environment loader.

### 3. Run Locally
```bash
go run main.go
```

## 📑 API documentation (v1)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/register` | None | Citizen registration |
| POST | `/api/v1/auth/login` | None | Login & receive JWT |
| GET | `/api/v1/services` | None | List available government services |
| GET | `/api/v1/status/{arn}` | None | Track application by ARN |
| GET | `/api/v1/citizen/profile` | JWT | Get authenticated profile |
| POST | `/api/v1/services/apply` | JWT | Submit service application |
| POST | `/api/v1/grievance` | JWT | File a new grievance |
| GET | `/api/v1/health` | None | Liveness/Readiness check |

## 🛠️ Verification
Run the following to ensure everything is correct:
```bash
go vet ./...
go build ./...
```
