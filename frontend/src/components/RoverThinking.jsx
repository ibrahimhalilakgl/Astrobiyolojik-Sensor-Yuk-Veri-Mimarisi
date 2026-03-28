import { useEffect, useState } from "react";
import { formatTimestamp } from "../utils/formatters";

const TYPE_MS = 80;

function DecisionBox({ decision }) {
  const s = String(decision || "");
  const isDrop = /\bDROP\b/i.test(s) || /ATLA/i.test(s);
  const showTx = !isDrop;
  return (
    <div
      className="mt-4 px-4 py-3 rounded border text-center font-bold uppercase tracking-widest text-sm"
      style={{
        borderColor: showTx ? "#00FF8844" : "#FF336688",
        background: showTx ? "linear-gradient(180deg, #00FF8812, transparent)" : "linear-gradient(180deg, #FF336612, transparent)",
        color: showTx ? "#00FF88" : "#FF3366",
        boxShadow: showTx ? "0 0 24px #00FF8830" : "0 0 24px #FF336630",
      }}
    >
      {showTx ? "✅ İLETİLİYOR" : "❌ ATLANDI"}
    </div>
  );
}

export default function RoverThinking({ entries = [] }) {
  const [visibleSteps, setVisibleSteps] = useState([]);
  const [modal, setModal] = useState(null);
  const latest = entries[0];

  useEffect(() => {
    const steps = Array.isArray(latest?.steps) ? latest.steps.filter((s) => String(s).trim()) : [];
    setVisibleSteps([]);
    if (steps.length === 0) return undefined;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisibleSteps(steps.slice(0, i));
      if (i >= steps.length) clearInterval(id);
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [latest?.timestamp, latest?.thinking]);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <h1
          className="text-xl font-black uppercase tracking-[0.2em] animate-pulse"
          style={{ color: "#00FF88", textShadow: "0 0 20px #00FF8860" }}
        >
          🧠 NIRVANA Düşünüyor...
        </h1>
      </div>

      {!latest && (
        <p className="text-sm font-mono" style={{ color: "#506070" }}>
          Anomali skoru ≥ 50 okumalarında Groq düşünce akışı burada görünür. Bekleniyor…
        </p>
      )}

      {latest && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className="rounded-lg p-4 border space-y-2"
            style={{ background: "#080C14", borderColor: "#00F2FF33", boxShadow: "0 0 40px #00F2FF10" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#00F2FF" }}>
              Sensör özeti
            </p>
            <ul className="text-sm font-mono space-y-1" style={{ color: "#99AAB8" }}>
              <li>
                <span style={{ color: "#506070" }}>Kanal:</span> {latest.channel_id}
              </li>
              <li>
                <span style={{ color: "#506070" }}>Skor:</span>{" "}
                <span style={{ color: "#FF00FF" }}>{Number(latest.anomaly_score).toFixed(1)}</span>
              </li>
              <li>
                <span style={{ color: "#506070" }}>Yenilik:</span>{" "}
                {latest.is_novel ? "EVET" : "HAYIR"}{" "}
                {latest.novelty_similarity != null && (
                  <span style={{ color: "#506070" }}>(sim {Number(latest.novelty_similarity).toFixed(2)})</span>
                )}
              </li>
              <li>
                <span style={{ color: "#506070" }}>Enerji:</span>{" "}
                {latest.energy_level != null ? `%${Number(latest.energy_level).toFixed(0)}` : "—"}
              </li>
              <li>
                <span style={{ color: "#506070" }}>Zaman:</span> {formatTimestamp(latest.timestamp)}
              </li>
            </ul>
            <DecisionBox decision={latest.decision} />
            <p className="text-center text-xs font-mono mt-2" style={{ color: "#607080" }}>
              ⚡ {latest.duration_ms ?? 0}ms — {latest.model ?? "—"}
            </p>
          </div>

          <div
            className="rounded-lg p-4 border min-h-[200px]"
            style={{ background: "#050810", borderColor: "#00FF8833" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#00FF88" }}>
              Adımlar
            </p>
            <div className="font-mono text-sm leading-relaxed space-y-1" style={{ color: "#00FF88", textShadow: "0 0 8px #00FF8830" }}>
              {visibleSteps.length === 0 && <span style={{ color: "#3A4A5C" }}>…</span>}
              {visibleSteps.map((line, idx) => (
                <div key={`${latest.timestamp}-${idx}`} className="border-l-2 pl-2" style={{ borderColor: "#00FF8844" }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "#708090" }}>
          Son {Math.min(5, entries.length)} düşünce
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e, i) => (
            <button
              key={`${e.timestamp}-${i}`}
              type="button"
              onClick={() => setModal(e)}
              className="text-left rounded-lg p-3 border transition-all hover:brightness-110"
              style={{
                background: "#080C14",
                borderColor: "#0D1520",
                boxShadow: i === 0 ? "0 0 16px #00F2FF15" : "none",
              }}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="font-mono text-sm font-bold" style={{ color: "#00F2FF" }}>
                  {e.channel_id}
                </span>
                <span className="text-xs font-mono" style={{ color: "#FF00FF" }}>
                  {Number(e.anomaly_score).toFixed(0)}
                </span>
              </div>
              <p className="text-xs mt-1 line-clamp-2 font-mono" style={{ color: "#607080" }}>
                {(e.thinking || "").slice(0, 120)}
                {(e.thinking || "").length > 120 ? "…" : ""}
              </p>
              <p className="text-[10px] mt-2 font-mono uppercase" style={{ color: "#506070" }}>
                {e.decision} · {formatTimestamp(e.timestamp)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "#000000cc" }}
          onClick={() => setModal(null)}
          onKeyDown={(ev) => ev.key === "Escape" && setModal(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-w-2xl w-full max-h-[85vh] overflow-y-auto rounded-xl border p-5"
            style={{ background: "#060910", borderColor: "#00F2FF44", boxShadow: "0 0 60px #00F2FF20" }}
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold uppercase tracking-wide" style={{ color: "#00F2FF" }}>
                {modal.channel_id}
              </h2>
              <button
                type="button"
                className="text-xs uppercase font-bold px-2 py-1 rounded"
                style={{ color: "#FF3366", border: "1px solid #FF336644" }}
                onClick={() => setModal(null)}
              >
                Kapat
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed" style={{ color: "#99AAB8" }}>
              {modal.thinking || "(boş)"}
            </pre>
            <DecisionBox decision={modal.decision} />
            <p className="text-center text-xs font-mono mt-3" style={{ color: "#506070" }}>
              ⚡ {modal.duration_ms ?? 0}ms — {modal.model ?? "—"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
