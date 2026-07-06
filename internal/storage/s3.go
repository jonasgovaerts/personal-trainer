// Package storage provides optional S3/MinIO-backed object storage for user uploads
// (progress photos). When the S3_* environment variables are not configured, the
// package stays disabled and callers should degrade gracefully.
package storage

import (
	"context"
	"io"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

var (
	client *minio.Client
	bucket string
)

// Enabled reports whether object storage is configured and ready.
func Enabled() bool { return client != nil }

// Init configures the MinIO/S3 client from the environment. It is a no-op (leaving
// storage disabled) when required variables are missing, so the app runs without it.
func Init() {
	endpoint := os.Getenv("S3_ENDPOINT")
	accessKey := os.Getenv("S3_ACCESS_KEY")
	secretKey := os.Getenv("S3_SECRET_KEY")
	bucket = os.Getenv("S3_BUCKET")
	useSSL := strings.EqualFold(os.Getenv("S3_USE_SSL"), "true")

	if endpoint == "" || accessKey == "" || secretKey == "" || bucket == "" {
		log.Println("INFO: S3/MinIO not configured; progress photos disabled")
		return
	}

	c, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure: useSSL,
	})
	if err != nil {
		log.Printf("WARN: S3/MinIO init failed, progress photos disabled: %v", err)
		return
	}

	// Ensure the bucket exists (best-effort).
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if exists, err := c.BucketExists(ctx, bucket); err == nil && !exists {
		if err := c.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			log.Printf("WARN: could not create bucket %q: %v", bucket, err)
		}
	}

	client = c
	log.Printf("INFO: S3/MinIO storage enabled (bucket=%s)", bucket)
}

// Put uploads an object and returns nil on success.
func Put(ctx context.Context, key string, r io.Reader, size int64, contentType string) error {
	_, err := client.PutObject(ctx, bucket, key, r, size, minio.PutObjectOptions{ContentType: contentType})
	return err
}

// Remove deletes an object.
func Remove(ctx context.Context, key string) error {
	return client.RemoveObject(ctx, bucket, key, minio.RemoveObjectOptions{})
}

// PresignedGetURL returns a temporary read URL for an object, valid for the given duration.
func PresignedGetURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	u, err := client.PresignedGetObject(ctx, bucket, key, expiry, url.Values{})
	if err != nil {
		return "", err
	}
	return u.String(), nil
}
