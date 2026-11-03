# SOSMesh Demo Script — Meta AI Hackathon 2026

**Duration:** 3 minutes  
**Audience:** Hackathon judges  
**Demo Type:** Live system with synthetic data (labelled)

---

## Demo Overview

This demonstration showcases SOSMesh's multimodal AI-powered disaster intelligence platform, highlighting:
1. **Offline-first BLE mesh** — SOS relay without internet
2. **Meta AI multimodal analysis** — Text (Muse Spark), Voice (Transcribe), Photo (SAM 3.1)
3. **Signal fusion** — Correlate multiple reports of the same incident
4. **Mission copilot** — AI-powered operator assistant
5. **Operator control** — Human-in-the-loop decision making

**Important:** All data shown is **synthetic and clearly labelled** as demo data. No real emergency information is used.

---

## Pre-Demo Setup

### Environment
- Backend API running on http://localhost:3001 (or staging URL)
- Operator dashboard open at http://localhost:3000
- 2 Android phones ready (Phone A: victim, Phone B: relay)
- Audio recording ready (synthetic Turkish SOS)
- Disaster photo ready (public domain image)

### Synthetic Data Preparation
```bash
# Create demo SOSs with AI analysis
MODEL_API_KEY=your-key OPERATOR_TOKEN=your-token node scripts/demo/seed-synthetic.mjs
```

This creates 8-10 synthetic SOS messages including:
- 2-3 forming a fusion group (same event, nearby locations)
- All marked with **"SENTETİK DEMO"** label
- Text, voice, and photo samples

---

## Demo Script (3 Minutes)

### Scene 1: Introduction (15 seconds)

**Narrator:**
> "SOSMesh is a disaster intelligence platform that combines offline mesh networking with Meta AI multimodal analysis. When cellular infrastructure fails, our BLE mesh relays emergency messages device-to-device. Let me show you how it works."

**Screen:**
- Show README.md architecture diagram
- Highlight: Offline path (red) works without internet, AI path (blue) augments when available

---

### Scene 2: Offline SOS Creation (30 seconds)

**Narrator:**
> "A disaster victim's phone has no internet. They open SOSMesh and create an SOS."

**Actions:**
1. Show Phone A (victim) in airplane mode
2. Open SOSMesh Android app
3. Tap "Create SOS" button
4. Fill form:
   - **Text:** "Bina çöktü, 3. katta 2 kişi mahsur kaldı" (Turkish: Building collapsed, 3rd floor, 2 people trapped)
   - **Location:** Ankara (simulated)
   - Mark as **DEMO DATA** (checkbox visible in app)
5. Tap "Send SOS"
6. Show status: **"LOCAL_SAVED"** (orange badge)

**Callout:**
> "Notice: The SOS is saved locally. No internet required. The victim sees 'Message saved' — NOT 'Help is coming'."

---

### Scene 3: BLE Mesh Relay (30 seconds)

**Narrator:**
> "A volunteer relay device (Phone B) with internet comes nearby. The encrypted SOS transfers via Bluetooth."

**Actions:**
1. Show Phone B (relay) with Wi-Fi enabled
2. Move Phone A and Phone B close together (~1 meter)
3. Watch BLE transfer animation on both screens
4. Phone A status updates: **"PEER_RECEIVED"** (blue badge)
5. Phone B shows: "Relaying 1 message..." (relay device does NOT see SOS text)

**Callout:**
> "The relay device sees only the encrypted envelope. Privacy-by-design: volunteers cannot read SOS content."

---

### Scene 4: Server Upload & Decryption (15 seconds)

**Narrator:**
> "The relay uploads the encrypted message to our backend. Only the server can decrypt it with the private key."

**Actions:**
1. Show terminal with backend logs:
   ```
   [info] SOS received: messageId=550e8400...
   [info] Decryption successful
   [info] AI job enqueued: kind=triage
   ```
2. Phone A status updates: **"SERVER_ACCEPTED"** (green badge)

---

### Scene 5: AI Triage with Muse Spark (30 seconds)

**Narrator:**
> "Muse Spark 1.3 analyzes the SOS and provides an urgency assessment."

**Actions:**
1. Switch to operator dashboard (localhost:3000)
2. Show map with new incident marker (Ankara)
3. Click incident to open case detail
4. Show **AI Intelligence Panel** on the right:
   - **Urgency Suggestion:** Critical (red badge)
   - **Event Type:** Building Collapse
   - **Needs:** Rescue, Medical
   - **Hazards:** Unstable Structure
   - **Person Count:** 2
   - **Missing Info:** "Exact address, injuries unknown"
   - **Source Quotes:** Highlighted from original text
   - **Follow-up Questions:** "Can you share exact address?" "Are there injuries?"

**Callout:**
> "AI suggests 'Critical' urgency, but the operator has final say. Notice the 'Accept' and 'Override' buttons."

---

### Scene 6: Voice Note Transcription (25 seconds)

**Narrator:**
> "The victim recorded a voice note. Meta Voice Transcribe converts it to text."

**Actions:**
1. Show second incident with audio attachment (microphone icon)
2. Click to expand **Transcript Card**:
   - Audio player with waveform
   - Play button → synthetic Turkish speech plays
   - Transcript appears below in real-time:
     > "Yardım edin, yangın var, 3 kişiyiz"  
     > (Help, there's fire, we are 3 people)
   - Turns with timestamps: `[0:00 - 0:04] speaker_1`
   - Language: Turkish (auto-detected)
3. Show automatic triage job chained from transcript

**Callout:**
> "Voice transcribe automatically feeds into triage. The operator sees both the audio and the text."

---

### Scene 7: Photo Analysis with SAM 3.1 (25 seconds)

**Narrator:**
> "A third SOS includes a disaster photo. SAM 3.1 segments visible objects."

**Actions:**
1. Show third incident with photo attachment (camera icon)
2. Click to expand **Photo Analysis Card**:
   - Original disaster scene image (collapsed building)
   - **Muse Spark Vision Summary:** "Visible: debris, collapsed structure, smoke"
   - **SAM 3.1 Segmentation Overlay** (toggle ON):
     - Bounding boxes highlight detected objects
     - Masks overlay in semi-transparent color
     - Labels: "debris_pile", "structural_beam", "smoke_cloud"
   - Model IDs shown: muse-spark-1.3, sam-3.1
   - Confidence scores displayed

**Callout:**
> "SAM shows visible objects only. It does NOT assess structural safety or detect hidden victims. The operator interprets the visual evidence."

---

### Scene 8: Signal Fusion (20 seconds)

**Narrator:**
> "SOSMesh detects that these three reports may describe the same incident."

**Actions:**
1. Scroll down in case detail to **Fusion Suggestions Card**
2. Show suggested links:
   - **Incident A** (text SOS) ↔ **Incident B** (voice note)
   - **Match Score:** 0.78 (high)
   - **Distance:** 0.4 km
   - **Time Delta:** 12 minutes
   - **AI Rationale:** "Both reports mention building collapse on same street within 15 minutes. Person counts differ (2 vs 3), possibly separate observations of the same event."
3. Show buttons: **"Confirm Link"** | **"Reject"**

**Callout:**
> "AI suggests a link with rationale, but does NOT auto-merge. The operator confirms or rejects."

**Actions:**
4. Click **"Confirm Link"**
5. Badge appears: **"Linked to INC-002"**
6. Both incidents remain separate in database (no merge)

---

### Scene 9: Mission Copilot (20 seconds)

**Narrator:**
> "The operator asks the mission copilot for a situation summary."

**Actions:**
1. Switch to **AI Dashboard** tab (`/operator/ai`)
2. Show **Mission Copilot Card** (chat interface)
3. Type query: "Summarize all critical building collapse incidents"
4. Click **"Ask"**
5. Copilot responds:
   ```
   Answer: There are 3 critical building collapse incidents: 
   INC-001 (5 people, medical needs), 
   INC-003 (2 people, rescue team assigned), 
   INC-007 (unknown count, no location).
   
   Cited Incidents: [INC-001] [INC-003] [INC-007]
   
   Uncertainty: Location unknown for INC-007; unable to assess proximity.
   
   Next Steps:
   - Request location update for INC-007
   - Verify medical team availability for INC-001
   - Check rescue team status for INC-003
   ```
6. Click incident links to jump to case detail

**Callout:**
> "Copilot cites sources and admits uncertainty. It suggests next steps but does NOT auto-assign teams."

---

### Scene 10: Operator Decision (15 seconds)

**Narrator:**
> "The operator reviews the AI suggestions and makes the final decision."

**Actions:**
1. Return to case detail for INC-001
2. Show AI suggestion: **Critical**
3. Operator clicks **"Accept Urgency"**
4. Urgency badge turns solid red (operator-confirmed)
5. Show audit log entry: "Operator confirmed urgency: Critical"

**Callout:**
> "AI suggests, operator decides. All actions are logged for accountability."

---

### Scene 11: AI Status & Budget (10 seconds)

**Narrator:**
> "The AI dashboard shows system health and cost tracking."

**Actions:**
1. Show **AI Status Card**:
   - AI Enabled: ✅
   - Circuit Breaker: Closed ✅
   - Daily Budget: $4.23 / $30.00 (14%)
   - Total Budget: $18.67 / $150.00 (12%)
   - Queue: 0 jobs pending
   - Last Analysis: 3 minutes ago
   - Models Available: Spark ✓ | Voice ✓ | SAM ✓

**Callout:**
> "Budget guards prevent runaway costs. If the cap is hit, AI jobs stop but SOS ingestion continues."

---

### Scene 12: Closing & Key Takeaways (10 seconds)

**Narrator:**
> "SOSMesh combines offline resilience with AI intelligence."

**Screen:**
- Show side-by-side:
  - **Left:** Offline BLE mesh diagram (works without internet)
  - **Right:** AI augmentation layer (optional)

**Narrator:**
> "Key innovations:
> - Offline-first: BLE mesh works with zero internet or AI
> - Multimodal AI: Text, voice, and photo analysis with Meta models
> - Privacy: Relay devices cannot read SOS content
> - Human-in-the-loop: Operators make all final decisions
> 
> Thank you. Questions?"

**End Screen:**
- SOSMesh logo
- "Meta AI Hackathon 2026"
- GitHub repo link
- **Disclaimer:** "Demo data is synthetic. SOSMesh is experimental and does NOT replace 112/911."

---

## Demo Data Labelling

### Visual Indicators

**In Mobile App:**
- "DEMO" badge on SOS form
- Checkbox: "This is test data"
- Banner: "You are creating a synthetic SOS for testing"

**In Operator Dashboard:**
- **"SYNTHETIC DEMO"** label on every demo incident card
- Orange warning badge
- Tooltip: "This is synthetic test data, not a real emergency"

**In AI Panel:**
- Footer text: "AI analysis based on synthetic demo data"

### Database Flags

All synthetic records marked:
```sql
sos_messages.synthetic = true
incidents.synthetic = true
attachments.synthetic = true
```

### Scripts Idempotency

Demo seed script checks for existing `messageId` to prevent duplicates:
```typescript
const existing = await db.findByMessageId(messageId);
if (existing) {
  console.log(`Skipping ${messageId} (already exists)`);
  return;
}
```

---

## Fallback for Live Demo Failures

### If AI API Fails Mid-Demo

**Scenario:** Meta AI API returns 5xx or times out

**Fallback:**
1. Show circuit breaker open state in AI status card
2. Dashboard displays: "AI unavailable (circuit open)"
3. Demonstrate that SOS ingestion continues:
   - Create new SOS
   - Relay to server
   - Operator views case (no AI suggestion)
   - Operator manually assesses urgency
4. Explain: "This proves the core system works without AI dependency"

### If BLE Transfer Fails

**Scenario:** BLE pairing or transfer fails between Phone A and B

**Fallback:**
1. Show Phone A with **"LOCAL_SAVED"** status (still valid)
2. Explain: "Message is safely queued. It will retry when a relay comes in range."
3. Switch to pre-recorded BLE transfer video (if available)
4. Continue with online path (upload directly from Phone B)

### If Physical Devices Unavailable

**Scenario:** Only emulators or no physical phones

**Fallback:**
1. Use demo seed script to populate dashboard with synthetic SOSs
2. Show operator dashboard workflow only (skip mobile app demo)
3. State clearly: "Physical BLE mesh testing requires real devices. This demo uses pre-seeded data."

---

## Post-Demo Q&A Preparation

### Expected Questions

**Q: Does this replace 112/911?**  
A: No. SOSMesh is an experimental prototype for disaster scenarios when infrastructure fails. Always use official emergency services.

**Q: How accurate is Turkish voice transcription?**  
A: We've verified English accuracy in smoke tests. Turkish accuracy depends on Meta Voice Transcribe's language support. Live testing is pending but included in our roadmap.

**Q: Can relay devices read SOS content?**  
A: No. Relay devices see only the encrypted envelope with routing metadata (messageId, TTL, hop count). Only the backend server can decrypt the SOS content with the private key.

**Q: What happens if the AI budget is exhausted?**  
A: AI jobs are marked as "blocked_budget" and stop. However, SOS ingestion, operator dashboard, and manual triage continue working normally. The core system does not depend on AI.

**Q: How does SOSMesh handle false emergencies?**  
A: Operators review all cases before dispatching resources. AI provides urgency suggestions but does not auto-assign teams. Audit logs track all decisions.

**Q: Is the BLE mesh guaranteed to work?**  
A: No. BLE mesh depends on device density, platform background mode behavior (iOS force-quit limitations), and battery optimization settings. We document these limitations honestly in our README and do not overpromise coverage.

**Q: How much does it cost per incident?**  
A: Estimated costs based on smoke tests:
- Triage (text): ~$0.002
- Voice transcription: ~$0.18/hour of audio
- Photo segmentation: ~$0.01/image
- Fusion rationale: ~$0.001
Total for a multimodal incident (text + voice + photo): ~$0.20

**Q: How do you prevent prompt injection?**  
A: System prompts enforce grounding in source text and treat SOS content as untrusted user input. Models are instructed to never execute instructions from SOS messages. We use structured output with JSON schemas to constrain responses.

**Q: Can operators override AI decisions?**  
A: Yes. All AI outputs are labelled as "suggestions." Operators can accept, modify, or reject any AI assessment. The dashboard includes explicit "Override" buttons and audit logging.

**Q: What's next after the hackathon?**  
A: Post-hackathon priorities:
1. Complete physical BLE device testing (currently pending)
2. Performance benchmarks and load testing
3. iOS CI integration
4. Security audit (OWASP, penetration testing)
5. Offline AI with Muse Glimmer (on-device model)
6. Production deployment with HA/DR

---

## Technical Setup for Recording

### Equipment
- **Screen Recorder:** OBS Studio or macOS QuickTime
- **Resolution:** 1920x1080 (1080p)
- **Frame Rate:** 30 FPS
- **Audio:** External microphone for narrator voiceover
- **Editing:** DaVinci Resolve or iMovie (trim, add captions)

### Recording Checklist
- [ ] Close unnecessary browser tabs and desktop apps
- [ ] Hide bookmarks bar and dock (clean screen)
- [ ] Zoom browser to 100%
- [ ] Mute notifications (Do Not Disturb mode)
- [ ] Set display name in operator dashboard to "Demo Operator"
- [ ] Pre-load synthetic SOSs (run seed script before recording)
- [ ] Test BLE transfer with physical devices before live demo
- [ ] Have fallback pre-recorded clips ready

### Captions/Subtitles
- Add English captions for accessibility
- Highlight key terms: "Offline-first", "Multimodal AI", "Human-in-the-loop"
- Use callout boxes for important disclaimers

### Upload
- YouTube (unlisted or public)
- Hackathon submission portal (if direct upload supported)
- Include link in HACKATHON_SUBMISSION.md

---

## Demo Success Criteria

### Must Show
- ✅ Offline SOS creation (no internet)
- ✅ BLE relay transfer (encrypted)
- ✅ AI triage with Muse Spark (text analysis)
- ✅ Operator override workflow (human-in-the-loop)
- ✅ Synthetic data clearly labelled

### Nice to Have
- Voice note transcription (if API available)
- Photo segmentation with SAM overlay
- Signal fusion suggestion + confirmation
- Mission copilot query

### Must NOT Claim
- ❌ "Production-ready"
- ❌ "Guaranteed BLE mesh coverage"
- ❌ "Replaces 112/911"
- ❌ "AI makes rescue decisions"
- ❌ "All features fully tested" (be honest about pending tests)

---

**Demo Script Version:** 1.0  
**Last Updated:** 2026-11-03  
**Meta AI Hackathon 2026**
