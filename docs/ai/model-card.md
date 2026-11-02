# SOSMesh AI model card (ADIM 45)

## Purpose

Meta-compatible cloud classification produces **non-binding operator suggestions** for SOS text. It does **not** dispatch teams, set triage outcomes, or recommend treatment. Operators must confirm or override every field.

## Model and interface

| Item | Value |
|------|--------|
| Default model | `muse-spark-1.3` (`META_MODEL`) |
| API shape | OpenAI-compatible `POST /chat/completions` |
| Structured output | JSON validated against `SosAiOutput` schema |
| Human review | `requires_human_review: true` (hard requirement) |

See also [meta-provider.md](./meta-provider.md) for environment variables, retries, and circuit breaker behavior.

## Data handling and consent

| Topic | Policy |
|-------|--------|
| **Real SOS in production** | Cloud AI must **not** process real victim SOS plaintext until **explicit user/operator consent** and applicable **data processing terms** with the vendor are recorded. Until then, jobs may end in `NO_PLAINTEXT` or remain disabled (`AI_ENABLED=false`). |
| **Provider terms** | Meta (or chosen vendor) retention, training use, and subprocessors must be reviewed against KVKK/GDPR obligations (**legal review: NOT_TESTED**). |
| **De-identification** | Server applies best-effort redaction (`deidentifySosPlaintextForPrompt`) for emails, phone-like strings, and coordinate pairs before optional cloud calls. Redaction is **not** a substitute for consent. |
| **Logging** | Prompt and raw model bodies are not written to application logs. |
| **Eval dataset** | `apps/api/src/ai/evals` fixtures are **fully synthetic**; no real persons or locations. |

## Safety controls (ADIM 45)

| Control | Implementation |
|---------|----------------|
| Schema validation | `validateSosAiOutput` rejects forbidden decision fields (`team_assignment`, `triage_decision`, `treatment_plan`, …). |
| Safe fallback | On non-retryable parse/schema failures, `buildSafeFallbackSosAiOutput` returns unknown/low-confidence suggestion without inventing counts or places (`COMPLETED_FALLBACK`). |
| Prompt injection | System prompt + schema; red-team fixtures in eval suite; mock CI eval does not call live models. |
| Operator override | `POST /v1/operator/cases/{id}/ai-override` persists human corrections with audit trail. |
| Rate / cost / tokens | Tenant rate limit, UTC daily USD cap (`AiCostGuard`), per-incident token budget (`IncidentTokenBudgetGuard`). |
| AI off / outage | `AI_ENABLED=false`, missing key, rate/cost/token skips, and provider failures **do not block ingest** (async job only). |
| Metrics | In-process counters via `getAiRunMetrics()` (attempts, skips, fallback, estimated spend/tokens). |

## Evaluation status

| Check | Status |
|-------|--------|
| CI mock eval (`runMockMetaEval` + `MockMetaProvider`) | Runs in unit tests; field accuracy reported **only** for deterministic fixtures. |
| **gerçek model doğruluğu** | **NOT_TESTED** in CI (no `MODEL_API_KEY`; no live calls in pipeline). |
| Live operator accuracy | Requires consented production data and separate measurement (out of scope for M0). |

## Limitations

- SOSMesh **does not replace 112** or emergency services.
- Offline mesh relay remains functional **without** AI.
- Peer ACK ≠ operator/server read receipt.
- AI suggestions must be labeled **Öneri**, not **Karar**, in operator UI (ADIM 23).
