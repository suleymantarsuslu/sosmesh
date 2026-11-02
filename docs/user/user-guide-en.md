# SOSMesh User Guide (English)

**Version:** ADIM 57 draft  
**Status:** Documentation ready; physical field verification `NOT_TESTED`

---

## This app does not replace official emergency services (112)

SOSMesh is an experimental emergency mesh communication prototype. **In an emergency, call 112 (or your local emergency number).** In-app status updates are technical delivery information only; they **do not guarantee** help, response, or operator action.

---

## Offline use

| Topic | Explanation |
| --- | --- |
| **What works** | SOS is stored in an encrypted on-device queue; nearby transfer is attempted over BLE (**no AI required**). |
| **What does not** | Without internet there is no server or operator panel path; peer ACK is **not** server acceptance. |
| **Expectation** | Range depends on environment and battery; continuous background mesh is **not guaranteed**. |

---

## Permissions

| Permission | Why | If denied |
| --- | --- | --- |
| **Bluetooth** | Peer discovery and transfer | Nearby transfer stops; record stays on device |
| **Location (Android scan)** | BLE scan policy (Android 12+) | Scanning is limited |
| **Notifications** | Foreground mesh notice (Android 13+) | Less user visibility |

Fix via in-app permission flow or system settings. See [`docs/android/permission-guide.md`](../android/permission-guide.md).

---

## Volunteer relay (opt-in)

- **Default:** Off.
- **What you do:** Optionally carry encrypted packets to the internet.
- **Privacy:** Relay nodes **do not read SOS plaintext or location**; they carry ciphertext envelopes only.
- **Battery / data:** Limits apply; relay may pause on low battery.
- **Opt-out:** Turn off anytime in settings or the relay screen.

---

## Watch with paired phone (Wear OS / watchOS)

| Platform | Behavior |
| --- | --- |
| **Wear OS** | Watch sends SOS to paired phone; phone attempts server path. **No standalone watch mesh guarantee.** |
| **watchOS** | SOS goes through paired iPhone; if phone unreachable, queue/wait — **no “reached server” claim on watch alone.** |

See [`docs/tests/watchos-matrix.md`](../tests/watchos-matrix.md) (device evidence `NOT_TESTED`).

---

## Five ACK / status levels

The timeline shows **technical delivery stages**:

| Level | User meaning | **Does not mean** |
| --- | --- | --- |
| 1 — Saved on device | SOS in local secure queue | Operator or team saw it |
| 2 — Transferred to peer | Another device received the packet | **Peer ACK ≠ operator read** |
| 3 — Reached server | Ingest accepted over internet | Automatic rescue started |
| 4 — Operator viewed | Shown in operator panel | Intervention or SLA promise |
| 5 — Case in progress | Operator workflow started | Help is on the way |

---

## If delivery fails

1. **Call 112** — the app is not a substitute.
2. Check **Message status** for the last error code (if shown).
3. Verify **Bluetooth and permissions**; avoid force-quit (especially on iOS).
4. **Nearby devices / relay:** Without another user or volunteer relay, delivery may wait.
5. **Avoid spam:** Do not send many duplicate SOS for the same incident.
6. **When internet returns:** Upload may retry; **not guaranteed**.

---

## Troubleshooting

| Symptom | Likely cause | Suggestion |
| --- | --- | --- |
| No nearby device | Range, BT off, permissions | Enable BT, move to open area |
| Not reaching server | No internet, relay off | Mobile data/Wi‑Fi; opt-in relay |
| Stuck status | Apple background limits | Keep app foreground; force-quit may stop mesh |
| Relay stopped | Low battery / power save | Charge; SOS remains on device |

---

## Known limitations

- **Apple:** Background BLE and behavior after force-quit **not guaranteed** (`docs/research/ios-multihop.md`).
- **Watch:** No claim of standalone mesh or 24/7 relay.
- **Real device tests:** Android 12–16, iOS physical matrix — **`NOT_TESTED`** (emulator/simulator does not count as field PASS).
- **Store release:** Play / App Store / TestFlight — **`BLOCKED_APPROVAL`**.

---

## Privacy and support

- Privacy draft: [`docs/legal/privacy-policy-draft.md`](../legal/privacy-policy-draft.md)
- Terms draft: [`docs/legal/terms-of-use-draft.md`](../legal/terms-of-use-draft.md)
- Security reports: [`SECURITY.md`](../../SECURITY.md) (`TODO_APPROVAL` email placeholder)
- Operator web help: **Help** in the operator panel

---

## In-app copy

Mobile help string resources: [`mobile-help-strings.md`](mobile-help-strings.md).  
A dedicated full-screen help UI is not wired yet; strings align with Settings / onboarding.
