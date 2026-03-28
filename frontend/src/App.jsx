import useWebSocket from "./hooks/useWebSocket";
import useAnomalyData from "./hooks/useAnomalyData";
import Dashboard from "./components/Dashboard";

const WS_URL = `ws://${window.location.hostname}:${window.location.port}/ws/live-feed`;

export default function App() {
  const { status, messageBatch } = useWebSocket(WS_URL);
  const {
    readings,
    readingsByType,
    anomalies,
    chartData,
    stats,
    acknowledgeAnomaly,
    appendAnomaliesFromApi,
  } = useAnomalyData(messageBatch);

  return (
    <Dashboard
      wsStatus={status}
      readings={readings}
      readingsByType={readingsByType}
      anomalies={anomalies}
      chartData={chartData}
      stats={stats}
      onAcknowledge={acknowledgeAnomaly}
      appendAnomaliesFromApi={appendAnomaliesFromApi}
    />
  );
}
