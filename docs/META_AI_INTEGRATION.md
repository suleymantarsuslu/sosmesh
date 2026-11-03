# Meta AI Integration — SOSMesh Multimodal Disaster Intelligence

**Meta AI Hackathon 2026 — Multimodal Emergency Response Coordination**

---

## Overview

SOSMesh integrates three Meta AI models to provide intelligent disaster response coordination while maintaining an **offline-first, AI-independent core**. All AI processing occurs server-side; the operator dashboard displays AI outputs as advisory suggestions that operators can accept, modify, or override.

**Critical Design Principle:** The offline BLE mesh path works without any AI calls. AI is an **augmentation layer**, not a dependency.

---

## Meta AI Models Used

### 1. Muse Spark 1.3

**Model ID:** `muse-spark-1.3`  
**API Endpoint:** `https://api.meta.ai/v1/chat/completions`

#### Use Cases

1. **Intelligent SOS Triage** (Primary use)
   - Event type classification (building collapse, fire, flood, medical, trapped, etc.)
   - Person count extraction from text
   - Urgency assessment (critical/high/medium/low/unknown)
   - Needs detection (medical, shelter, food, water, evacuation)
   - Hazard identification (fire, gas, unstable structure)
   - Missing information detection
   - Source quote extraction from original SOS text
   - Follow-up question generation for responders

2. **Multilingual Translation**
   - Turkish ↔ English translation of SOS messages
   - Operator dashboard locale adaptation
   - Uncertainty flagging when translation is ambiguous

3. **Photo Analysis**
   - Natural language description of disaster scene images
   - Visible object identification
   - Contextual interpretation of scene severity
   - Integration with SAM 3.1 segmentation results

4. **Signal Fusion Rationale**
   - Semantic analysis of whether multiple SOS reports describe the same incident
   - Rationale generation for link suggestions
   - Uncertain wording ("may be related", "possibly the same event")

5. **Mission Copilot**
   - Natural language queries about incidents
   - Situation summary generation
   - Response recommendation with cited incident sources
   - Next steps suggestions for operators

#### Inputs/Outputs

**Input:**
```json
{
  "model": "muse-spark-1.3",
  "messages": [
    {
      "role": "system",
      "content": "You are an emergency triage assistant. Never invent person counts, coordinates, or injuries not explicitly stated."
    },
    {
      "role": "user",
      "content": "Building collapsed, 3rd floor, 2 people trapped, smoke visible"
    }
  ],
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "sos_triage",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "eventType": { "type": "string", "enum": ["building_collapse", "fire", "flood", ...] },
          "personCount": { "type": ["number", "null"] },
          "urgencySuggestion": { "type": "string", "enum": ["critical", "high", "medium", "low", "unknown"] },
          "needs": { "type": "array", "items": { "type": "string" } },
          "hazards": { "type": "array", "items": { "type": "string" } },
          "missingInfo": { "type": "array", "items": { "type": "string" } },
          "sourceQuotes": { "type": "array", "items": { "type": "string" } },
          "followUpQuestions": { "type": "array", "items": { "type": "string" } },
          "briefSummary": { "type": "string" }
        },
        "required": ["eventType", "urgencySuggestion", "needs", "hazards", "briefSummary"]
      }
    }
  },
  "reasoning_effort": "low"
}
```

**Output:**
```json
{
  "id": "chatcmpl-...",
  "model": "muse-spark-1.3",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "{\"eventType\":\"building_collapse\",\"personCount\":2,\"urgencySuggestion\":\"critical\",\"needs\":[\"rescue\",\"medical\"],\"hazards\":[\"fire\",\"unstable_structure\"],\"missingInfo\":[\"exact_location\",\"injuries\"],\"sourceQuotes\":[\"Building collapsed\",\"3rd floor\",\"2 people trapped\"],\"followUpQuestions\":[\"Can you share your exact address?\",\"Are there any injuries?\"],\"briefSummary\":\"Building collapse with 2 people trapped on 3rd floor, smoke visible, rescue and medical assistance needed\"}"
    }
  }],
  "usage": {
    "prompt_tokens": 120,
    "completion_tokens": 85,
    "reasoning_tokens": 450,
    "total_tokens": 655
  }
}
```

#### Prompts and Safety Guardrails

**System Prompt (Triage):**
```
You are an emergency triage assistant analyzing SOS reports from disaster zones. 
Your task is to classify the incident, assess urgency, and identify needs.

CRITICAL RULES:
- Never invent person counts if not stated — use null
- Never invent coordinates, addresses, or landmarks
- Never invent medical diagnoses or injury details
- Mark urgency as "unknown" if insufficient information
- All output must be verifiable from the source text
- Use sourceQuotes to cite every claim
```

**Prompt Injection Protection:**
- SOS text is **not trusted** — treated as user-generated content
- System prompt enforces grounding in source text
- No execution of instructions embedded in SOS messages
- Output schema validation prevents arbitrary responses

**Safety Measures:**
- AI **never** blocks SOS ingestion — failures logged, message preserved
- AI **never** auto-assigns teams or resources
- AI **never** makes final triage decisions — operators override
- Budget guard prevents runaway costs (see below)

---

### 2. Muse Voice Transcribe 1.0

**Model ID:** `muse-voice-transcribe-1.0`  
**API Endpoint:** `https://api.meta.ai/v1/audio/transcriptions`

#### Use Cases

1. **Voice SOS Transcription**
   - Real-time speech-to-text for audio SOS notes
   - Automatic language detection (Turkish/English bias)
   - Turn-based transcript with timestamps
   - Speaker diarization when available

#### Inputs/Outputs

**Input:**
```
POST /v1/audio/transcriptions
Content-Type: multipart/form-data

file: [WAV mono 16-bit 16kHz audio file]
model: muse-voice-transcribe-1.0
mode: PUSH_TO_TALK
language_bias: ["tr", "en"]
keywords: ["enkaz", "yaralı", "yangın", "sel", "trapped", "injured", "fire", "flood"]
```

**Audio Requirements:**
- Format: WAV, M4A/AAC, OGG/Opus, WebM, MP3
- Converted to: WAV mono 16-bit 16kHz (via FFmpeg)
- Max size: 10 MB
- Max duration: 120 seconds

**Output:**
```json
{
  "session_id": "asr-...",
  "transcript": "Bina çöktü, 3. katta 2 kişi mahsur kaldı",
  "audio_duration_ms": 4200,
  "turns": [
    {
      "turn_id": 1,
      "start_ms": 0,
      "end_ms": 4200,
      "transcript": "Bina çöktü, 3. katta 2 kişi mahsur kaldı",
      "speaker": "speaker_1"
    }
  ]
}
```

#### Processing Pipeline

1. **Audio Upload:** Operator uploads audio to `/v1/operator/cases/:id/attachments`
2. **Validation:** MIME type, size, duration checks
3. **Conversion:** FFmpeg converts to WAV 16kHz mono
4. **Transcription Job:** Enqueued to AI job queue
5. **API Call:** Converted audio sent to Meta Voice Transcribe
6. **Storage:** Transcript saved to `ai_transcripts` table
7. **Chaining:** Automatically enqueues Muse Spark triage job with transcript text
8. **Dashboard Display:** Audio player with seekable transcript turns

#### Prompts and Safety

**Language Keywords (Emergency Context):**
- Turkish: enkaz, yaralı, yangın, sel, mahsur, yardım
- English: trapped, injured, fire, flood, help, emergency

**Safety Measures:**
- Audio files **never logged** in plaintext
- Original audio retained for playback, transcript stored separately
- PII redaction applied to stored transcripts
- Budget reserve: $0.18/hour of audio (reconciled with actual usage)

---

### 3. SAM 3.1 (Segment Anything Model)

**Model ID:** `sam-3.1`  
**API Endpoint:** `https://api.meta.ai/v1/vision/segment`

#### Use Cases

1. **Disaster Scene Photo Segmentation**
   - Identify and segment visible objects in disaster photos
   - Bounding box + mask generation for each detected object
   - Operator dashboard visual overlay on original image

#### Inputs/Outputs

**Input:**
```
POST /v1/vision/segment
Content-Type: multipart/form-data

image: [JPEG/PNG image file]
model: sam-3.1
concept: "disaster scene objects"
```

**Output:**
```json
{
  "segments": [
    {
      "id": "seg-001",
      "confidence": 0.92,
      "boundingBox": {
        "x1": 120,
        "y1": 80,
        "x2": 340,
        "y2": 260,
        "width": 220,
        "height": 180
      },
      "mask": {
        "x": 120,
        "y": 80,
        "width": 220,
        "height": 180,
        "encoding": "rle",
        "data": "base85-encoded-mask-data"
      }
    },
    ...
  ],
  "images_processed": 1
}
```

#### Processing Pipeline

1. **Photo Upload:** Attached to SOS via `/v1/operator/cases/:id/attachments`
2. **Vision Job:** Enqueued after successful triage
3. **Spark Vision:** Muse Spark generates natural language description
4. **SAM Segmentation:** SAM 3.1 segments visible objects
5. **Storage:** Results saved to `ai_vision_analyses` table
6. **Dashboard Display:** Canvas overlay with bounding boxes + masks, toggle controls

#### Prompts and Safety

**SAM Limitations (Clearly Documented):**
- SAM **only** identifies visible objects in the image
- SAM **cannot** assess structural safety, detect life signs, or diagnose medical conditions
- SAM **cannot** see through smoke, darkness, or obstructions
- All SAM results are "visible object detection" — not rescue assessments

**Spark Vision System Prompt:**
```
Describe what is visibly present in this disaster scene photo.
Focus on observable physical elements: debris, structures, smoke, water, vehicles, people if clearly visible.
Never infer hidden dangers, structural stability, or medical status.
State only what is directly observable in the image.
```

**Safety Measures:**
- Photo metadata (EXIF GPS) stripped before storage
- SAM masks displayed with "Visible Objects" label
- Operators cannot interpret masks as rescue priority indicators

---

## Signal Fusion

**Purpose:** Correlate multiple SOS reports that may describe the same disaster event.

**Methodology:** Hybrid deterministic + AI semantic analysis

### Deterministic Scoring

Factors:
- **Location proximity:** Haversine distance < 5 km threshold
- **Time proximity:** Within 1-hour window
- **Event type match:** Same SOS type (fire, collapse, etc.)
- **Needs/hazards overlap:** Jaccard similarity of tags

**Threshold:** Deterministic score ≥ 0.6 triggers AI rationale generation

### AI Semantic Rationale (Muse Spark)

**Input:** Pair of SOS reports with location/time/text
**Output:** Natural language rationale with **uncertain wording**

**System Prompt:**
```
You are analyzing whether two emergency reports describe the same incident.
Use uncertain language: "may be", "possibly", "suggests", "might indicate".
Never claim certainty without explicit confirmation.
Cite specific evidence from both reports.
```

**Output Example:**
```json
{
  "rationale": "Both reports mention a building collapse on the same street within 15 minutes. The person counts differ (2 vs 3), which may indicate separate observations of the same event or distinct incidents. The proximity (0.4 km) and time delta (12 minutes) suggest a possible link.",
  "confidence": "medium"
}
```

### Operator Workflow

1. System generates link suggestion with score + rationale
2. Operator reviews suggestion in dashboard
3. Operator **confirms** (marks linked) or **rejects** (dismisses)
4. **No auto-merge** — incidents remain separate records
5. Audit log records all link decisions

---

## Mission Copilot

**Purpose:** AI-powered operator assistant for situation queries

### Capabilities

1. **Incident-scoped queries:** "Summarize critical cases in the last hour"
2. **Team-scoped queries:** "What resources are needed for open fire incidents?"
3. **Situation awareness:** "What is the overall status?"

### Implementation

**Endpoint:** `POST /v1/operator/copilot/ask`

**Input:**
```json
{
  "query": "Summarize all critical building collapse incidents",
  "scope": "open",
  "incidentIds": []
}
```

**Spark System Prompt:**
```
You are an emergency operations assistant helping operators understand the situation.
Answer questions based ONLY on the provided incident data.
Cite incident IDs for all claims.
State what you don't know — never invent data.
Suggest next steps as options, not commands.
```

**Output:**
```json
{
  "answer": "There are 3 critical building collapse incidents: INC-001 (5 people, medical needs), INC-003 (2 people, rescue team assigned), INC-007 (unknown count, no location). Immediate action needed for INC-001 and INC-007.",
  "citedIncidentIds": ["INC-001", "INC-003", "INC-007"],
  "uncertainty": "Location unknown for INC-007; unable to assess proximity to resources.",
  "suggestedNextSteps": [
    "Request location update for INC-007",
    "Verify medical team availability for INC-001",
    "Check rescue team status for INC-003"
  ]
}
```

**Safety:**
- Copilot **cannot** assign teams or approve missions
- Copilot **cannot** access credentials or send messages
- All copilot responses labelled "AI Suggestion" in UI
- Prompt injection protection: incident data treated as untrusted

---

## AI Operator Dashboard

**Page:** `/operator/ai`

### AI Status Card

Displays:
- AI system enabled/disabled status
- Circuit breaker state (closed/open/half-open)
- Budget used today / daily cap ($30 default)
- Total budget used / total cap ($150 default)
- Job queue depth
- Last successful analysis timestamp
- Available models (Spark, Voice, SAM)

**Budget Display Example:**
```
Daily Budget: $4.23 / $30.00 (14%)
Total Budget: $18.67 / $150.00 (12%)
Queue: 2 jobs pending
Last Analysis: 3 minutes ago
Models: Spark ✓ | Voice ✓ | SAM ✓
```

### Mission Copilot Card

Interactive chat interface:
- Operator types query
- Copilot responds with cited incidents
- Links to incident detail pages
- Copy response to clipboard
- Clear uncertainty warnings

### Demo SOS Form

Allows operators to create synthetic test data:
- Text input with SYNTHETIC label
- Audio file upload
- Photo upload
- Big warning badge: "DEMO DATA - NOT REAL EMERGENCY"
- Endpoint: `POST /v1/operator/demo/sos` (operator auth required)

---

## Budget Guard

**Purpose:** Prevent runaway AI costs

### Configuration

```bash
AI_DAILY_BUDGET_USD=30      # Default: $30/day
AI_TOTAL_BUDGET_USD=150     # Default: $150 total
```

### Implementation

**Database-backed ledger:**
- `ai_usage_ledger` table tracks all API calls
- Pre-flight budget check before each job
- Reserved cost estimated before API call
- Actual cost reconciled after response
- Daily/total budget enforced with pessimistic locking

**Budget Exceeded Behavior:**
- AI jobs marked as `BLOCKED_BUDGET`
- SOS ingestion continues normally
- Operator dashboard shows "AI unavailable (budget)"
- Hourly reset for daily budget
- Manual reset required for total budget

**Estimation:**
- Spark triage: ~$0.002 per call (650 tokens @ low reasoning)
- Voice transcribe: ~$0.18/hour of audio
- SAM segmentation: ~$0.01 per image
- Fusion rationale: ~$0.001 per pair
- Copilot query: ~$0.003 per query

---

## Job Queue and Fallbacks

### Job Queue Architecture

**Database:** PostgreSQL `ai_jobs` table (durable queue)

**Job Kinds:**
- `triage` — SOS text analysis with Muse Spark
- `transcribe` — Audio to text with Voice Transcribe
- `vision` — Photo analysis with Spark + SAM
- `fusion` — Link suggestion rationale generation

**Job Lifecycle:**
1. **Enqueued:** After SOS ingestion commit
2. **Pending:** Waiting for worker pickup
3. **Processing:** Worker executing API call
4. **Completed:** Success, results saved
5. **Failed:** Error logged, incident preserved
6. **Unavailable:** Circuit open or budget exceeded

### Automatic Job Chaining

1. **Triage completes** → enqueue fusion job (if multiple incidents exist)
2. **Transcribe completes** → enqueue triage job with transcript text
3. **Vision completes** → no chaining (terminal job)

### Fallback Strategies

**Circuit Breaker:**
- Threshold: 3 consecutive failures
- Cooldown: 30 seconds
- State: closed → half-open → open
- Half-open: allow 1 test request

**Retry Policy:**
- Max retries: 2 (configurable)
- Backoff: Exponential (1s, 2s, 4s)
- Retryable: 429, 500, 502, 503, 504
- Non-retryable: 400, 401, 403, 413

**Graceful Degradation:**
- AI failure → SOS record preserved, status updated
- Dashboard shows "AI unavailable" badge
- Operator can still view, assign, and manage cases
- Core offline mesh unaffected

---

## AI_ENABLED Flag

**Environment Variable:** `AI_ENABLED`

**Default:** `false` (opt-in)

### Behavior

**When `AI_ENABLED=false`:**
- No AI jobs enqueued
- No Meta API calls
- No budget tracking
- Dashboard shows "AI Disabled" badge
- SOS ingestion works normally
- Operator panel fully functional

**When `AI_ENABLED=true`:**
- AI jobs enqueued after SOS ingestion
- Worker process consumes queue
- Budget guard enforced
- Meta API calls executed
- Dashboard shows AI suggestions

### Why Default False?

1. **No API key = no mysterious failures** — system works without Meta credentials
2. **Cost control** — explicit opt-in prevents surprise charges
3. **GDPR/Privacy** — explicit consent for external AI processing
4. **Offline focus** — reinforces that AI is augmentation, not dependency

### Production Deployment

**VULUT Deployment:** The production VULUT deployment sets `AI_ENABLED=true` via its Coolify environment configuration (Coolify web UI environment variables). The compose file's `AI_ENABLED=${AI_ENABLED:-false}` provides a safe fallback only if the environment variable is unset.

**Code default:** `'false'` (Joi schema in `apps/api/src/config/env.schema.ts`)  
**Compose fallback:** `false` (via `${AI_ENABLED:-false}` shell parameter expansion)  
**Runtime (VULUT):** `true` (set in Coolify environment, activating AI features)

### How to Enable

```bash
# In .env
AI_ENABLED=true
MODEL_API_KEY=your-meta-ai-api-key-here

# Restart API and worker
pnpm --filter @sosmesh/api restart
```

---

## File Paths and Endpoints

### Backend Implementation

**Core Services:**
- `apps/api/src/ai/meta-model-client.ts` — Unified Meta AI client
- `apps/api/src/ai/triage-v2.service.ts` — Muse Spark triage
- `apps/api/src/ai/voice/voice-transcription.service.ts` — Voice Transcribe
- `apps/api/src/ai/vision/vision-analysis.service.ts` — Spark + SAM vision
- `apps/api/src/ai/fusion/fusion.service.ts` — Signal fusion
- `apps/api/src/ai/copilot/copilot.service.ts` — Mission copilot
- `apps/api/src/ai/budget-guard.service.ts` — Budget enforcement
- `apps/api/src/ai/ai-job-queue.service.ts` — Durable job queue
- `apps/api/src/ai/ai-job-runner.service.ts` — Worker process

**Media Processing:**
- `apps/api/src/media/audio-conversion.service.ts` — FFmpeg audio conversion
- `apps/api/src/media/audio-upload.service.ts` — Audio file validation
- `apps/api/src/media/attachments.controller.ts` — Media upload/streaming endpoints

**API Endpoints:**
- `POST /v1/operator/cases/:id/attachments` — Upload audio/photo
- `GET /v1/operator/cases/:id/ai` — Fetch AI analysis results
- `POST /v1/operator/cases/:id/ai-override` — Operator urgency override
- `GET /v1/operator/attachments/:id/audio` — Stream audio file
- `GET /v1/operator/attachments/:id/image` — Stream image file
- `GET /v1/operator/ai/status` — AI system status
- `GET /v1/operator/ai/situation-summary` — Deterministic situation counts
- `POST /v1/operator/copilot/ask` — Mission copilot query
- `GET /v1/operator/cases/:id/links` — Fetch link suggestions
- `POST /v1/operator/link-suggestions/:id/confirm` — Confirm link
- `POST /v1/operator/link-suggestions/:id/reject` — Reject link
- `POST /v1/operator/demo/sos` — Create synthetic SOS (operator auth)

### Database Schema

**Tables:**
- `ai_jobs` — Job queue (kind, incidentId, status, payload, result)
- `ai_analyses` — Triage results (urgencySuggestion, needs, hazards, etc.)
- `ai_transcripts` — Voice transcriptions (turns, language, duration)
- `ai_vision_analyses` — Photo analysis (sparkSummary, samSegments)
- `incident_link_suggestions` — Fusion links (score, rationale, status)
- `ai_usage_ledger` — Budget tracking (cost, tokens, model)
- `attachments` — Media files (SHA256, mimeType, synthetic flag)

### Environment Variables

```bash
# Core AI Settings
AI_ENABLED=false                          # Master toggle (code default: false, VULUT production: true via Coolify)
MODEL_API_KEY=                            # Meta AI API key
META_BASE_URL=https://api.meta.ai/v1     # Meta API endpoint
META_MODEL=muse-spark-1.3                 # Default Spark model
META_TIMEOUT_MS=60000                     # API timeout (60s)
META_REASONING_EFFORT=low                 # Spark reasoning level

# Budget Limits
AI_DAILY_BUDGET_USD=30                    # Daily spending cap
AI_TOTAL_BUDGET_USD=150                   # Total spending cap

# Circuit Breaker
META_CIRCUIT_FAILURE_THRESHOLD=3          # Failures before open
META_CIRCUIT_COOLDOWN_MS=30000            # Cooldown duration

# Media Storage
MEDIA_STORAGE_DIR=/data/media             # Audio/photo storage path

# Server-side Decryption
SOSMESH_SERVER_SOS_PRIVATE_KEY=           # Server private key (base64)
SOSMESH_SERVER_SOS_KEY_ID=                # Server key ID
```

**Security Note:** Never log or print `MODEL_API_KEY` or `SOSMESH_SERVER_SOS_PRIVATE_KEY` values.

---

## Testing

### Smoke Tests

**Location:** `apps/api/scripts/ai-smoke/`

**Triage Smoke Test:**
```bash
cd apps/api
MODEL_API_KEY=your-key node scripts/ai-smoke/triage.mjs
```

**Voice Smoke Test:**
```bash
MODEL_API_KEY=your-key node scripts/ai-smoke/voice.mjs
```

**Copilot Smoke Test:**
```bash
MODEL_API_KEY=your-key OPERATOR_TOKEN=your-token node scripts/ai-smoke/copilot.mjs
```

### Unit Tests

**Location:** `apps/api/test/`

- `voice-conversion.spec.ts` — FFmpeg argument validation
- `voice-transcription-failure.spec.ts` — SOS unaffected by transcription failure
- `fusion-score.spec.ts` — Deterministic scoring algorithm
- `fusion-confirm-no-merge.spec.ts` — Verify no auto-merge on confirm

**Run:**
```bash
cd apps/api
pnpm test voice-conversion
pnpm test fusion-score
```

### Integration Tests

**Demo Seed Script:**
```bash
MODEL_API_KEY=your-key OPERATOR_TOKEN=your-token node scripts/demo/seed-synthetic.mjs
```

Creates 8-10 synthetic SOSs with:
- 2-3 forming a fusion group (same event, nearby)
- All marked `synthetic: true`
- Text includes "SENTETİK DEMO" label

---

## Red Lines

### What AI Does NOT Do

1. ❌ **AI does NOT replace 112/911** — SOSMesh is experimental; always use official emergency services
2. ❌ **AI does NOT block SOS ingestion** — failures logged, message preserved
3. ❌ **AI does NOT make final decisions** — operators override all suggestions
4. ❌ **AI does NOT auto-assign teams** — mission copilot suggests, operator approves
5. ❌ **AI does NOT auto-merge incidents** — fusion confirms link, records stay separate
6. ❌ **AI does NOT guarantee structural safety** — SAM shows visible objects only
7. ❌ **AI does NOT diagnose medical conditions** — triage identifies needs, not diagnoses
8. ❌ **AI does NOT see encrypted relay traffic** — server-side decryption only

### Privacy Guarantees

1. ✅ **Relay devices cannot read SOS content** — E2E encryption with server public key
2. ✅ **Meta AI does NOT receive GPS coordinates** — only SOS text sent for triage
3. ✅ **Meta AI does NOT receive device IDs** — only anonymized content
4. ✅ **Audio/photos never logged** — stored securely, transmitted over HTTPS only
5. ✅ **PII redacted from logs** — location, names, phone numbers masked
6. ✅ **Synthetic data labelled** — demo SOSs clearly marked, never mixed with real data

### Safety Guarantees

1. ✅ **Offline BLE mesh works without AI** — core SOS delivery AI-independent
2. ✅ **Budget guard prevents runaway costs** — hard caps enforced with ledger
3. ✅ **Circuit breaker stops cascading failures** — 3 failures → 30s cooldown
4. ✅ **Graceful degradation** — dashboard shows "AI unavailable", system continues
5. ✅ **Operator always in control** — AI outputs advisory, not authoritative
6. ✅ **Audit trail** — all AI suggestions and operator overrides logged

---

## Next Steps

### Immediate (Hackathon)

- [ ] Complete smoke tests for all three models (triage ✓, voice ⚠️, vision ⚠️)
- [ ] Verify budget guard enforcement on staging
- [ ] Test Turkish voice transcription accuracy
- [ ] Capture demo walkthrough video with synthetic data

### Post-Hackathon

- [ ] SAM 3.1 video frame analysis (extended capability)
- [ ] Multilingual expansion (Arabic, Kurdish, Persian)
- [ ] Advanced fusion (multi-hop correlation, temporal clustering)
- [ ] Offline AI with Muse Glimmer (on-device model)
- [ ] Performance benchmarks (latency, throughput, cost per incident)
- [ ] Security audit (OWASP, Meta AI API compliance)

---

**Document Version:** 1.0  
**Last Updated:** 2026-11-03  
**Meta AI Hackathon 2026**
