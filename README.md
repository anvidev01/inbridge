# InBridge — Integrated Government Digital Services Platform 🇮🇳

> **Public service at the speed of life.** A GIGW 3.0 & WCAG 2.2 AA compliant
> government AI answer engine for 1.4 billion citizens — built with Next.js, Go, PostgreSQL, and Redis.

[![Build](https://img.shields.io/badge/build-passing-2E7D32?style=flat-square)](https://github.com/anvidev01/InBridge-)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8?style=flat-square&logo=go)](https://go.dev/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![WCAG](https://img.shields.io/badge/WCAG-2.2%20AA-1A237E?style=flat-square)](https://www.w3.org/WAI/WCAG22/quickref/)
[![GIGW](https://img.shields.io/badge/GIGW-3.0-1A237E?style=flat-square)](https://guidelines.india.gov.in/)
[![DPDP](https://img.shields.io/badge/DPDP%20Act-2023-C62828?style=flat-square)](https://www.meity.gov.in/data-protection-framework)
[![License](https://img.shields.io/badge/license-MIT-616161?style=flat-square)](./LICENSE)

---

## ✨ What is InBridge?

InBridge is a **production-grade, full-stack government digital services platform** that consolidates 100+ citizen services — Aadhaar, PAN, Passport, Ration Card, ITR, PM-KISAN, RTI and more — behind a single, accessible AI-powered portal.

**Key capabilities:**
- 🤖 **AI Answer Engine** — Perplexity-style interface powered by Groq (Llama-3) with government-source citations
- 🔐 **Secure Authentication** — RS256 JWT auth with bcrypt password hashing, Redis-backed rate limiting
- 🗄️ **Real Database** — PostgreSQL (pgvector) with full citizen, grievance & application schema
- 🌐 **Multilingual** — 11 Indian languages via Bhashini API
- ♿ **Accessible** — WCAG 2.2 AA, GIGW 3.0, DPDP Act 2023 compliant

Designed for **ALL** Indian citizens:
- 🧓 Elderly users with larger touch targets and clear fonts
- 📵 Rural users with voice input (Web Speech API) and offline-friendly design
- ♿ Differently-abled users with full screen-reader and keyboard support
- 🔤 Low-literacy users with bilingual UI (Hindi + English + 9 regional languages)

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         InBridge Platform                       │
├───────────────────┬─────────────────────┬───────────────────────┤
│   Next.js 15      │    Go API (Chi)      │   Python AI Service   │
│   (Frontend)      │    Port :8080        │   (FastAPI) Port:8000 │
│   Port :3000      │                     │                       │
│                   │  ┌───────────────┐  │  ┌─────────────────┐  │
│  • Chat UI        │  │ Auth Handler   │  │  │ Groq LLM        │  │
│  • Login Modal    │  │ RS256 JWT      │  │  │ RAG Pipeline    │  │
│  • Source Cards   │  │ bcrypt hash    │  │  │ PII Guardrails  │  │
│  • Grievances     │  ├───────────────┤  │  │ Bhashini TTS    │  │
│                   │  │ Rate Limiter   │  │  └─────────────────┘  │
│                   │  │ (Redis backed) │  │                       │
│                   │  ├───────────────┤  │                       │
│                   │  │ Audit Logging  │  │                       │
│                   │  └───────────────┘  │                       │
└───────────────────┴──────────┬──────────┴───────────────────────┘
                               │
              ┌────────────────┴────────────────┐
              │          Data Layer              │
              ├─────────────────┬────────────────┤
              │  PostgreSQL 16  │   Redis 7      │
              │  (pgvector)     │   (Sessions)   │
              └─────────────────┴────────────────┘
```

---

## 🗂️ Project Structure

```
infosetu-chatbot/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── chat/                 # Main chat interface
│   │   └── api/chat/             # AI chatbot API route
│   └── components/
│       └── chat/
│           ├── ChatShell.tsx     # Main app shell + auth state
│           ├── ChatWindow.tsx    # Message rendering
│           ├── ChatInput.tsx     # Query input + voice
│           ├── LoginModal.tsx    # Auth (login / signup) modal
│           └── SourceCard.tsx    # Government citation cards
│
├── backend/                      # Go API server
│   ├── main.go                   # Router, middleware wiring, server start
│   ├── config/
│   │   └── config.go             # Env + RSA key loader
│   ├── handlers/
│   │   ├── auth.go               # Register + Login (bcrypt + RS256 JWT)
│   │   ├── citizen.go            # Profile get/update
│   │   ├── grievance.go          # Create + get grievances (DB-backed)
│   │   ├── services.go           # Service catalogue + application
│   │   ├── status.go             # Application ARN status
│   │   └── health.go             # Postgres + Redis health check
│   ├── middleware/
│   │   ├── auth.go               # JWT verification middleware
│   │   ├── cors.go               # CORS middleware
│   │   ├── rate_limit.go         # Redis-backed rate limiter
│   │   ├── audit.go              # Audit trail for write ops
│   │   └── masking.go            # PII masking in responses
│   ├── models/
│   │   └── citizen.go            # Citizen model + bcrypt helpers
│   ├── db/
│   │   ├── init.sql              # DB initialization
│   │   └── migrations/           # SQL migration files (001–005)
│   ├── integrations/
│   │   ├── uidai.go              # UIDAI / Aadhaar (stub)
│   │   ├── digilocker.go         # DigiLocker (stub)
│   │   ├── bhashini.go           # Bhashini translation (stub)
│   │   └── pmkisan.go            # PM-KISAN API (stub)
│   ├── keys/                     # RSA key pair (gitignored)
│   │   ├── private.pem
│   │   └── public.pem
│   ├── Dockerfile
│   └── go.mod
│
├── infra/
│   ├── docker-compose.yml        # Full stack orchestration
│   ├── .env                      # Infrastructure secrets (gitignored)
│   └── .env.example              # Safe template
│
├── dev.sh                        # One-command local dev startup
├── Dockerfile.frontend           # Multi-stage Next.js production build
└── README.md
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript 5, Tailwind CSS v4 |
| **Backend** | Go 1.23, Chi router, zerolog |
| **Auth** | RS256 JWT (4096-bit RSA), bcrypt (cost 12) |
| **Database** | PostgreSQL 16 + pgvector extension |
| **Cache / Rate Limiting** | Redis 7 |
| **AI / LLM** | Groq Cloud (Llama-3.3-70b-versatile) |
| **AI Service** | Python FastAPI, LangChain, Faiss |
| **Infrastructure** | Docker + Docker Compose |
| **Fonts** | Inter (Google Fonts) |
| **Icons** | Inline SVG (zero external deps) |

---

## ⚡ Quick Start

### Prerequisites

| Tool | Min Version | Notes |
|------|-----------|-------|
| **Go** | 1.23 | `brew install go` |
| **Node.js** | 20 | `brew install node` |
| **Docker Desktop** | Latest | Runs Postgres + Redis |

---

### Option A — One Command (Recommended)

```bash
# 1. Clone
git clone https://github.com/anvidev01/InBridge-.git
cd InBridge-

# 2. Start Postgres + Redis via Docker
cd infra && docker-compose up -d postgres redis && cd ..

# 3. Start everything (backend on :8080, frontend on :3000)
./dev.sh
```

> Open **http://localhost:3000** — done! ✅

---

### Option B — Full Docker Stack

Runs all 5 services (Postgres, Redis, Go API, Next.js, Python AI) in Docker:

```bash
cd infra
cp .env.example .env           # Edit secrets if needed
docker-compose up -d --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Go API | http://localhost:8080 |
| AI Service | http://localhost:8000 |
| Health Check | http://localhost:8080/api/v1/health |

---

### Option C — Manual (step by step)

#### Step 1 — Start Postgres & Redis

```bash
cd infra
docker-compose up -d postgres redis
```

#### Step 2 — Start Go Backend

```bash
cd backend
export DB_URL="postgres://inbridge:inbridge_secret@localhost:5432/inbridge_db?sslmode=disable"
export REDIS_URL="redis://:redis_secret@localhost:6379/0"
export PORT=8080
export CORS_ALLOWED_ORIGINS="http://localhost:3000"
go run main.go
```

#### Step 3 — Start Next.js Frontend

```bash
# In a new terminal, from project root:
NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev
```

#### Step 4 — Verify

```bash
curl http://localhost:8080/api/v1/health
# Expected: {"status":"ok","services":{"postgres":"up","redis":"up"}}
```

---

## 🔐 Authentication

InBridge uses **RS256 JWT** (4096-bit RSA key pair) for stateless authentication.

### Registration

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "full_name": "Anvi Singh",
  "email": "anvi@example.com",
  "password": "SecurePass123!",
  "vid": "VID-ABC1234",
  "date_of_birth": "1998-07-15",
  "gender": "Female",
  "state": "Delhi",
  "district": "New Delhi"
}
```

**Response (201)**:
```json
{
  "message": "registration successful",
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "citizen": {
    "id": "uuid",
    "full_name": "Anvi Singh",
    "email": "anvi@example.com"
  }
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "anvi@example.com",
  "password": "SecurePass123!"
}
```

**Response (200)**:
```json
{
  "token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

All tokens expire after **24 hours**. Protected routes require:
```
Authorization: Bearer <token>
```

---

## 📡 API Reference

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Postgres + Redis health check |
| `POST` | `/api/v1/auth/register` | Register new citizen |
| `POST` | `/api/v1/auth/login` | Login, returns JWT |

### Protected Endpoints (require Bearer token)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/citizen/profile` | Get current user profile |
| `PUT` | `/api/v1/citizen/profile` | Update profile |
| `POST` | `/api/v1/grievance` | File a grievance |
| `GET` | `/api/v1/grievance/{id}` | Get grievance by ID |
| `GET` | `/api/v1/services` | List available government services |
| `POST` | `/api/v1/services/apply` | Apply for a service |
| `GET` | `/api/v1/status/{arn}` | Get application status by ARN |

---

## 🗄️ Database Schema

Key tables in PostgreSQL:

```sql
-- Citizens (users)
citizens (id, vid, full_name, email, password_hash, date_of_birth,
          gender, state, district, created_at, updated_at)

-- Service Applications
applications (id, citizen_id, service_code, arn, status,
              submitted_at, updated_at, metadata jsonb)

-- Grievances
grievances (id, citizen_id, subject, description, status,
            created_at, updated_at)

-- AI Chat Sessions
chat_sessions (id, citizen_id, created_at)
chat_messages (id, session_id, role, content, created_at)

-- Audit Log
audit_log (id, citizen_id, action, entity, entity_id, ip_addr, created_at)
```

---

## 🔑 Environment Variables

### Backend (`infra/.env` or shell exports)

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection string | — |
| `PORT` | API server port | `8080` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000` |
| `JWT_PRIVATE_KEY` | Base64-encoded RSA private key PEM | — |
| `JWT_PUBLIC_KEY` | Base64-encoded RSA public key PEM | — |
| `UIDAI_API_URL` | UIDAI OTP verification endpoint | — |
| `DIGILOCKER_CLIENT_ID` | DigiLocker OAuth client ID | — |
| `DIGILOCKER_CLIENT_SECRET` | DigiLocker OAuth secret | — |
| `PM_KISAN_API_KEY` | PM-KISAN beneficiary API key | — |
| `OPENAI_API_KEY` | OpenAI key (optional, for AI service) | — |
| `GROQ_API_KEY` | Groq API key (for LLM inference) | — |

### Frontend

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Go API base URL (must be reachable by browser) | `http://localhost:8080` |

> ⚠️ **Important**: `NEXT_PUBLIC_API_URL` must be the URL your **browser** can reach, not a Docker-internal hostname like `go-api:8080`.

---

## 🔒 Security

| Feature | Implementation |
|---------|----------------|
| **Password Hashing** | bcrypt (cost 12) |
| **JWT Signing** | RS256 — 4096-bit RSA key pair |
| **Rate Limiting** | Redis sliding window — 20 req / 1 min on auth routes |
| **CORS** | Strict allowlist via `CORS_ALLOWED_ORIGINS` |
| **Audit Trail** | All write operations logged with citizen ID + IP |
| **PII Masking** | Response middleware strips sensitive fields |
| **Input Validation** | Required field checks on all auth endpoints |

---

## 🚀 Features

### AI Answer Engine
- **Perplexity-style interface** — search-first dark UI with source citations
- **Groq Cloud** (Llama-3.3-70b-versatile) for sub-second LLM inference
- **Agentic RAG** — Faiss vector store + Tavily web search for live government data
- **PII Guardrails** — Strict content filtering before LLM context
- **Multilingual** — 11 Indian languages via Bhashini API

### Government Compliance
- **GIGW 3.0** — State Emblem, Ministry branding, mandatory footer links
- **WCAG 2.2 Level AA** — Skip links, `aria-live` regions, keyboard navigation
- **DPDP Act 2023** — Explicit opt-in cookie consent, data minimisation
- **Rights of Persons with Disabilities Act 2016** — Full screen-reader support

### Citizen Services
- Multi-step application form (Aadhaar, PAN, Passport, Ration Card, ITR, PM-KISAN, RTI)
- ARN-based application status tracking
- Grievance filing and tracking
- Bilingual search (Hindi + English)

---

## 🐛 Troubleshooting

### "Failed to fetch" on signup
**Cause**: Backend is not running or `NEXT_PUBLIC_API_URL` is incorrect.

```bash
# 1. Verify backend is running
curl http://localhost:8080/api/v1/health

# 2. If not running, start it
./dev.sh

# 3. Verify the env var in your shell
echo $NEXT_PUBLIC_API_URL   # Should be http://localhost:8080
```

### Docker daemon not running
Open **Docker Desktop** from Applications, wait for it to fully start, then run:
```bash
cd infra && docker-compose up -d postgres redis
```

### Database connection refused
```bash
# Check if Postgres is up
nc -zv localhost 5432

# Start just the DB containers
cd infra && docker-compose up -d postgres redis
```

### Port already in use
```bash
# Kill whatever is on the port
lsof -ti :8080 | xargs kill -9
lsof -ti :3000 | xargs kill -9
```

---

## 📋 Roadmap

- [ ] DigiLocker OAuth integration for document auto-fill
- [ ] Real UIDAI OTP verification
- [ ] MSG91 SMS + email confirmation on application submit
- [ ] Bhashini API live translation (replace static language toggle)
- [ ] PWA / offline support for rural connectivity
- [ ] Admin dashboard for grievance management
- [ ] reCAPTCHA on auth routes
- [ ] Python AI service pgvector embeddings for semantic search

---

## 🤝 Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting pull requests.

---

## 📄 License

MIT © 2026 [anvidev01](https://github.com/anvidev01) — Built for MeitY / Government of India

---

*InBridge — सरकारी सेवाएं, एक जगह।*
*Information bridge — Government services, all in one place.*
