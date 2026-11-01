# SOSMesh Wear OS (ADIM 35–36)

Wear OS uygulaması Gradle modülü: `apps/android/wear` (`:wear`).

Telefon tarafı companion alıcısı: `apps/android/core/wear-companion` (`:core:wear-companion`), ana Android uygulamasına (`:app`) bağlıdır.

Durum senkronu ve offline kuyruk politikası: `docs/watches/wear-policy.md` ve `apps/wearos/state-sync/README.md`.

Gerçek saat / eşleşmiş telefon doğrulaması bu PR kapsamında **NOT_TESTED** (B-04); birim testleri ve CI Gradle derlemesi kanıt sağlar.
