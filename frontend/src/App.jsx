import useWebSocket from "./hooks/useWebSocket";
import useAnomalyData from "./hooks/useAnomalyData";
import Dashboard from "./components/Dashboard";

const WS_URL = `ws://${window.location.hostname}:${window.location.port}/ws/live-feed`;

export default function App() {
  const { status, lastMessage } = useWebSocket(WS_URL);
  const { readings, anomalies, chartData, stats, acknowledgeAnomaly } =
    useAnomalyData(lastMessage);

  return (
    <Dashboard
      wsStatus={status}
      readings={readings}
      anomalies={anomalies}
      chartData={chartData}
      stats={stats}
      onAcknowledge={acknowledgeAnomaly}
    />
  );
}
