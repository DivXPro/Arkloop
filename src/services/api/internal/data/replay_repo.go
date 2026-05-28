package data

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type Replay struct {
	ID        uuid.UUID
	ThreadID  uuid.UUID
	AccountID uuid.UUID
	Title     *string
	CreatedAt time.Time
}

type ReplayMessage struct {
	ID          uuid.UUID
	ReplayID    uuid.UUID
	Role        string
	Content     string
	ContentJSON []byte
	CreatedAt   time.Time
	SortOrder   int
}

type ReplayNotFoundError struct {
	ReplayID uuid.UUID
}

func (e ReplayNotFoundError) Error() string {
	return fmt.Sprintf("replay %s not found", e.ReplayID)
}

type ReplayRepository struct {
	db DB
}

func NewReplayRepository(db DB) (*ReplayRepository, error) {
	if db == nil {
		return nil, errors.New("db must not be nil")
	}
	return &ReplayRepository{db: db}, nil
}

func (r *ReplayRepository) CreateReplay(
	ctx context.Context,
	threadID uuid.UUID,
	accountID uuid.UUID,
	title *string,
	messages []Message,
) (*Replay, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	replay := &Replay{
		ID:        uuid.New(),
		ThreadID:  threadID,
		AccountID: accountID,
		Title:     title,
		CreatedAt: time.Now(),
	}

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return nil, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`INSERT INTO replays (id, thread_id, account_id, title, created_at)
		 VALUES ($1, $2, $3, $4, $5)`,
		replay.ID, replay.ThreadID, replay.AccountID, replay.Title, replay.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert replay: %w", err)
	}

	for i, msg := range messages {
		_, err = tx.Exec(ctx,
			`INSERT INTO replay_messages (id, replay_id, role, content, content_json, created_at, sort_order)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			uuid.New(), replay.ID, msg.Role, msg.Content, msg.ContentJSON, msg.CreatedAt, i,
		)
		if err != nil {
			return nil, fmt.Errorf("insert replay message: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit transaction: %w", err)
	}

	return replay, nil
}

func (r *ReplayRepository) GetReplay(ctx context.Context, replayID uuid.UUID) (*Replay, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	var replay Replay
	err := r.db.QueryRow(ctx,
		`SELECT id, thread_id, account_id, title, created_at
		 FROM replays WHERE id = $1`,
		replayID,
	).Scan(&replay.ID, &replay.ThreadID, &replay.AccountID, &replay.Title, &replay.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ReplayNotFoundError{ReplayID: replayID}
		}
		return nil, fmt.Errorf("get replay: %w", err)
	}
	return &replay, nil
}

func (r *ReplayRepository) GetReplayMessages(ctx context.Context, replayID uuid.UUID) ([]ReplayMessage, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	rows, err := r.db.Query(ctx,
		`SELECT id, replay_id, role, content, content_json, created_at, sort_order
		 FROM replay_messages WHERE replay_id = $1 ORDER BY sort_order ASC`,
		replayID,
	)
	if err != nil {
		return nil, fmt.Errorf("get replay messages: %w", err)
	}
	defer rows.Close()

	var messages []ReplayMessage
	for rows.Next() {
		var msg ReplayMessage
		if err := rows.Scan(&msg.ID, &msg.ReplayID, &msg.Role, &msg.Content, &msg.ContentJSON, &msg.CreatedAt, &msg.SortOrder); err != nil {
			return nil, fmt.Errorf("scan replay message: %w", err)
		}
		messages = append(messages, msg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate replay messages: %w", err)
	}
	return messages, nil
}

func (r *ReplayRepository) DeleteReplay(ctx context.Context, replayID uuid.UUID) error {
	if ctx == nil {
		ctx = context.Background()
	}

	_, err := r.db.Exec(ctx,
		`DELETE FROM replays WHERE id = $1`,
		replayID,
	)
	if err != nil {
		return fmt.Errorf("delete replay: %w", err)
	}
	return nil
}

func (r *ReplayRepository) ListReplaysByThread(ctx context.Context, threadID uuid.UUID) ([]Replay, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	rows, err := r.db.Query(ctx,
		`SELECT id, thread_id, account_id, title, created_at
		 FROM replays WHERE thread_id = $1 ORDER BY created_at DESC`,
		threadID,
	)
	if err != nil {
		return nil, fmt.Errorf("list replays: %w", err)
	}
	defer rows.Close()

	var replays []Replay
	for rows.Next() {
		var r Replay
		if err := rows.Scan(&r.ID, &r.ThreadID, &r.AccountID, &r.Title, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan replay: %w", err)
		}
		replays = append(replays, r)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate replays: %w", err)
	}
	return replays, nil
}
