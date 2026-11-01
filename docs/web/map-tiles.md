# Web harita döşemeleri (OpenStreetMap)

## Lisans ve atıf

Raster döşemeler varsayılan olarak [OpenStreetMap](https://www.openstreetmap.org/copyright) katkıcıları verisine dayanır. Operatör haritasında atıf metni görünür tutulur (`© OpenStreetMap contributors`).

## Yapılandırma

- `NEXT_PUBLIC_MAP_TILE_URL` — XYZ şablonu (varsayılan: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`). API anahtarı repoda tutulmaz.
- `NEXT_PUBLIC_MAP_TEST_MODE=1` — CI/E2E/ birim testlerinde dış tile sunucusuna bağlanmadan boş yerel stil kullanılır.

## tile.openstreetmap.org kullanım politikası

OpenStreetMap Foundation, `tile.openstreetmap.org` hizmetinin **yoğun veya üretim trafiği** için uygun olmadığını belirtir. Üretim ortamında kendi tile sunucunuzu, onaylı üçüncü taraf sağlayıcıyı veya barındırdığınız raster/vektör kaynağı kullanmalısınız. Bu adım geliştirme ve test için varsayılan public tile URL’sini yapılandırılabilir bırakır; prod kurulumu ayrı kapıdır.

## Sentetik koordinatlar

Seed, fixture ve E2E verileri yalnızca sentetik koordinatlar kullanır; gerçek GPS veya PII repoya yazılmaz.
