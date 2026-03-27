FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 go build -a -installsuffix cgo -o /app/inbridge-api .

# Final stage
FROM alpine:latest
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

# Copy the binary
COPY --from=builder /app/inbridge-api /app/inbridge-api

# Expose port
EXPOSE 8080

# Command to run the executable
CMD ["/app/inbridge-api"]
