package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
)

type BhashiniClient struct {
	APIKey     string
	HTTPClient *http.Client
}

func NewBhashiniClient(apiKey string) *BhashiniClient {
	return &BhashiniClient{
		APIKey:     apiKey,
		HTTPClient: &http.Client{},
	}
}

func (b *BhashiniClient) Translate(ctx context.Context, text, sourceLang, targetLang string) (string, error) {
	payload := map[string]interface{}{
		"pipelineTasks": []map[string]interface{}{
			{
				"taskType": "translation",
				"config": map[string]interface{}{
					"language": map[string]string{
						"sourceLanguage": sourceLang,
						"targetLanguage": targetLang,
					},
				},
			},
		},
		"inputData": map[string]interface{}{
			"input": []map[string]string{
				{"source": text},
			},
		},
	}

	body, _ := json.Marshal(payload)
	req, _ := http.NewRequestWithContext(ctx, "POST", "https://bhashini.gov.in/api/pipeline", bytes.NewBuffer(body))
	req.Header.Set("Authorization", b.APIKey)
	req.Header.Set("Content-Type", "application/json")

	// resp, _ := b.HTTPClient.Do(req)
	// io.ReadAll(resp.Body)
	_ = body // Suppress unused var
	_ = req
	_ = io.ReadAll

	return "Translated Text Mock", nil
}
