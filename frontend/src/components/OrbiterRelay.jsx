import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function OrbiterRelay({ orbiterStats }) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let cancel = false;
    fetch("/api/orbiter-log?limit=40")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!cancel && Array.isArray(rows)) setLogs(rows);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [orbiterStats?.last_pass_id]);

  const chartData = [...logs]
    .reverse()
    .map((row, i) => ({
      i,
      ms: row.relay_latency_ms,
      t: new Date(row.created_at).toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    }));

  const dropPct = orbiterStats?.drop_rate != null ? (orbiterStats.drop_rate * 100).toFixed(1) : "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { l: "ALINAN_PAKET", v: orbiterStats?.packets_received ?? "—", c: "#00F2FF" },
          { l: "İLETİLEN", v: orbiterStats?.packets_forwarded ?? "—", c: "#FF00FF" },
          { l: "DROP_ORANI", v: `${dropPct}%`, c: "#FF3366" },
          { l: "ORT_GECİKME_MS", v: orbiterStats?.avg_relay_latency_ms ?? "—", c: "#00FF88" },
        ].map((x) => (
          <div key={x.l} className="n-hud p-4" style={{ borderColor: `${x.c}20` }}>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#607080" }}>{x.l}</p>
            <p className="text-2xl font-extrabold tabular-nums" style={{ color: x.c }}>{x.v}</p>
          </div>
        ))}
      </div>
      <p className="text-xs font-mono" style={{ color: "#506070" }}>
        Son geçiş: <span style={{ color: "#99AAB8" }}>{orbiterStats?.last_pass_id || "—"}</span>
      </p>

      <div className="n-panel p-4" style={{ minHeight: 280 }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#607080" }}>RÖLE_GECİKMESİ (MS)</p>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#0D1520" strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fill: "#506070", fontSize: 10 }} />
              <YAxis tick={{ fill: "#506070", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#080C14", border: "1px solid #0D1520", color: "#99AAB8" }}
              />
              <Line type="monotone" dataKey="ms" stroke="#00F2FF" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded border overflow-hidden" style={{ background: "#060910", borderColor: "#0D1520" }}>
        <div className="px-4 py-2 border-b text-xs font-bold uppercase" style={{ borderColor: "#0D1520", color: "#607080" }}>
          ORBITER_RELAY_LOG
        </div>
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-xs font-mono">
            <thead style={{ color: "#506070" }}>
              <tr className="text-left border-b" style={{ borderColor: "#0D1520" }}>
                <th className="p-2">Zaman</th>
                <th className="p-2">pass_id</th>
                <th className="p-2">Alınan</th>
                <th className="p-2">İletilen</th>
                <th className="p-2">Gecikme ms</th>
              </tr>
            </thead>
            <tbody style={{ color: "#99AAB8" }}>
              {logs.slice(0, 30).map((row) => (
                <tr key={row.id} className="border-b" style={{ borderColor: "#0D1520" }}>
                  <td className="p-2">{new Date(row.created_at).toLocaleString("tr-TR")}</td>
                  <td className="p-2">{row.pass_id}</td>
                  <td className="p-2">{row.packets_received}</td>
                  <td className="p-2">{row.packets_forwarded}</td>
                  <td className="p-2">{row.relay_latency_ms}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
