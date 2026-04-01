package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/MeitY/inbridge-backend/models"
	"github.com/rs/zerolog/log"
)

// STUB: UIDAI integration requires AUA/KUA license and ASP/KSA connectivity.
// Raw Aadhaar numbers MUST NOT be stored. Only VIDs/Tokens are permitted.

type UIDAIClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

func NewUIDAIClient(baseURL string) *UIDAIClient {
	return &UIDAIClient{
		BaseURL:    baseURL,
		HTTPClient: &http.Client{},
	}
}

// GenerateOTP simulates sending an OTP to the Aadhaar linked mobile number.
func (c *UIDAIClient) GenerateOTP(ctx context.Context, aadhaar string) error {
	log.Warn().Msg("UIDAI GenerateOTP is currently a STUB")
	
	payload := map[string]string{"aadhaar": aadhaar, "action": "generate_otp"}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/otp/generate", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// In production, real auth check would happen here.
	return nil
}

// VerifyOTPAndGetVID verifies an OTP and returns the VID.
// OTP '123456' is used for demonstration purposes ONLY and should be removed.
func (c *UIDAIClient) VerifyOTPAndGetVID(ctx context.Context, aadhaar, otp string) (string, error) {
	log.Warn().Msg("UIDAI VerifyOTPAndGetVID is currently a STUB with demonstration OTP")
	
	// DANGER: In production, never hardcode OTP values.
	if otp != "123456" {
		return "", fmt.Errorf("invalid OTP: UIDAI verification failed")
	}

	vid := models.TokenizeAadhaar(aadhaar)
	return vid, nil
}
