# Meta AI provider (ADIM 20)

## Endpoint and model

| Setting | Default | Notes |
|--------|---------|--------|
| `META_BASE_URL` | `https://api.meta.ai/v1` | Master plan URL; not live-verified in this environment |
| `META_MODEL` | `muse-spark-1.3` | Master plan model id |
| `MODEL_API_KEY` | _(empty)_ | Server-only; never commit or log |

## Request shape (unverified)

The worker calls:

`POST {META_BASE_URL}/chat/completions`

with JSON body:

```json
{
  "model": "<META_MODEL>",
  "messages": [
    { "role": "system", "content": "<SOS_AI_SYSTEM_PROMPT>" },
    { "role": "user", "content": "<JSON task payload with SOS plaintext>" }
  ],
  "temperature": 0
}
```

Authorization: `Bearer ${MODEL_API_KEY}`.

**Status:** Request/response field names are **not live-verified** (`NOT_TESTED` without a valid `MODEL_API_KEY`). Confirm against Meta Model API docs before production.

## Plaintext source for AI

| Source | Used when |
|--------|-----------|
| `sosMessage.envelope.plaintextForOperator` | Controlled dev/fixture path only |
| `sosMessage.plaintextForOperator` | Same (top-level alias) |
| Decrypted `encryptedPayload` | **Not available in M0** — server does not decrypt ingest ciphertext |

If no plaintext is available, the async AI job writes `ai_analyses.status = NO_PLAINTEXT` and the ingest receipt path is unchanged.

## Output contract

Validated JSON fields: `categories[]`, `persons_estimate`, `injuries_reported`, `needs[]`, `urgency_suggestion`, `uncertainty`, `quoted_evidence`, `location_unknown`, `language`, and **`requires_human_review: true` (fixed)**.

Forbidden in model output: team assignment / dispatch / treatment fields. Prompt injection in user text must not produce team assignment; output remains a human-reviewed suggestion only.

## Resilience

- Timeout + retry with exponential backoff on `429` and `5xx`
- Circuit breaker after repeated failures
- Per-tenant rate limit and daily cost cap (`AI_*` env vars)
- On failure, raw incident/message rows are retained; `ai_analyses.status = FAILED`

## Logging

Prompt and model response bodies are **not** written to application logs.

## Live smoke

| Check | Status |
|-------|--------|
| Real `https://api.meta.ai/v1` call | **NOT_TESTED** (no verified `MODEL_API_KEY` in agent environment) |
