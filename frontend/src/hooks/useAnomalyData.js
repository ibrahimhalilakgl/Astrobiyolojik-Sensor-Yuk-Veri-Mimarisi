import { useCallback, useEffect, useRef, useState } from "react";

const MAX_READINGS = 50;
const MAX_ANOMALIES = 100;
const MAX_CHART_POINTS = 60;

export default function useAnomalyData(lastMessage) {
  const [readings, setReadings] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case "sensor_reading":
        setReadings((prev) => [lastMessage.data, ...prev].slice(0, MAX_READINGS));
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

  return { readings, anomalies, chartData, stats, acknowledgeAnomaly };
}
