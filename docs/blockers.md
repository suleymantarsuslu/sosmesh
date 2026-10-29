# SOSMesh — Blokajlar (ADIM 01; yalnız kanıtlananlar)

| # | Blokaj | Etiket | Kanıt | Gereken |
|---|---|---|---|---|
| B-01 | SOSMesh için GitHub/Origin repo yok; oluşturma onaysız yapılmadı | BLOCKED_APPROVAL | GitHub arama 0 sonuç; Origin `list_namespaces` boş | Kullanıcı: repo adı/sahibi/görünürlük (private önerilir) |
| B-02 | Bağlı fiziksel Android cihaz yok (M0 için 2 gerçek Android şart) | BLOCKED_DEVICE | `adb devices -l` boş | 2 Android telefon (BLE 5, Android 12+ önerilir), USB hata ayıklama |
| B-03 | iPhone'lar OFFLINE (iOS 26.6.1, 27.2) | BLOCKED_DEVICE | `xctrace list devices` → Offline | Kablo/Wi-Fi ile bağla, geliştirici modu, güven |
| B-04 | Wear OS ve Apple Watch cihazı/simülatörü doğrulanmadı | BLOCKED_DEVICE | listede yok / test edilmedi | Gerçek saatler (ADIM 35–39, 52–53) |
| B-05 | Meta Model API anahtarı (`MODEL_API_KEY`) doğrulanmadı; kutuda yalnız `META_APP_ID`, `META_APP_SECRET` adı var | BLOCKED_SECRET | env isimleri | Kullanıcı: anahtarın doğru tür/limit olduğunu onaylasın; değer paylaşılmaz, secret manager ile |
| B-06 | Apple Developer / Google Play hesabı ve imzalama erişimi doğrulanmadı | BLOCKED_APPROVAL | kanıt yok | Kullanıcı hesapları; TestFlight/Play başvurusu onay işlemi |
| B-07 | Bütçe/harcama limiti bilinmiyor | BLOCKED_APPROVAL | kayıt yok | Kullanıcı: aylık USD limiti, AI günlük limit (şablon: 5 USD/gün) |
| B-08 | Docker daemon Mac'te kapalı; kutuda Docker yok | NOT_TESTED/BLOCKED | `docker info` hata | Docker Desktop başlatma (kullanıcı) veya CI/cloud ortamı |
| B-09 | Android Studio yok; Mac aktif JDK 11 (AGP için yetersiz olabilir), JDK 26 da kurulu | Risk (kanıtlanmadı) | `java -version`, `java_home -V` | ADIM 12'de JDK 17 toolchain belirleme |
| B-10 | Grok→Cursor otomasyon yolu | RESOLVED | access-inventory §6 | Cloud Agent API doğrulandı; launch ADIM 01 commit'iyle kanıtlanır |
| B-13 | SOSMesh için Mac private worker yok (iOS/watchOS derleme) | BLOCKED_DEVICE | CloudAgent workers listesi | Kullanıcı SOSMesh repo klasöründe Cursor worker başlatmalı (ADIM 31 öncesi) |
| B-14 | Keşif sırasında Mac'te başlatılan `xcrun simctl list runtimes` süreci temizlenemedi, Mac çevrimdışı oldu | OPEN | evidence/user-mac-inventory.txt | Kullanıcı Mac'i kontrol etmeli; gerekirse süreci kapatmalı |
| B-11 | `gh` hem kutuda hem Mac'te giriş yapmamış | Bilgi | `gh auth status` | Git işlemleri MCP/cloud agent üzerinden |
| B-12 | `xcrun simctl list runtimes` Mac'te zaman aşımı | NOT_TESTED | komut dönmedi | Gerekirse yeniden dene |
