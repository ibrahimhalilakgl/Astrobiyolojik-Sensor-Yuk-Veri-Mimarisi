import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

export default function EarthCloud({ modelUpdates, rlRewardSeries, stats }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancel = false;
    fetch("/api/model-updates?limit=30")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancel && Array.isArray(data)) setRows(data);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [modelUpdates?.[0]?.federated_round]);

  const merged = modelUpdates?.length ? modelUpdates : rows;
  const timeline = [...merged]
    .slice(0, 20)
    .reverse()
    .map((m, i) => ({
      i,
      round: m.federated_round ?? m.model_version,
      thr: m.threshold_suggestion,
      label: String(m.federated_round ?? i),
    }));

  const rewardChart = (rlRewardSeries || []).map((p, i) => ({
    i,
    reward: p.reward,
    t: new Date(p.t).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  }));

  const lastRound = merged[0]?.federated_round ?? stats?.rl_stats?.steps ?? "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="n-hud p-5" style={{ borderColor: "#00F2FF20" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#607080" }}>FEDERATED_ROUND</p>
          <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#00F2FF" }}>{lastRound}</p>
          <p className="text-[10px] mt-2 uppercase" style={{ color: "#506070" }}>Earth→Rover kapalı döngü sayacı</p>
        </div>
        <div className="n-hud p-5" style={{ borderColor: "#FF00FF20" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#607080" }}>SON_EŞİK_ÖNERİSİ</p>
          <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#FF00FF" }}>
            {merged[0]?.threshold_suggestion != null ? merged[0].threshold_suggestion.toFixed(1) : "—"}
          </p>
        </div>
        <div className="n-hud p-5" style={{ borderColor: "#00FF8820" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#607080" }}>RL_TOPLAM_ÖDÜL</p>
          <p className="text-4xl font-extrabold tabular-nums" style={{ color: "#00FF88" }}>
            {stats?.rl_stats?.total_reward ?? "—"}
          </p>
          <p className="text-[10px] mt-2 uppercase" style={{ color: "#506070" }}>ε = {stats?.rl_stats?.epsilon ?? "—"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="n-panel p-4" style={{ minHeight: 260 }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#607080" }}>MODEL_TIMELINE</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeline} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#0D1520" strokeDasharray="3 3" />
                <XAxis dataKey="round" tick={{ fill: "#506070", fontSize: 10 }} />
                <YAxis tick={{ fill: "#506070", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#080C14", border: "1px solid #0D1520", color: "#99AAB8" }}
                />
                <Bar dataKey="thr" fill="#FF00FF" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="n-panel p-4" style={{ minHeight: 260 }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#607080" }}>RL_ÖDÜL_GEÇMİŞİ</p>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rewardChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#0D1520" strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={{ fill: "#506070", fontSize: 9 }} />
                <YAxis tick={{ fill: "#506070", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ background: "#080C14", border: "1px solid #0D1520", color: "#99AAB8" }}
                />
                <Line type="monotone" dataKey="reward" stroke="#00FF88" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
