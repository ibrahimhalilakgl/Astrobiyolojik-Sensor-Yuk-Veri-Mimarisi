# SENTİNEL — Astrobiyolojik Sensör Yükü Veri Mimarisi

> NASA **SMAP/MSL Anomaly Detection** veri setindeki MSL (Curiosity) kanallarından gelen telemetriyi **sıralı replay** ile üreten; uçta (edge) anomali skoru, öncelik, sıkıştırma ve **uplink kuyruğu** ile işleyen; PostgreSQL + WebSocket üzerinden ground station dashboard’unda canlı gösteren web uygulaması. Anomali skorunda veri setinin **önceden hesaplanmış LSTM smoothed error** (`.npy`) değerleri kullanılır; çalışma zamanında **TensorFlow/Keras veya `.h5` model yükleme yoktur**. Backend’de isteğe bağlı [NASA Open API](https://api.nasa.gov/) proxy uçları (`/api/nasa/*`) bulunur; arayüzde ayrı bir NASA canlı sayfası yoktur.

---

## 1. Proje Özeti

Bu proje, **NASA SMAP/MSL Anomaly Detection veri setindeki** MSL (Curiosity) telemetrisini **dosyadan sıralı replay** ederek şu süreçleri modellemek için kullanır:

1. **Veri toplama** — 12 MSL kanalından normalize edilmiş telemetri okuması
2. **Edge tamponlama** — Ring buffer ile dairesel veri depolama (500 okuma/kanal)
3. **Anomali tespiti** — Z-score + LSTM smoothed error hibrit yöntemiyle
4. **Bilimsel önceliklendirme** — Organik molekül (10/10) → Sıcaklık ekstremi (4/10)
5. **Bant optimizasyonu** — Skor eşiğine göre paket filtreleme + uplink yükü için **delta kodlama + zlib (DEFLATE)** ile gerçek ikili sıkıştırma (`compressor.py`)
6. **DSN iletimi + uplink kuyruğu** — Yüksek öncelikli okumalar `uplink_queue` tablosunda bekletilir; `uplink_drain_loop` periyodik olarak sınırlı sayıda paket “gönderilir” ve WebSocket ile güncellenir
7. **Ground station dashboard** — Gerçek zamanlı WebSocket ile canlı gösterim
8. **VERİ_AKIŞI ekranı** — 8 adımlı uçtan uca pipeline animasyonu (ayarlanabilir hız, ilerleme çubuğu, canlı `stats_update` metrikleri)

Bu liste, hackathon konusuyla uyumlu **uçtan uca edge + ground station** akışının yazılım prototipidir; canlı Mars bağlantısı veya uçta Keras çıkarımı içermez.

**Arayüz ve API belgeleri:** React panelleri ve OpenAPI (`/docs`) etiketleri Türkçe birincil dildir; sensör tipleri, JSON alan adları ve makine okumalı uçlar (ör. `GET /health`) uluslararası kısaltmalarla uyumludur.

### 1.1 Metodoloji, şeffaflık ve veri modeli

**Edge kararı ve ground truth**  
NASA veri setindeki etiketli anomali bölgeleri (`labeled_anomalies.csv`) simülatörde okunur ve her kayıtta `ground_truth_anomaly` alanına *yalnızca izleme / değerlendirme* için yazılır. **Edge işlemcisinde `is_anomaly` yalnızca skor tabanlıdır** (ör. eşik ≥ 50, LSTM smoothed error veya z-score türevi); veri seti etiketi karara **katılmaz** — böylece ground-truth leakage önlenir. Karşılaştırmalı analiz için DB’de hem edge çıktısı (`is_anomaly`) hem veri seti etiketi (`ground_truth_anomaly`) bir arada tutulur.

**Kanal izlenebilirliği**  
MSL kanal kimliği (`T-1`, `M-6`, `C-1`, …) `sensor_readings.channel_id` sütununda saklanır.

**Görev ve UI tutarlılığı**  
Telemetri kaynağı **MSL (Curiosity)** veri setidir. Harita ve yan metinler **Gale Krateri / Bradbury İniş** bölgesiyle uyumludur; Jezero veya Perseverance’a özgü enstrüman adları (ör. PIXL, SHERLOC) varsayılan anlatıda kullanılmaz; sensör açıklamaları REMS / SAM / ChemCam bağlamıyla hizalanır.

**VERİ_AKIŞI sayfası**  
Sekiz adımlı animasyon ve metinler **pedagojik şema / sahnelemedir**; gerçek rover uçuş yazılım yığınının birebir kopyası değildir. Sayısal metrikler mümkün olduğunca backend’deki canlı istatistiklere bağlanır.

**Veritabanı şeması**  
Tablolar **yalnızca Alembic** ile oluşturulur ve güncellenir (`alembic upgrade head`). Uygulama başlangıcında `metadata.create_all` **kullanılmaz**.

---

## 2. Veri Seti: NASA SMAP/MSL

### Kaynak
**NASA Anomaly Detection Dataset** — Kaggle üzerinden erişilebilir.  
Orijinal çalışma: *"Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding"* (Hundman et al., KDD 2018)

### İçerik

| Özellik | Değer |
|---------|-------|
| Uzay aracı | SMAP (uydu) + MSL (Curiosity rover) |
| Toplam kanal | 82 (54 SMAP + 28 MSL) |
| Veri formatı | `.npy` (NumPy dizileri), normalize [-1, 1] |
| Anomali etiketleri | `labeled_anomalies.csv` — ground truth |
| Anomali tipleri | Point anomaly, Contextual anomaly |
| Toplam veri noktası | ~496.444 telemetri değeri |
| Anomali sekansı | 105 etiketlenmiş anomali bölgesi |

### Kullanılan MSL Kanalları

| Kanal ID | Sensör Tipi | Açıklama | Veri Boyutu |
|----------|-------------|----------|-------------|
| T-1 | TEMP | Sıcaklık sensörü | 2875 × 25 |
| T-2 | TEMP | Termal kontrol | 2880 × 25 |
| P-10 | PRESS | Basınç sistemi | 6100 × 25 |
| P-14 | PRESS | Hidrolik basınç | 6100 × 25 |
| M-6 | CH4 | Metan dedektörü | 2049 × 55 |
| M-7 | MOIST | Nem sensörü | 2156 × 55 |
| C-1 | SPEC | Spektrometre A | 2264 × 55 |
| C-2 | SPEC | Spektrometre B | 2051 × 55 |
| D-14 | UV | UV radyasyon | 2625 × 55 |
| D-15 | O2 | Oksijen sensörü | 2158 × 55 |
| D-16 | CO2 | CO₂ sensörü | 2191 × 55 |
| F-7 | SPEC | FTIR spektroskopi | 5054 × 25 |

> Her kanalda ilk sütun telemetri değeri, kalan sütunlar komut one-hot encoding'leridir.

### Önceden Eğitilmiş LSTM Modeli (veri seti dosyaları)

**Çalışma zamanı:** Uygulama yalnızca `smoothed_errors/*.npy` (ve gerekirse z-score) kullanır; `.h5` dosyaları repoda **araştırma / eğitim mirası** olarak durur, backend bunları **yükleyip çıkarım yapmaz**.

Veri seti içinde eğitilmiş LSTM modeli ve türev çıktılar bulunur:

| Dosya | Açıklama |
|-------|----------|
| `models/*.h5` | Her kanal için eğitilmiş Keras LSTM modeli |
| `y_hat/*.npy` | LSTM tahmin çıktıları (beklenen değerler) |
| `smoothed_errors/*.npy` | Düzeltilmiş hata skorları (anomali göstergesi) |
| `params.log` | Model hiperparametreleri ve performans metrikleri |

#### LSTM Model Parametreleri

```
Katmanlar:        2 × LSTM (80 birim)
Batch size:       70
Epochs:           35
Dropout:          0.3
Optimizer:        Adam
Loss:             MSE (Mean Squared Error)
Sequence length:  250
Window size:      30
Smoothing:        %5
Validation split: %20
```

#### Model Performansı (Tüm 82 kanal)

```
True Positives:   84
False Positives:  11
False Negatives:  21
Precision:        %88.4
Recall:           %80.0
```

---

## 3. Sistem Mimarisi

```
KATMAN 1 — SENSOR LAYER
  MSL .npy replay (12 kanal) ─────────────────────────────────────────────┐
                                                                          │
KATMAN 2 — ROVER / EDGE 1                                                 ▼
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Ring buffer (500/kanal) · LSTM/z + River HalfSpaceTrees hibrit skor │
  │ Novelty (cosine, son 1000 vektör) · is_novel → öncelik +2           │
  │ EnergyController: batarya simülasyonu → eşik + zlib seviyesi      │
  │ RLAgent (Q-tablo ε-greedy) → eşik ince ayarı · pickle kalıcılık     │
  │ Filtre: skor < eşik DROP · skor ≥ eşik → uplink_queue + orbiter_queue│
  │ Delta + zlib DEFLATE (uplink drain anında)                           │
  └───────────────────────────────┬──────────────────────────────────────┘
                                  │ DSN uplink (10s) · orbiter drain (15s)
                                  ▼
KATMAN 3 — ORBITER / EDGE 2
  ┌──────────────────────────────────────────────────────────────────────┐
  │ orbiter_queue → skor < 40 DROP · 30 sn batch pencere                │
  │ relay_latency_ms, pass_id · orbiter_relay_log · WS orbiter_stats    │
  └───────────────────────────────┬──────────────────────────────────────┘
                                  │ (simüle downlink)
                                  ▼
KATMAN 4 — EARTH / CLOUD (simüle)
  ┌──────────────────────────────────────────────────────────────────────┐
  │ Her 20 orbiter batch’te model_updates (eşik önerisi, federated round)│
  │ RL epsilon geri beslemesi · WS model_update                          │
  └───────────────────────────────┬──────────────────────────────────────┘
                                  ▼
GROUND STATION (FastAPI + PostgreSQL + WebSocket + React)
  sensor_readings · anomaly_events · transmission_log · uplink_queue ·
  orbiter_queue · orbiter_relay_log · model_updates · NASA proxy
```

---

## 4. Algoritmalar — Adım Adım

### Adım 1: Veri Toplama (`simulator.py`)

NASA MSL test verisi `.npy` dosyalarından sıralı olarak okunur. Her 2 saniyede 12 kanaldan birer okuma yapılır.

```python
raw_value = float(channel_data[cursor, 0])  # İlk sütun = telemetri
cursor += 1  # Sıralı replay
```

Aynı anda `labeled_anomalies.csv`'den o timestep'in gerçek anomali olup olmadığı kontrol edilir. Bu ground truth, edge processor'un doğruluğunu ölçmek için kullanılır.

### Adım 2: Edge Tamponlama

Her sensör tipi için son 500 okuma ring buffer'da tutulur. Bu buffer, z-score hesaplaması için istatistiksel referans sağlar.

### Adım 3: Anomali Skoru Hesaplama (`edge_processor.py`)

**Hibrit yaklaşım** — iki yöntem birlikte kullanılır:

#### Yöntem A: LSTM Smoothed Error (Birincil)

Veri setinde önceden hesaplanmış `smoothed_errors` `.npy` dosyaları varsa doğrudan kullanılır (Keras çalıştırılmaz):

```
anomaly_score = min(100, smoothed_error × 300)
```

Bu değer, LSTM modelinin tahmin hatasının düzeltilmiş versiyonudur. Yüksek hata = beklentiden sapma = anomali.

#### Yöntem B: Z-Score (Yedek)

Smoothed error yoksa klasik istatistiksel yöntem:

```
z_score = |değer - ortalama| / standart_sapma
anomaly_score = min(100, z_score × 25)
```

### Adım 4: Karar Motoru

| Anomali Skoru | Durum | Aksiyon |
|---------------|-------|---------|
| < 30 | Normal | Filtrelenir, iletilmez |
| 30 — 50 | Şüpheli | Buffer'da bekletilir |
| ≥ 50 | Anomali | Hemen iletilir (TX) |

### Adım 5: Anomali Sınıflandırma

Tespit edilen anomaliler bilimsel önemlerine göre sınıflandırılır:

| Anomali Tipi | Tetikleyen Sensör | Bilimsel Öncelik |
|-------------|-------------------|-----------------|
| Organik Molekül İmzası | 3+ sensör aynı anda anomali | 10/10 |
| Metan Spike | CH4 (M-6) | 8/10 |
| Spektral Sapma | SPEC (C-1, C-2, F-7) | 7/10 |
| Nem Anomalisi | MOIST (M-7) | 6/10 |
| Radyasyon Anomalisi | UV (D-14) | 5/10 |
| Atmosferik Anomali | O2, CO2 (D-15, D-16) | 5/10 |
| Basınç Anomalisi | PRESS (P-10, P-14) | 4/10 |
| Sıcaklık Ekstremi | TEMP (T-1, T-2) | 4/10 |

### Adım 6: Bant Genişliği Optimizasyonu + İkili Sıkıştırma (`compressor.py`)

**Filtreleme:** Skor ≥ 50 olan okumalar `is_transmitted=True` ile işaretlenir; düşük skorlular iletilmez. Paket başına **256 byte** varsayımıyla filtre tasarrufu hesaplanır:

```
tasarruf_filtre = (1 - iletilen_paket / toplam_paket) × 100
```

**Sıkıştırma (gerçek codec):** Her batch’te yalnızca iletilecek kayıtlar üzerinde:

1. `raw_value` ve `anomaly_score` çiftleri **little-endian float64** olarak ardışık paketlenir.
2. **Delta kodlama:** İlk değer aynen kalır; sonraki örnekler bir öncekine göre fark olarak yazılır (düz telemetride entropi azalır).
3. **zlib.compress(level=6)** — DEFLATE tabanlı sıkıştırma (standart kütüphane; uzay telemetrisinde kullanılan Rice/Huffman tarzı kayıpsız kodlamanın karşılığı olarak düşünülebilir).

`edge_processor.process_batch` bu yükü üretir; `get_stats()` ve WebSocket `stats_update` ile birlikte şu alanlar yayınlanır:

| Alan | Anlamı |
|------|--------|
| `payload_serialized_bytes` | Uplink için paketlenmiş ham byte (kümülatif) |
| `payload_deflated_bytes` | zlib sonrası byte (kümülatif) |
| `payload_deflate_ratio` | sıkıştırılmış / ham (0–1) |
| `payload_deflate_savings_percent` | (1 − oran) × 100 |
| `last_batch_payload_bytes` / `last_batch_deflated_bytes` | Son batch özet |

> Veritabanındaki `transmission_log.compression_ratio` sütunu **paket iletim oranını** (iletilen / toplam) ifade eder; DEFLATE oranı yalnızca API/WebSocket istatistiklerindedir.

### Adım 7: Dashboard Gösterimi

İletilen veriler WebSocket üzerinden React dashboard'a aktarılır:

```json
{"type": "sensor_reading", "data": {...}}       // Simülasyon veya uplink’ten gelen okuma
{"type": "anomaly_alert", "data": {...}}        // Anomali tespiti
{"type": "stats_update", "data": {...}}         // ~5 s: DB özet + edge istatistikleri + rover + uplink_queue
{"type": "uplink_queue_update", "data": {...}}  // Kuyruk drain sonrası güncel snapshot
{"type": "orbiter_stats", "data": {...}}        // Orbiter Edge2 özet metrikleri
{"type": "model_update", "data": {...}}         // Earth/Cloud model önerisi (federated)
// stats_update içi: river_stats, energy_stats, rl_stats (ayrıca tek başına energy_stats / rl_stats WS ile de gelebilir)
```

---

## 5. Teknoloji Stack

| Katman | Teknoloji | Kullanım |
|--------|-----------|----------|
| Backend | Python 3.11+, FastAPI | REST API + WebSocket |
| HTTP istemcisi | httpx | NASA Open API proxy (`/api/nasa/*`) |
| ORM | SQLAlchemy (async) | PostgreSQL bağlantısı |
| Veritabanı | PostgreSQL 16 | Zaman serisi depolama |
| Migration | Alembic | Şema yönetimi |
| Veri İşleme | NumPy, Pandas | NASA .npy okuma, istatistik |
| Anomali sinyali | LSTM pipeline çıktısı (`.npy`) | `smoothed_errors`; `.h5` yalnızca veri setinde, runtime’da yok |
| Frontend | React 18, Vite | SPA dashboard |
| Grafik | Recharts | Zaman serisi görselleştirme |
| Stil | Tailwind CSS | Cyberpunk neon tema |
| Konteyner | Docker Compose | PostgreSQL |

---

## 6. API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/health` | Sistem sağlık kontrolü |
| GET | `/api/sensor-data` | Son okumalar (`skip`, `limit`, isteğe bağlı `sensor_type`) |
| GET | `/api/sensor-data/stats` | Sensör tipi istatistikleri |
| GET | `/api/sensor-data/{id}` | Tek okuma detayı (UUID) |
| POST | `/api/sensor-data/simulate` | Manuel simülasyon batch’i (tek istekte çoklu okuma) |
| GET | `/api/anomalies` | Anomali listesi (`severity`, `acknowledged`, sayfalama) |
| GET | `/api/anomalies/recent` | Son 10 anomali |
| GET | `/api/anomalies/stats` | Anomali tipi dağılımı |
| GET | `/api/anomalies/{id}/detail` | İlişkili sensör okuması ile anomali detayı |
| PATCH | `/api/anomalies/{id}/acknowledge` | Anomaliyi onayla |
| GET | `/api/uplink-queue` | Uplink kuyruğu anlık görünümü (snapshot) |
| GET | `/api/nasa/apod` | APOD proxy (`date` isteğe bağlı); `NASA_API_KEY` gerekir |
| GET | `/api/nasa/mars-photos/{rover}` | Mars fotoğrafları (`earth_date` veya `sol`, `camera`, `page`) |
| GET | `/api/nasa/mars-photos-recent/{rover}` | Manifest’ten en güncel sol’lara göre son N fotoğraf (`limit`) |
| GET | `/api/orbiter-log` | Orbiter relay log kayıtları |
| GET | `/api/model-updates` | Earth/Cloud simülasyonu `model_updates` geçmişi |
| GET | `/api/settings/rover-thinking` | Groq düşünce modu açık/kapalı |
| PATCH | `/api/settings/rover-thinking` | Gövde: `{"enabled": true}` veya `false` — düşünce çağrılarını durdur/başlat |
| WS | `/ws/live-feed` | Gerçek zamanlı akış (aşağıdaki mesaj tipleri) |

---

## 7. Dashboard Sayfaları

Sayfalar **React Router** ile yönetilir. **Ana sayfa** (`/`) 3D veri akışı özeti ve yapay zekâ bölümü içerir; **operasyon paneli** `/gosterge_paneli` ve diğer yollar altındadır. Doğrudan URL veya yenilemede nginx’in `try_files $uri $uri/ /index.html;` kullanması gerekir — örnek: `nginx-spa-fragment.conf`.

| Sayfa | URL yolu | İçerik |
|-------|----------|--------|
| ANA_SAYFA | `/` | Yumuşak tema, 3D uçtan uca akış şeması, AI analiz/eğitim özeti; panele geçiş bağlantıları |
| GÖSTERGE_PANELİ | `/gosterge_paneli` | Metrik kartları, anomali grafiği, bant göstergesi, ham veri akışı tablosu (sütunlarda kanal, TX = iletilmiş) |
| VERİ_AKIŞI | `/veri_akisi` | 8 adım: pedagojik pipeline (canvas animasyon, hız, ilerleme); canlı `stats_update` metrikleri |
| ANOMALİ_TESPİT | `/anomali_tespit` | Alarm merkezi — severity filtre, onaylama, detay |
| SENSÖR_DETAY | `/sensor_detay` | Sensör bazlı özet ve anomali bağlamı |
| TELEMETRİ | `/telemetri` | Canlı telemetri görünümü |
| ROVER_HARİTA | `/rover_harita` | Rover konum / harita bağlamı |
| İLETİM_ANALİZİ | `/iletim_analizi` | Paket iletimi, bant tasarrufu, delta + DEFLATE özeti |
| UPLINK_KUYRUĞU | `/uplink_kuyrugu` | Bekleyen / gönderilen uplink kuyruğu (`stats.uplink_queue`) |
| ORBITER_RÖLE | `/orbiter_role` | Orbiter Edge2: kuyruk, 30 sn pencere, düşük skor (eşik 40) paket düşürme, `orbiter_stats` |
| YER_İSTASYONU_BULUT | `/yer_istasyonu_bulut` | Earth/Cloud: 20 relay batch sonrası `model_update`, RL epsilon geri beslemesi |
| VERİ_SETİ | `/veri_seti` | Veri seti bilgi paneli |
| ROVER_ZEKASİ | `/rover_zekasi` | Groq rover düşünce akışı (`rover_thinking` WS) |

---

## 8. Veritabanı Şeması

### sensor_readings
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| sensor_type | VARCHAR(10) | TEMP, CH4, O2, CO2, MOIST, SPEC, UV, PRESS |
| channel_id | VARCHAR(20) | MSL kanal kimliği (örn. T-1, M-6); izlenebilirlik |
| raw_value | FLOAT | Normalize telemetri değeri [-1, 1] |
| unit | VARCHAR(20) | Ölçü birimi |
| anomaly_score | FLOAT | 0-100 arası hesaplanan skor |
| is_anomaly | BOOLEAN | Edge kararı (yalnızca skor tabanlı; etiket sızması yok) |
| ground_truth_anomaly | BOOLEAN | Veri seti etiketi (değerlendirme; edge kararına dahil değil) |
| is_transmitted | BOOLEAN | DSN üzerinden iletildi mi |
| location_lat | FLOAT | Rover Mars koordinatı |
| location_lon | FLOAT | Rover Mars koordinatı |
| sol | INTEGER | Mars günü sayacı |
| created_at | TIMESTAMPTZ | Oluşturulma zamanı |

### anomaly_events
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| reading_id | UUID | FK → sensor_readings |
| anomaly_type | VARCHAR(30) | organic_molecule, methane_spike, vb. |
| severity | VARCHAR(10) | CRITICAL, HIGH, MEDIUM, LOW |
| description | TEXT | Türkçe anomali açıklaması |
| scientific_priority | INTEGER | 1-10 bilimsel öncelik |
| acknowledged | BOOLEAN | Bilim insanı onayı |
| created_at | TIMESTAMPTZ | Tespit zamanı |

### transmission_log
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| batch_id | UUID | İletim grubu |
| total_packets | INTEGER | Toplam paket |
| transmitted_packets | INTEGER | İletilen paket |
| bytes_saved | BIGINT | Tasarruf edilen byte |
| compression_ratio | FLOAT | Paket iletim oranı (iletilen / toplam); DEFLATE oranı değildir |
| transmission_window | VARCHAR(50) | DSN istasyonu |
| created_at | TIMESTAMPTZ | İletim zamanı |

---

## 9. Hızlı Başlangıç

### 1. PostgreSQL Başlat
```bash
docker-compose up -d
```

### 2. Ortam değişkenleri

`backend/.env` (`.env.example` şablonu):

| Değişken | Açıklama |
|----------|----------|
| `DATABASE_URL` | Zorunlu: async uygulama (`postgresql+asyncpg://...`) |
| `DATABASE_URL_SYNC` | Örnek dosyada yer alır; Alembic bu repoda varsayılan olarak `alembic.ini` içindeki `sqlalchemy.url` ile çalışır |
| `NASA_API_KEY` | İsteğe bağlı; boşsa `/api/nasa/*` 503 döner |

### 3. Backend Kurulumu
```bash
cd backend
pip install -r requirements.txt
```

### 4. Veritabanı migration (zorunlu)
Şema yalnızca Alembic ile güncellenir; sunucuyu başlatmadan önce:
```bash
cd backend
alembic upgrade head
```

### 5. Backend Sunucu
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 6. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 7. Aç
Tarayıcıda [http://localhost:5173](http://localhost:5173). Geliştirmede `vite.config.js` `/api` ve `/ws` isteklerini `http://localhost:8000` adresine yönlendirir. `main.py` içindeki CORS listesi varsayılan olarak yalnızca `localhost:5173` / `127.0.0.1:5173` içindir; üretimde genelde nginx ile aynı kökenden servis edilir.

---

## 10. Dosya Yapısı

```
mars-rover-dashboard/
├── backend/
│   ├── main.py                 # FastAPI, lifespan: simülasyon + stats + uplink drain; CORS
│   ├── database.py             # Async engine, session, load_dotenv
│   ├── models.py               # sensor_readings, anomaly_events, transmission_log, uplink_queue
│   ├── schemas.py              # Pydantic şemalar
│   ├── crud.py                 # CRUD, istatistikler, uplink drain
│   ├── simulator.py            # MSL test .npy replay, rover durumu
│   ├── edge_processor.py     # Anomali skoru, iletim kararı, batch codec metrikleri
│   ├── compressor.py           # Delta + zlib DEFLATE
│   ├── requirements.txt
│   ├── .env.example
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/           # 001_initial_schema, 002_uplink_queue, 003_channel_ground_truth
│   ├── routers/
│   │   ├── sensor_data.py
│   │   ├── anomalies.py
│   │   ├── uplink_queue.py
│   │   ├── nasa.py             # NASA Open API proxy
│   │   └── websocket.py
│   └── data/                   # NASA SMAP/MSL veri seti (replay + smoothed_errors, .h5 mirası)
│       ├── train/
│       ├── test/
│       ├── labeled_anomalies.csv
│       └── 2018-05-19_15.00.10/
│           ├── models/         # .h5 (runtime kullanılmaz)
│           ├── y_hat/
│           ├── smoothed_errors/
│           └── params.log
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MetricCards.jsx
│   │   │   ├── AnomalyChart.jsx
│   │   │   ├── LiveStreamTable.jsx
│   │   │   ├── BandwidthGauge.jsx
│   │   │   ├── AlertCenter.jsx
│   │   │   ├── PipelineAnimation.jsx
│   │   │   ├── SensorDetail.jsx
│   │   │   ├── RoverMap.jsx
│   │   │   ├── Telemetry.jsx
│   │   │   ├── TransmissionLog.jsx
│   │   │   ├── UplinkQueue.jsx
│   │   │   ├── DatasetInfo.jsx
│   │   │   ├── RoverThinking.jsx
│   │   │   └── ConnectionStatus.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useAnomalyData.js
│   │   └── utils/formatters.js
│   ├── vite.config.js          # /api ve /ws → localhost:8000 proxy
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml            # PostgreSQL
├── deploy_sync.py                # Önerilen: yerel npm build + SFTP + pip + alembic + systemd (host/credentials ayrı dosyada)
├── deploy_fast.py                # Alternatif paramiko senaryoları (eski/paralel)
├── deploy_fix5.py                # Sunucu sabitleri (güvenlik: repoda parola tutmayın)
└── README.md
```

### Üretim sunucusuna yükleme

1. **`deploy_sync.py` (güncel akış):** Yerelde `npm run build` çalıştırır; `backend` + `frontend/dist` ve kaynak aynasını SFTP ile yükler; uzakta `venv` veya Miniconda `pip` ile `requirements.txt` kurar; `alembic upgrade head`; systemd birimi (ör. `nirvana`) ve nginx yeniden başlatılır. Ürün arayüz adı **SENTİNEL**; sunucu dizini örneği `/opt/nirvana/` tarihsel kurulumla uyumludur. Yerel `backend/.env` varsa `/opt/nirvana/backend/.env` olarak kopyalanır; `EnvironmentFile=-/opt/nirvana/backend/.env` eklenir.
2. Sunucu adresi / SSH kimlik bilgileri **`deploy_fix5.py` veya ortam değişkeni** ile yönetilmeli; **parolayı repoya gömmeyin**.
3. `NASA_API_KEY` yalnızca `/api/nasa/*` proxy’sini kullanacaksanız `.env` içinde tanımlayın (dashboard’da bu uçlara bağlı sayfa yoktur).

---

## 11. Referanslar

1. Hundman, K. et al. (2018). *Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding.* KDD 2018.
2. NASA SMAP/MSL Anomaly Detection Dataset — Kaggle.
3. NASA Perseverance Science Instruments — science.nasa.gov
4. Ground Processing of Data From the Mars Exploration Rovers — NASA NTRS.
5. IP in Deep Space: Key Characteristics — IETF Draft.
6. [NASA Open APIs](https://api.nasa.gov/) — APOD ve Mars Rover Photos (isteğe bağlı backend proxy: `/api/nasa/*`).
