package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/MeitY/inbridge-backend/models"
)

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

// GenerateOTP simulates sending an OTP to the Aadhar linked mobile number
func (c *UIDAIClient) GenerateOTP(ctx context.Context, aadhaar string) error {
	payload := map[string]string{"aadhaar": aadhaar, "action": "generate_otp"}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+"/otp/generate", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Mock bypass: return nil
	// resp, err := c.HTTPClient.Do(req)
	return nil
}

// VerifyOTPAndGetVID verifies an OTP and returns the VID (Never store raw Aadhaar)
func (c *UIDAIClient) VerifyOTPAndGetVID(ctx context.Context, aadhaar, otp string) (string, error) {
	if otp != "123456" {
		return "", fmt.Errorf("invalid OTP")
	}

	vid := models.TokenizeAadhaar(aadhaar)
	return vid, nil
}
