package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"strings"
)

type Box struct {
	gcm cipher.AEAD
}

func NewBox(base64Key string) (*Box, error) {
	base64Key = strings.TrimSpace(base64Key)
	base64Key = strings.Trim(base64Key, `"'`)
	if base64Key == "" {
		return nil, fmt.Errorf("CRME_SECRET_KEY is required to store runtime secrets")
	}
	key, err := base64.StdEncoding.DecodeString(base64Key)
	if err != nil {
		return nil, fmt.Errorf("decode CRME_SECRET_KEY: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("CRME_SECRET_KEY must decode to 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Box{gcm: gcm}, nil
}

func (b *Box) Encrypt(plaintext string, aad []byte) (ciphertext, nonce []byte, err error) {
	nonce = make([]byte, b.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	return b.gcm.Seal(nil, nonce, []byte(plaintext), aad), nonce, nil
}

func (b *Box) Decrypt(ciphertext, nonce, aad []byte) (string, error) {
	plaintext, err := b.gcm.Open(nil, nonce, ciphertext, aad)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
