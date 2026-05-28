package conversationapi

import (
	"encoding/json"
	"errors"
	"strings"
	"time"

	nethttp "net/http"

	"arkloop/services/api/internal/audit"
	"arkloop/services/api/internal/auth"
	"arkloop/services/api/internal/data"
	"arkloop/services/api/internal/http/httpkit"
	"arkloop/services/api/internal/observability"

	"github.com/google/uuid"
)

type createReplayRequest struct {
	ThreadID uuid.UUID `json:"thread_id"`
}

type createReplayResponse struct {
	ID        string  `json:"id"`
	ThreadID  string  `json:"thread_id"`
	Title     *string `json:"title,omitempty"`
	CreatedAt string  `json:"created_at"`
}

type replayMessageItem struct {
	ID          string          `json:"id"`
	Role        string          `json:"role"`
	Content     string          `json:"content"`
	ContentJSON json.RawMessage `json:"content_json,omitempty"`
	CreatedAt   string          `json:"created_at"`
}

type getReplayResponse struct {
	ID       string              `json:"id"`
	Title    *string             `json:"title,omitempty"`
	Messages []replayMessageItem `json:"messages"`
}

func replaysEntry(
	authService *auth.Service,
	membershipRepo *data.AccountMembershipRepository,
	threadRepo *data.ThreadRepository,
	messageRepo *data.MessageRepository,
	replayRepo *data.ReplayRepository,
	apiKeysRepo *data.APIKeysRepository,
	auditWriter *audit.Writer,
) func(nethttp.ResponseWriter, *nethttp.Request) {
	return func(w nethttp.ResponseWriter, r *nethttp.Request) {
		traceID := observability.TraceIDFromContext(r.Context())

		tail := strings.TrimPrefix(r.URL.Path, "/v1/replays")
		tail = strings.Trim(tail, "/")

		// POST /v1/replays — 创建 replay
		if tail == "" && r.Method == nethttp.MethodPost {
			createReplay(w, r, traceID, authService, membershipRepo, threadRepo, messageRepo, replayRepo, apiKeysRepo, auditWriter)
			return
		}

		// GET /v1/replays/{replayID} — 获取 replay
		if tail != "" && r.Method == nethttp.MethodGet {
			replayID, err := uuid.Parse(tail)
			if err != nil {
				httpkit.WriteError(w, nethttp.StatusUnprocessableEntity, "validation.error", "invalid replay id", traceID, nil)
				return
			}
			getReplay(w, r, traceID, replayID, replayRepo)
			return
		}

		httpkit.WriteMethodNotAllowed(w, r)
	}
}

func createReplay(
	w nethttp.ResponseWriter,
	r *nethttp.Request,
	traceID string,
	authService *auth.Service,
	membershipRepo *data.AccountMembershipRepository,
	threadRepo *data.ThreadRepository,
	messageRepo *data.MessageRepository,
	replayRepo *data.ReplayRepository,
	apiKeysRepo *data.APIKeysRepository,
	auditWriter *audit.Writer,
) {
	if authService == nil {
		httpkit.WriteAuthNotConfigured(w, traceID)
		return
	}

	actor, ok := httpkit.ResolveActor(w, r, traceID, authService, membershipRepo, apiKeysRepo, auditWriter)
	if !ok {
		return
	}

	var req createReplayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpkit.WriteError(w, nethttp.StatusBadRequest, "request.invalid", "invalid request body", traceID, nil)
		return
	}

	if req.ThreadID == uuid.Nil {
		httpkit.WriteError(w, nethttp.StatusUnprocessableEntity, "validation.error", "thread_id is required", traceID, nil)
		return
	}

	thread, err := threadRepo.GetByID(r.Context(), req.ThreadID)
	if err != nil {
		httpkit.WriteError(w, nethttp.StatusInternalServerError, "server.error", "failed to get thread", traceID, err)
		return
	}

	if thread == nil {
		httpkit.WriteError(w, nethttp.StatusNotFound, "threads.not_found", "thread not found", traceID, nil)
		return
	}

	if !authorizeThreadOrAudit(w, r, traceID, actor, "threads.replay", thread, auditWriter) {
		return
	}

	messages, err := messageRepo.ListByThread(r.Context(), thread.AccountID, thread.ID, 10000)
	if err != nil {
		httpkit.WriteError(w, nethttp.StatusInternalServerError, "server.error", "failed to list messages", traceID, err)
		return
	}

	replay, err := replayRepo.CreateReplay(r.Context(), req.ThreadID, thread.AccountID, thread.Title, messages)
	if err != nil {
		httpkit.WriteError(w, nethttp.StatusInternalServerError, "server.error", "failed to create replay", traceID, err)
		return
	}

	resp := createReplayResponse{
		ID:        replay.ID.String(),
		ThreadID:  replay.ThreadID.String(),
		Title:     replay.Title,
		CreatedAt: replay.CreatedAt.Format(time.RFC3339),
	}

	httpkit.WriteJSON(w, traceID, nethttp.StatusCreated, resp)
}

func getReplay(
	w nethttp.ResponseWriter,
	r *nethttp.Request,
	traceID string,
	replayID uuid.UUID,
	replayRepo *data.ReplayRepository,
) {
	replay, err := replayRepo.GetReplay(r.Context(), replayID)
	if err != nil {
		var notFound data.ReplayNotFoundError
		if errors.As(err, &notFound) {
			httpkit.WriteError(w, nethttp.StatusNotFound, "replays.not_found", "replay not found", traceID, nil)
			return
		}
		httpkit.WriteError(w, nethttp.StatusInternalServerError, "server.error", "failed to get replay", traceID, err)
		return
	}

	messages, err := replayRepo.GetReplayMessages(r.Context(), replayID)
	if err != nil {
		httpkit.WriteError(w, nethttp.StatusInternalServerError, "server.error", "failed to get replay messages", traceID, err)
		return
	}

	resp := getReplayResponse{
		ID:       replay.ID.String(),
		Title:    replay.Title,
		Messages: make([]replayMessageItem, 0, len(messages)),
	}

	for _, msg := range messages {
		item := replayMessageItem{
			ID:        msg.ID.String(),
			Role:      msg.Role,
			Content:   msg.Content,
			CreatedAt: msg.CreatedAt.Format(time.RFC3339),
		}
		if len(msg.ContentJSON) > 0 {
			item.ContentJSON = msg.ContentJSON
		}
		resp.Messages = append(resp.Messages, item)
	}

	httpkit.WriteJSON(w, traceID, nethttp.StatusOK, resp)
}
