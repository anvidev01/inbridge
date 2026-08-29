# ── Build stage ───────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk --no-cache add ca-certificates git

# Cache dependency layer separately from source
COPY go.mod go.sum ./
RUN go mod download

# Copy source
COPY . .

# Statically linked binary — no libc dependency in the final image
RUN CGO_ENABLED=0 GOOS=linux go build \
    -a -installsuffix cgo \
    -ldflags="-s -w" \
    -o /app/inbridge-api .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the binary
COPY --from=builder /app/inbridge-api /app/inbridge-api

# Create keys directory. On Railway/production, JWT keys come from env vars
# (JWT_PRIVATE_KEY / JWT_PUBLIC_KEY). The keys/ directory is gitignored and
# is only used as a local fallback via config.loadKey().
RUN mkdir -p /app/keys

EXPOSE 8080

CMD ["/app/inbridge-api"]
