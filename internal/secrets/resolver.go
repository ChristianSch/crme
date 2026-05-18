package secrets

import (
	"context"
	"fmt"
	"strings"

	"crme/internal/domain"
	"crme/internal/ports"
)

type RuntimeResolver struct {
	Store ports.RuntimeSecretStore
	Box   *Box
}

func (r RuntimeResolver) Resolve(ctx context.Context, ref string) (string, error) {
	id, ok := strings.CutPrefix(ref, "runtime_secret:")
	if !ok || id == "" {
		return "", fmt.Errorf("unsupported secret ref %q", ref)
	}
	if r.Store == nil || r.Box == nil {
		return "", fmt.Errorf("runtime secret resolver is not configured")
	}
	scope, name, ciphertext, nonce, err := r.Store.GetRuntimeSecret(ctx, domain.ID(id))
	if err != nil {
		return "", err
	}
	return r.Box.Decrypt(ciphertext, nonce, []byte(scope+":"+name))
}
