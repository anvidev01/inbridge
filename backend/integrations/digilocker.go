package integrations

import (
	"context"
	"fmt"
	"net/http"

	"github.com/rs/zerolog/log"
)

// STUB: DigiLocker integration requires OAuth2 client credentials and specific scope approval.
// See: https://partners.digitallocker.gov.in/resource/api-v2

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
	log.Warn().Msg("DigiLocker FetchDocument is currently a STUB")
	
	// Actual implementation would look like:
	/*
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.digitallocker.gov.in/public/v2/file/"+docURI, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	// ... rest of the call
	*/
	
	return nil, fmt.Errorf("digilocker integration not yet configured")
}
