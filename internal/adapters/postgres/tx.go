package postgres

import (
	"context"

	"crme/internal/ports"
)

func (s *Store) WithinTx(ctx context.Context, fn func(stores ports.Stores) error) error {
	tx, err := s.begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	txStore := &Store{pool: s.pool, tx: tx}
	stores := ports.Stores{
		People:        txStore,
		Companies:     txStore,
		Deals:         txStore,
		Relationships: txStore,
		Activities:    txStore,
		Tags:          txStore,
		Workspaces:    txStore,
		Search:        txStore,
		Todos:         txStore,
		Prompts:       txStore,
		EmailAccounts: txStore,
		EmailMessages: txStore,
	}
	if err := fn(stores); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
