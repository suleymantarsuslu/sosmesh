# SOSMesh Test Lab Matrix (ADIM 11)

Simülatör sonuçları **gerçek BLE cihaz kanıtı değildir**. Tüm `tools/mesh-simulator` trace çıktıları `environment: "simulated"` taşır.

| Senaryo | Simülatör (CI) | Gerçek cihaz |
| --- | --- | --- |
| Tek hop transfer (Sender/Receiver + MockChannel) | PASS (`@sosmesh/chaos-tests`) | NOT_TESTED |
| %30 paket kaybı + duplicate + reorder + partial write | PASS | NOT_TESTED |
| MTU 23 (ATT sınırı) | PASS (strict: doğrulanmamış teslim COMPLETED sayılmaz) | NOT_TESTED |
| 100 ardışık seed batch (10_000–10_099) | PASS (36 başarı / 64 başarısız, deterministik) | NOT_TESTED |
| Çok hop A→B→C röle (opak ciphertext) | PASS | NOT_TESTED |
| TTL aşımında düşürme | PASS | NOT_TESTED |
| Bozuk paket / sahte success negatif | PASS | NOT_TESTED |
| Outbox düşük batarya pause (ADIM 10) | PASS | NOT_TESTED |
| GPS yok / çok dilli sentetik fixture | PASS | NOT_TESTED |
| Trace JSON şema + golden | PASS (`mesh-sim-golden`) | NOT_TESTED |

## Kanıt komutları

```bash
pnpm --filter @sosmesh/chaos-tests test --reporter=verbose
bash scripts/mesh-sim-golden.sh
```

## UX / a11y

- Web ve UX içerik taraması, simülasyon PASS sonucunu fiziksel BLE kanıtı gibi sunmayı yasaklar (`scripts/ux-forbidden-copy.js`).
