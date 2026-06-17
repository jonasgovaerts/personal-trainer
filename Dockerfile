# Build Frontend
# Using BUILDPLATFORM ensures this runs on the native host (AMD64)
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Build Backend
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS backend-builder
WORKDIR /app

# Export the target architecture (e.g. arm64 or amd64)
ARG TARGETARCH

# Install git to extract commit message
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Extract commit message
RUN git log -1 --pretty=%B > commit.txt

# Cross-compile the Go binary using the TARGETARCH
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -o server ./cmd/server

# Final stage
# This will be the target platform image
FROM alpine:latest
WORKDIR /root/
# Copy binary
COPY --from=backend-builder /app/server .
# Copy commit message
COPY --from=backend-builder /app/commit.txt .
# Copy built frontend from frontend-builder
COPY --from=frontend-builder /frontend/dist ./static

EXPOSE 8080
CMD ["./server"]
