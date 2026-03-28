import { useState } from "react";
import ConnectionStatus from "./ConnectionStatus";
import MetricCards from "./MetricCards";
import AnomalyChart from "./AnomalyChart";
import LiveStreamTable from "./LiveStreamTable";
import BandwidthGauge from "./BandwidthGauge";
import AlertCenter from "./AlertCenter";
import PipelineAnimation from "./PipelineAnimation";
import SensorDetail from "./SensorDetail";
import DatasetInfo from "./DatasetInfo";
import RoverMap from "./RoverMap";
import Telemetry from "./Telemetry";
import TransmissionLog from "./TransmissionLog";

const NAV = [
  { id: "dashboard", label: "GÖSTERGE_PANELİ" },
  { id: "pipeline", label: "VERİ_AKIŞI" },
  { id: "anomalies", label: "ANOMALİ_TESPİT" },
  { id: "sensor-detail", label: "SENSÖR_DETAY" },
  { id: "sensors", label: "TELEMETRİ" },
  { id: "rover-map", label: "ROVER_HARİTA" },
  { id: "transmission", label: "İLETİM_ANALİZİ" },
  { id: "dataset", label: "VERİ_SETİ" },
];

export default function Dashboard({ wsStatus, readings, anomalies, chartData, stats, onAcknowledge }) {
  const [active, setActive] = useState("dashboard");
  const sol = stats?.rover?.sol ?? "—";
  const lat = stats?.rover?.lat ?? "—";
  const lon = stats?.rover?.lon ?? "—";
  const totalAnomaly = stats?.total_anomalies ?? 0;
  const bwSaved = stats?.bandwidth_saved_percent ?? 0;
  const totalPkt = stats?.total_packets ?? stats?.total_readings ?? 0;
  const timeStr = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const handleScan = async () => {
    try { await fetch("/api/sensor-data/simulate", { method: "POST" }); } catch {}
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "#04060A" }}>

      {/* ÜST ÇUBUK */}
      <header className="h-11 shrink-0 flex items-center justify-between px-5" style={{ background: "#060910", borderBottom: "1px solid #0D1520" }}>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-4" style={{ background: "#00F2FF", boxShadow: "0 0 8px #00F2FF60" }} />
            <span className="text-base font-extrabold tracking-wider text-glow-cyan" style={{ color: "#00F2FF" }}>NIRVANA_OS</span>
          </div>
          <span className="text-xs" style={{ color: "#506070" }}>v1.0.4</span>
          <div className="h-4 w-px" style={{ background: "#1A2535" }} />
          {[
            { label: "SENSÖRLER", page: "sensor-detail" },
            { label: "ANALİZ", page: "anomalies" },
            { label: "HARİTA", page: "rover-map" },
          ].map(t => {
            const on = active === t.page;
            return (
              <button key={t.label} onClick={() => setActive(t.page)} className="text-xs font-bold uppercase tracking-widest px-2.5 py-1 transition-all" style={{
                color: on ? "#FF00FF" : "#607080",
                borderBottom: on ? "2px solid #FF00FF" : "2px solid transparent",
                textShadow: on ? "0 0 10px #FF00FF40" : "none",
              }}>{t.label}</button>
            );
          })}
        </div>
        <div className="flex items-center gap-5">
          <ConnectionStatus status={wsStatus} />
          <span className="text-xs font-mono" style={{ color: "#607080" }}>{timeStr}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* YAN PANEL */}
        <aside className="w-56 shrink-0 flex flex-col" style={{ background: "#060910", borderRight: "1px solid #0D1520" }}>
          <div className="px-5 pt-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full" style={{ background: "#00F2FF", boxShadow: "0 0 6px #00F2FF80" }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#8899AA" }}>ASTROBİYOLOJİ_BİRİMİ</span>
            </div>
            <p className="text-xs ml-4 uppercase tracking-widest" style={{ color: "#506070" }}>SEKTÖR: JEZERO KRATERİ</p>
          </div>

          <div className="px-4 pb-4">
            <button onClick={handleScan} className="w-full n-btn-primary text-xs py-2.5">TARAMA_BAŞLAT</button>
          </div>
          <div className="n-divider" />

          <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
            {NAV.map(item => {
              const on = active === item.id;
              return (
                <button key={item.id} onClick={() => setActive(item.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] font-medium tracking-wide transition-all duration-200"
                  style={{
                    background: on ? "linear-gradient(90deg, #00F2FF10, transparent)" : "transparent",
                    color: on ? "#00F2FF" : "#708090",
                    borderLeft: on ? "2px solid #00F2FF" : "2px solid transparent",
                    textShadow: on ? "0 0 10px #00F2FF30" : "none",
                  }}>{item.label}</button>
              );
            })}
          </nav>

          <div className="n-divider" />
          <div className="px-5 py-4 space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#506070" }}>ROVER_KONUM</p>
            <p className="text-xs" style={{ color: "#607080" }}>ENL: <span style={{ color: "#99AAB8" }} className="font-semibold">{lat}</span></p>
            <p className="text-xs" style={{ color: "#607080" }}>BOY: <span style={{ color: "#99AAB8" }} className="font-semibold">{lon}</span></p>
            <p className="text-xs" style={{ color: "#607080" }}>SOL: <span style={{ color: "#00F2FF" }} className="font-bold text-glow-cyan">{sol}</span></p>
          </div>
        </aside>

        {/* ANA İÇERİK */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ background: "#04060A" }}>
          <div className="h-11 shrink-0 flex items-center justify-between px-6" style={{ background: "#050810", borderBottom: "1px solid #0D1520" }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#99AAB8" }}>
                {NAV.find(n => n.id === active)?.label}
              </span>
              <span className="text-xs" style={{ color: "#506070" }}>GERÇEK ZAMANLI ANALİZ | MARS-2026</span>
            </div>
            <div className="flex items-center gap-2.5">
              {[
                { label: "ANOMALİ", value: totalAnomaly, color: "#FF3366", glow: "text-glow-red" },
                { label: "TASARRUF", value: `%${bwSaved.toFixed(1)}`, color: "#00FF88", glow: "text-glow-green" },
                { label: "PAKET", value: totalPkt, color: "#00F2FF", glow: "text-glow-cyan" },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-2 px-3 py-1" style={{ background: "#080C14", border: "1px solid #0D1520" }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#607080" }}>{m.label}</span>
                  <span className={`text-sm font-extrabold ${m.glow}`} style={{ color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {active === "dashboard" && (
              <>
                <MetricCards stats={stats} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <AnomalyChart data={chartData} />
                  <BandwidthGauge stats={stats} />
                </div>
                <LiveStreamTable readings={readings} />
              </>
            )}
            {active === "pipeline" && <PipelineAnimation />}
            {active === "anomalies" && <AlertCenter anomalies={anomalies} onAcknowledge={onAcknowledge} />}
            {active === "sensor-detail" && <SensorDetail readings={readings} anomalies={anomalies} />}
            {active === "rover-map" && <RoverMap stats={stats} />}
            {active === "dataset" && <DatasetInfo />}
            {active === "sensors" && <Telemetry readings={readings} />}
            {active === "transmission" && <TransmissionLog stats={stats} />}
          </div>

          <footer className="h-7 shrink-0 flex items-center px-5 gap-8 text-xs font-mono" style={{ background: "#060910", borderTop: "1px solid #0D1520" }}>
            <span style={{ color: "#00F2FF" }}>VERİ_AKIŞI: <span style={{ color: "#708090" }}>[AKTİF]</span></span>
            <span style={{ color: "#506070" }}>AZIMUT: <span style={{ color: "#8899AA" }}>182.2</span></span>
            <span style={{ color: "#FF00FF" }}>KRİTİK: <span style={{ color: "#708090" }}>{totalAnomaly > 0 ? "AKTİF" : "YOK"}</span></span>
            <span style={{ color: "#506070" }}>TAMPON: <span style={{ color: "#00FF88" }}>%92</span></span>
            <span style={{ color: "#506070" }}>GECİKME: <span style={{ color: "#8899AA" }}>4.4ms</span></span>
            <span className="ml-auto font-bold text-glow-green" style={{ color: "#00FF88" }}>SİNYAL_KİLİTLİ</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
