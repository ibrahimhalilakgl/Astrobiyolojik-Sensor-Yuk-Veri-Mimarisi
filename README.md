# NIRVANA — Astrobiyolojik Sensör Yükü Veri Mimarisi

> NASA'nın gerçek Mars Science Laboratory (Curiosity) rover telemetri verisini Edge Computing mantığıyla işleyen, LSTM tabanlı anomali tespit eden ve ground station dashboard'unda canlı gösteren web uygulaması.

---

## 1. Proje Özeti

Bu proje, Mars rover'ından gelen **gerçek NASA telemetri verisini** (SMAP/MSL veri seti) kullanarak:

1. **Veri toplama** — 12 MSL kanalından normalize edilmiş telemetri okuması
2. **Edge tamponlama** — Ring buffer ile dairesel veri depolama (500 okuma/kanal)
3. **Anomali tespiti** — Z-score + LSTM smoothed error hibrit yöntemiyle
4. **Bilimsel önceliklendirme** — Organik molekül (10/10) → Sıcaklık ekstremi (4/10)
5. **Bant genişliği sıkıştırma** — Sadece anomali verileri iletme (%85+ tasarruf)
6. **DSN iletimi** — Deep Space Network pencere simülasyonu
7. **Ground station dashboard** — Gerçek zamanlı WebSocket ile canlı gösterim

süreçlerini uçtan uca simüle eder.

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

### Önceden Eğitilmiş LSTM Modeli

Veri seti içinde NASA'nın eğittiği LSTM modeli ve çıktıları bulunur:

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
┌─────────────────────────────────────────────────────────────────┐
│                    MARS ROVER (EDGE KATMANI)                    │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ NASA MSL │    │  Ring    │    │ Anomali  │    │ Öncelik  │  │
│  │ Telemetri│───▶│ Buffer  │───▶│ Tespiti  │───▶│ Motoru   │  │
│  │ Replay   │    │ (500/ch)│    │ Z+LSTM   │    │ (1-10)   │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│                                        │                        │
│                                   ┌────┴────┐                   │
│                                   │ Filtre  │                   │
│                                   │ <50:DROP│                   │
│                                   │ ≥50:TX  │                   │
│                                   └────┬────┘                   │
└────────────────────────────────────────┼────────────────────────┘
                                         │ DSN İletimi
                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   YER İSTASYONU (GROUND STATION)                │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ FastAPI  │    │PostgreSQL│    │WebSocket │    │  React   │  │
│  │ REST API │───▶│ Veritab. │───▶│ Broadcast│───▶│Dashboard │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
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

Veri setinde önceden hesaplanmış `smoothed_errors` varsa doğrudan kullanılır:

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

### Adım 6: Bant Genişliği Optimizasyonu

Sadece skor ≥ 50 olan veriler "iletilir" olarak işaretlenir. Bu, DSN'nin kısıtlı bant genişliğini simüle eder:

```
tasarruf = (1 - iletilen_paket / toplam_paket) × 100
```

Tipik tasarruf oranı: **%85-92**

### Adım 7: Dashboard Gösterimi

İletilen veriler WebSocket üzerinden React dashboard'a aktarılır:

```json
{"type": "sensor_reading", "data": {...}}   // Her okuma
{"type": "anomaly_alert", "data": {...}}    // Anomali tespiti
{"type": "stats_update", "data": {...}}     // 5 saniyede bir özet
```

---

## 5. Teknoloji Stack

| Katman | Teknoloji | Kullanım |
|--------|-----------|----------|
| Backend | Python 3.11+, FastAPI | REST API + WebSocket |
| ORM | SQLAlchemy (async) | PostgreSQL bağlantısı |
| Veritabanı | PostgreSQL 16 | Zaman serisi depolama |
| Migration | Alembic | Şema yönetimi |
| Veri İşleme | NumPy, Pandas | NASA .npy okuma, istatistik |
| ML Model | LSTM (Keras .h5) | Anomali tahmin (önceden eğitilmiş) |
| Frontend | React 18, Vite | SPA dashboard |
| Grafik | Recharts | Zaman serisi görselleştirme |
| Stil | Tailwind CSS | Cyberpunk neon tema |
| Konteyner | Docker Compose | PostgreSQL |

---

## 6. API Endpoints

| Method | Endpoint | Açıklama |
|--------|----------|----------|
| GET | `/health` | Sistem sağlık kontrolü |
| GET | `/api/sensor-data` | Son okumalar (sayfalama destekli) |
| GET | `/api/sensor-data/{id}` | Tek okuma detayı |
| GET | `/api/sensor-data/stats` | Sensör tipi istatistikleri |
| POST | `/api/sensor-data/simulate` | Manuel tek okuma tetikle |
| GET | `/api/anomalies` | Anomali listesi (severity filtre) |
| GET | `/api/anomalies/recent` | Son 10 anomali |
| PATCH | `/api/anomalies/{id}/acknowledge` | Anomaliyi onayla |
| GET | `/api/anomalies/stats` | Anomali tipi dağılımı |
| WS | `/ws/live-feed` | Gerçek zamanlı veri akışı |

---

## 7. Dashboard Sayfaları

| Sayfa | İçerik |
|-------|--------|
| GÖSTERGE_PANELİ | Metrik kartlar, anomali grafiği, bant analizi, canlı tablo |
| VERİ_AKIŞI | 7 adımlı pipeline animasyonu — sensörden Dünya'ya tüm adımlar |
| ANOMALİ_TESPİT | Alarm merkezi — severity filtre, onaylama, bilimsel öncelik |
| TELEMETRİ | Canlı sensör veri akışı tablosu |
| İLETİM_ANALİZİ | Bant genişliği tasarrufu, sıkıştırma oranı, DSN metrikleri |

---

## 8. Veritabanı Şeması

### sensor_readings
| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | UUID | Primary key |
| sensor_type | VARCHAR(10) | TEMP, CH4, O2, CO2, MOIST, SPEC, UV, PRESS |
| raw_value | FLOAT | Normalize telemetri değeri [-1, 1] |
| unit | VARCHAR(20) | Ölçü birimi |
| anomaly_score | FLOAT | 0-100 arası hesaplanan skor |
| is_anomaly | BOOLEAN | Anomali tespiti sonucu |
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
| compression_ratio | FLOAT | İletim oranı |
| transmission_window | VARCHAR(50) | DSN istasyonu |
| created_at | TIMESTAMPTZ | İletim zamanı |

---

## 9. Hızlı Başlangıç

### 1. PostgreSQL Başlat
```bash
docker-compose up -d
```

### 2. Backend Kurulumu
```bash
cd backend
pip install -r requirements.txt
```

### 3. Veritabanı Migration
```bash
cd backend
alembic upgrade head
```

### 4. Backend Sunucu
```bash
cd backend
uvicorn main:app --reload --port 8000
```

### 5. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 6. Aç
Tarayıcıda [http://localhost:5173](http://localhost:5173)

---

## 10. Dosya Yapısı

```
mars-rover-dashboard/
├── backend/
│   ├── main.py                 # FastAPI app, lifespan, CORS
│   ├── database.py             # AsyncPG engine, session
│   ├── models.py               # SQLAlchemy ORM modelleri
│   ├── schemas.py              # Pydantic request/response
│   ├── crud.py                 # Veritabanı CRUD operasyonları
│   ├── simulator.py            # NASA MSL veri replay motoru
│   ├── edge_processor.py       # Hibrit anomali tespit + karar
│   ├── requirements.txt        # Python bağımlılıkları
│   ├── alembic.ini             # Migration config
│   ├── alembic/                # Migration dosyaları
│   ├── routers/
│   │   ├── sensor_data.py      # /api/sensor-data endpoints
│   │   ├── anomalies.py        # /api/anomalies endpoints
│   │   └── websocket.py        # /ws/live-feed WebSocket
│   └── data/                   # NASA SMAP/MSL veri seti
│       ├── train/              # Eğitim verisi (.npy)
│       ├── test/               # Test verisi (.npy) — replay kaynağı
│       ├── labeled_anomalies.csv
│       └── 2018-05-19_15.00.10/
│           ├── models/         # LSTM modelleri (.h5)
│           ├── y_hat/          # LSTM tahminleri
│           ├── smoothed_errors/# Düzeltilmiş hata skorları
│           └── params.log      # Model parametreleri
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MetricCards.jsx
│   │   │   ├── AnomalyChart.jsx
│   │   │   ├── LiveStreamTable.jsx
│   │   │   ├── BandwidthGauge.jsx
│   │   │   ├── AlertCenter.jsx
│   │   │   ├── PipelineAnimation.jsx
│   │   │   └── ConnectionStatus.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useAnomalyData.js
│   │   └── utils/formatters.js
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 11. Referanslar

1. Hundman, K. et al. (2018). *Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding.* KDD 2018.
2. NASA SMAP/MSL Anomaly Detection Dataset — Kaggle.
3. NASA Perseverance Science Instruments — science.nasa.gov
4. Ground Processing of Data From the Mars Exploration Rovers — NASA NTRS.
5. IP in Deep Space: Key Characteristics — IETF Draft.
