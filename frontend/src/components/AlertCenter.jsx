import { useState } from "react";
import { formatTimestamp, severityColor } from "../utils/formatters";

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const ANOM_TR = {
  organic_molecule: "ORGANİK_MOLEKÜL",
  methane_spike: "METAN_ARTIŞI",
  spectral_deviation: "SPEKTRAL_SAPMA",
  moisture_anomaly: "NEM_ANOMALİSİ",
  temperature_extreme: "SICAKLIK_EKSTREMİ",
};

export default function AlertCenter({ anomalies, onAcknowledge }) {
  const [filter, setFilter] = useState("ALL");
  const sorted = [...anomalies].sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9));
  const filtered = filter === "ALL" ? sorted : sorted.filter(a => a.severity === filter);
  const counts = { ALL: anomalies.length };
  anomalies.forEach(a => { counts[a.severity] = (counts[a.severity] || 0) + 1; });

  const items = [
    { k: "CRITICAL", c: "#FF3366", l: "KRİTİK" },
    { k: "HIGH", c: "#FF8800", l: "YÜKSEK" },
    { k: "MEDIUM", c: "#FFAA00", l: "ORTA" },
    { k: "LOW", c: "#00F2FF", l: "DÜŞÜK" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {items.map(s => (
          <div key={s.k} className="n-hud p-5" style={{ background: "linear-gradient(135deg, #080C14, #060910)" }}>
            <p className="n-label">{s.l}</p>
            <p className="text-3xl font-extrabold mt-2" style={{ color: s.c, textShadow: `0 0 12px ${s.c}35` }}>{counts[s.k] || 0}</p>
            <div className="mt-3 h-px" style={{ background: `linear-gradient(to right, ${s.c}30, transparent 70%)` }} />
          </div>
        ))}
      </div>

      <div className="n-hud p-6" style={{ background: "#080C14" }}>
        <div className="flex items-center justify-between mb-5">
          <p className="n-label">ALARM_MERKEZİ</p>
          <div className="flex gap-1.5">
            {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map(s => {
              const on = filter === s;
              return (
                <button key={s} onClick={() => setFilter(s)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all"
                  style={{
                    background: on ? "linear-gradient(135deg, #00F2FF12, #00F2FF06)" : "transparent",
                    border: `1px solid ${on ? "#00F2FF40" : "#0D1520"}`,
                    color: on ? "#00F2FF" : "#2A3A4D",
                    textShadow: on ? "0 0 8px #00F2FF30" : "none",
                  }}>{s === "ALL" ? `TÜMÜ (${counts.ALL})` : `${s} (${counts[s] || 0})`}</button>
              );
            })}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center text-sm py-16 uppercase tracking-wider" style={{ color: "#2A3A4D" }}>FİLTRE_İLE_EŞLEŞEN_ALARM_YOK</div>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filtered.map(a => {
              const ss = severityColor(a.severity);
              const isCrit = a.severity === "CRITICAL" && !a.acknowledged;
              return (
                <div key={a.id} className={`p-4 transition-all ${isCrit ? "animate-critical" : ""}`} style={{
                  background: a.acknowledged ? "#04060A" : isCrit ? "#FF33660A" : "#050810",
                  border: `1px solid ${a.acknowledged ? "#0A0F18" : isCrit ? "#FF336630" : "#0D1520"}`,
                  opacity: a.acknowledged ? 0.4 : 1,
                  boxShadow: isCrit ? "0 0 16px #FF33660A" : "none",
                }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className="px-3 py-1 text-xs font-bold uppercase" style={{
                          background: ss.bg, color: ss.text, border: `1px solid ${ss.border}`,
                          textShadow: `0 0 6px ${ss.text}30`, boxShadow: `0 0 8px ${ss.text}08`,
                        }}>{a.severity}</span>
                        <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#00F2FF", textShadow: "0 0 8px #00F2FF20" }}>
                          {ANOM_TR[a.anomaly_type] || a.anomaly_type}
                        </span>
                        <span className="text-xs ml-auto" style={{ color: "#2A3A4D" }}>{formatTimestamp(a.created_at)}</span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: "#4A5568" }}>{a.description}</p>
                      <p className="text-xs mt-2 uppercase tracking-wide" style={{ color: "#1E2D3D" }}>
                        BİLİMSEL_ÖNCELİK: <span className="font-bold" style={{ color: "#FF00FF", textShadow: "0 0 6px #FF00FF30" }}>{a.scientific_priority}/10</span>
                      </p>
                    </div>
                    {!a.acknowledged ? (
                      <button onClick={() => onAcknowledge(a.id)} className="n-btn-primary text-xs py-2 px-4 shrink-0">ONAYLA</button>
                    ) : (
                      <span className="text-xs font-bold uppercase tracking-wider shrink-0 text-glow-green" style={{ color: "#00FF88" }}>ONAYLANDI</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
