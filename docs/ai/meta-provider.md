# Meta AI provider (ADIM 20)

## Endpoint and model

| Setting | Default | Notes |
|--------|---------|--------|
| `META_BASE_URL` | `https://api.meta.ai/v1` | Live path verified in audit (no agent live call) |
| `META_MODEL` | `muse-spark-1.3` | Reasoning model; needs sufficient `META_MAX_TOKENS` |
| `META_MAX_TOKENS` | `4096` | Values like `20` yield `content: null`, `finish_reason: length` → job **FAILED** |
| `MODEL_API_KEY` | _(empty)_ | Server-only; `Authorization: Bearer` |
| `AI_DAILY_COST_CAP_USD` | `5` | UTC calendar day; `AiCostGuard` resets at UTC midnight |

## Request (OpenAI chat-completions compatible)

`POST https://api.meta.ai/v1/chat/completions`

```json
{
  "model": "<META_MODEL>",
  "messages": [
    { "role": "system", "content": "<SOS_AI_SYSTEM_PROMPT>" },
    { "role": "user", "content": "<JSON task with decrypted SOS plaintext>" }
  ],
  "temperature": 0,
  "max_tokens": <META_MAX_TOKENS>
}
```

Structured SOS JSON is parsed from `choices[0].message.content` and validated against the operator suggestion schema.

Truncation handling: `finish_reason === "length"` or empty/null `content` → `ai_analyses.status = FAILED` (incident retained).

## Plaintext source (server decrypt port only)

| Source | M0 |
|--------|-----|
| `SosPlaintextSource` (ADIM 9 server-side decrypt) | **Not wired** — default implementation returns `null` |
| Envelope / packet body fields | **Forbidden** — relays must not see SOS text; ingest rejects `plaintext*`, `text`, `message`, etc. on the envelope |

When plaintext is unavailable: async job writes `NO_PLAINTEXT`. Ingest and encrypted payload storage are unchanged.

## Output contract

Validated JSON fields: `categories[]`, `persons_estimate`, `injuries_reported`, `needs[]`, `urgency_suggestion`, `uncertainty`, `quoted_evidence`, `location_unknown`, `language`, and **`requires_human_review: true` (fixed)**.

## Logging

Prompt and model response bodies are **not** written to application logs.

## Live smoke

| Check | Status |
|-------|--------|
| Cloud agent live Meta call | **NOT_RUN** (key not in agent environment) |
| Denetçi canlı smoke | **PASS** (2026-11-01, see below) |

**Canlı smoke 2026-11-01:** SOSMesh denetçisi tarafından box üzerinden, sentetik Türkçe fixture ile `chat/completions` + bu system prompt: HTTP **200**, `finish_reason=stop`, şemaya uygun JSON, prompt injection denemesine rağmen ekip ataması yok, `requires_human_review=true`. Ölçüm: ~**1.9k token/istek** (`completion_tokens` ~1668, reasoning payı yüksek). Anahtar değeri kaydedilmedi.

Production SOS metni M0’da sunucuda çözülmediği için operasyonel yol hâlâ **`NO_PLAINTEXT`**; status **PARTIAL** kalır.
