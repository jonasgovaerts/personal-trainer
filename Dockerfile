# Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build

# Build Backend
FROM golang:1.26-alpine AS backend-builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Final stage
FROM alpine:latest
WORKDIR /root/
# Copy binary
COPY --from=backend-builder /app/server .
# Copy built frontend from frontend-builder
COPY --from=frontend-builder /frontend/dist ./static

EXPOSE 8080
CMD ["./server"]
