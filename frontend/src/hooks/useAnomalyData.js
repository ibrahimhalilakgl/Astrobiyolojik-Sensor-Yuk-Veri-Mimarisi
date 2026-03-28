import { useCallback, useEffect, useState } from "react";

const MAX_READINGS = 120;
/** Sensör detay / canlı: her tip için en güncel N okuma (karışık kuyruk yerine) */
const MAX_PER_SENSOR = 50;
const BOOTSTRAP_READINGS_LIMIT = 3000;
const MAX_ANOMALIES = 100;
const MAX_CHART_POINTS = 60;

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

export default function useAnomalyData(lastMessage) {
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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "sensor_reading":
        setReadings((prev) => [lastMessage.data, ...prev].slice(0, MAX_READINGS));
        setReadingsByType((prev) => mergeReadingIntoTypeMap(prev, lastMessage.data));
        setChartData((prev) => {
          const point = {
            time: new Date(lastMessage.data.created_at).toLocaleTimeString("tr-TR"),
            score: lastMessage.data.anomaly_score,
            sensor: lastMessage.data.sensor_type,
          };
          return [...prev, point].slice(-MAX_CHART_POINTS);
        });
        break;

      case "anomaly_alert":
        setAnomalies((prev) => [lastMessage.data, ...prev].slice(0, MAX_ANOMALIES));
        break;

      case "stats_update":
        setStats(lastMessage.data);
        break;

      case "uplink_queue_update":
        setStats((prev) => ({
          ...(prev || {}),
          uplink_queue: lastMessage.data,
        }));
        break;
    }
  }, [lastMessage]);

  const acknowledgeAnomaly = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/anomalies/${id}/acknowledge`, {
        method: "PATCH",
      });
      if (res.ok) {
        setAnomalies((prev) =>
          prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
        );
      }
    } catch {
      /* network error */
    }
  }, []);

  return { readings, readingsByType, anomalies, chartData, stats, acknowledgeAnomaly };
}
