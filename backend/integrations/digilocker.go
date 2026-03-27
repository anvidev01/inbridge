package integrations

import (
	"context"
	"net/http"
)

type DigiLockerClient struct {
	ClientID     string
	ClientSecret string
	HTTPClient   *http.Client
}

func NewDigiLockerClient(id, secret string) *DigiLockerClient {
	return &DigiLockerClient{
		ClientID:     id,
		ClientSecret: secret,
		HTTPClient:   &http.Client{},
	}
}

func (d *DigiLockerClient) FetchDocument(ctx context.Context, accessToken, docURI string) ([]byte, error) {
	// req, _ := http.NewRequestWithContext(ctx, "GET", "https://api.digitallocker.gov.in/.../"+docURI, nil)
	return []byte("document_content_mock"), nil
}
