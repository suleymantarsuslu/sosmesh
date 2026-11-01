# Hackathon demo storyboard (2–3 dk)

**Video durumu:** Kayıt videosu **henüz yok**. Aşağıdaki akış, fiziksel M0 testi (`docs/tests/m0-physical-report.md`) tamamlandığında çekilecek; mesh-simulator veya Playwright mock **gerçek cihaz diye sunulmaz**.

## Sahne 1 — Bağlantı kesildi (15 sn)

- Görsel: Telefon A uçak modu, “İnternet yok” / offline rozeti.
- Anlatım: Resmî acil hat (112) yerine geçmediğimizi hatırlat; SOS yine de cihazda kaydedilir.

## Sahne 2 — Offline SOS (25 sn)

- A: SOS formu → onay → **LOCAL_SAVED** zaman çizelgesi (yeşil “kurtarma” yok).

## Sahne 3 — Telefon B geçişi (35 sn)

- B: Röle açık, BLE keşif → aktarım → A’da **PEER_RECEIVED** (peer ACK ≠ operatör okudu).
- B: Upload → **SERVER_ACCEPTED** (imzalı makbuz).

## Sahne 4 — Operatör paneli (40 sn)

- Web: Canlı liste/harita → vaka seçimi → ayrıntı → **OPERATOR_SEEN**.
- AI varsa: “öneri/taslak, doğrulanmadı” rozeti; yoksa BLOCKED_SECRET açıklaması.

## Sahne 5 — Kapanış (15 sn)

- Sınırlamalar: Apple arka plan, mesh garantisi yok; DEMO MODE mock yedek ayrı gösterilir.

## Yedek (mock) demo

`OPERATOR_E2E_MOCK=1` ile web panelinde **DEMO MODE** bandı; production build’de mock devre dışı (test: `apps/web/lib/config.test.ts`).
