import { useCallback, useEffect, useState } from "react";

const MAX_READINGS = 120;
/** Sensör detay / canlı: her tip için en güncel N okuma (karışık kuyruk yerine) */
const MAX_PER_SENSOR = 50;
const BOOTSTRAP_READINGS_LIMIT = 3000;
const MAX_ANOMALIES = 400;
const ANOMALY_BOOTSTRAP_LIMIT = 300;
const MAX_CHART_POINTS = 60;

function mergeAnomalyLists(fromApi, currentWs) {
  const m = new Map();
  for (const a of fromApi) {
    if (a?.id != null) m.set(String(a.id), { ...a });
  }
  for (const a of currentWs) {
    const id = String(a.id);
    const existing = m.get(id);
    m.set(id, existing ? { ...existing, ...a } : { ...a });
  }
  return Array.from(m.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function appendUniqueAnomalies(prev, newRows) {
  const m = new Map(prev.map((a) => [String(a.id), a]));
  for (const a of newRows) {
    if (a?.id != null && !m.has(String(a.id))) m.set(String(a.id), a);
  }
  return Array.from(m.values()).sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );
}

function bucketBySensorType(rows, capPerType) {
  const buckets = {};
  if (!Array.isArray(rows)) return buckets;
  for (const r of rows) {
    const st = r?.sensor_type;
    if (!st) continue;
    if (!buckets[st]) buckets[st] = [];
    if (buckets[st].length < capPerType) buckets[st].push(r);
  }
  return buckets;
}

function mergeReadingIntoTypeMap(prev, data) {
  const st = data.sensor_type;
  const next = { ...prev };
  const merged = [data, ...(next[st] || [])];
  const seen = new Set();
  const deduped = [];
  for (const r of merged) {
    const id = r?.id != null ? String(r.id) : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(r);
  }
  next[st] = deduped.slice(0, MAX_PER_SENSOR);
  return next;
}

/** DB bootstrap ile WebSocket öncesi gelen tamponları birleştir (yarışta veri kaybı olmasın) */
function mergeTypeBuckets(prev, dbBuckets) {
  const types = new Set([...Object.keys(prev || {}), ...Object.keys(dbBuckets || {})]);
  const out = { ...prev };
  for (const st of types) {
    const m = new Map();
    for (const r of [...(dbBuckets[st] || []), ...(prev[st] || [])]) {
      if (r?.id != null) m.set(String(r.id), r);
    }
    out[st] = Array.from(m.values())
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, MAX_PER_SENSOR);
  }
  return out;
}

function mergeMixedReadings(prev, dbRows) {
  const m = new Map();
  for (const r of dbRows) {
    if (r?.id != null) m.set(String(r.id), r);
  }
  for (const r of prev) {
    if (r?.id != null) m.set(String(r.id), r);
  }
  return Array.from(m.values())
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, MAX_READINGS);
}

function chartPointFromReading(r) {
  const t = new Date(r.created_at).toLocaleTimeString("tr-TR");
  const sensor = r.sensor_type ?? "?";
  return {
    time: `${t} · ${sensor}`,
    score: r.anomaly_score,
    sensor,
  };
}

/** DB bootstrap sonrası grafik boş kalmasın (yalnızca WS ile doldurulunca yenilemede VERİ_BEKLENİYOR oluşuyordu). */
function rowsToChartPoints(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
  return sorted.slice(-MAX_CHART_POINTS).map((r) => chartPointFromReading(r));
}

export default function useAnomalyData(messageBatch) {
  const [readings, setReadings] = useState([]);
  const [readingsByType, setReadingsByType] = useState({});
  const [anomalies, setAnomalies] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState(null);

  /* Sayfa / uygulama ilk açıldığında: DB’den karışık kayıt + sensör başına son 50 — grafik “giriş anından” başlamasın */
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sensor-data?limit=${BOOTSTRAP_READINGS_LIMIT}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return;
        const dbBuckets = bucketBySensorType(rows, MAX_PER_SENSOR);
        setReadings((prev) => mergeMixedReadings(prev, rows));
        setReadingsByType((prev) => mergeTypeBuckets(prev, dbBuckets));
        setChartData(rowsToChartPoints(rows));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/anomalies?limit=${ANOMALY_BOOTSTRAP_LIMIT}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        setAnomalies((prev) => mergeAnomalyLists(rows, prev));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const items = messageBatch?.items;
    if (!items?.length) return;

    for (const msg of items) {
      switch (msg.type) {
        case "sensor_reading":
          setReadings((prev) => [msg.data, ...prev].slice(0, MAX_READINGS));
          setReadingsByType((prev) => mergeReadingIntoTypeMap(prev, msg.data));
          setChartData((prev) => {
            const point = chartPointFromReading(msg.data);
            return [...prev, point].slice(-MAX_CHART_POINTS);
          });
          break;

        case "anomaly_alert":
          setAnomalies((prev) => {
            const data = msg.data;
            const m = new Map(prev.map((a) => [String(a.id), a]));
            const id = String(data.id);
            const existing = m.get(id);
            m.set(id, existing ? { ...existing, ...data } : { ...data });
            return Array.from(m.values())
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .slice(0, MAX_ANOMALIES);
          });
          break;

        case "stats_update":
          setStats(msg.data);
          break;

        case "uplink_queue_update":
          setStats((prev) => ({
            ...(prev || {}),
            uplink_queue: msg.data,
          }));
          break;
        default:
          break;
      }
    }
  }, [messageBatch]);

  const acknowledgeAnomaly = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/anomalies/${id}/acknowledge`, {
        method: "PATCH",
      });
      if (res.ok) {
        setAnomalies((prev) =>
          prev.map((a) =>
            String(a.id) === String(id) ? { ...a, acknowledged: true } : a
          )
        );
      }
    } catch {
      /* network error */
    }
  }, []);

  const appendAnomaliesFromApi = useCallback((rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return;
    setAnomalies((prev) => appendUniqueAnomalies(prev, rows));
  }, []);

  return {
    readings,
    readingsByType,
    anomalies,
    chartData,
    stats,
    acknowledgeAnomaly,
    appendAnomaliesFromApi,
  };
}
