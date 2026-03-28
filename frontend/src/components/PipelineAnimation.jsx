import { useState, useEffect, useRef } from "react";

const STEPS = [
  { id: "collect", title: "VERİ_TOPLAMA", sub: "SENSÖR OKUMA", color: "#00F2FF", num: "01",
    desc: "Mars rover üzerindeki 8 sensör (PIXL, SHERLOC, Hazcam, REMS) ham veri üretir. Her sensör 2 saniyede bir okuma yapar.",
    detail: "Sensörler: TEMP, CH₄, O₂, CO₂, MOIST, SPEC, UV, PRESS — CCSDS paket formatında.",
    metric: { l: "ÜRETİM HIZI", v: "~8 paket / 2s" } },
  { id: "buffer", title: "TAMPONLAMA", sub: "EDGE BUFFER", color: "#7000FF", num: "02",
    desc: "Ham veriler rover'ın SSR (Solid State Recorder) birimine yazılır. Ring buffer ile en güncel veriler tutulur.",
    detail: "Dairesel buffer: 500 okuma/sensör. Kritik veriler anında işlenir.",
    metric: { l: "BUFFER", v: "500 okuma" } },
  { id: "anomaly", title: "ANOMALİ_TESPİT", sub: "Z-SCORE ANALİZ", color: "#FFAA00", num: "03",
    desc: "Her sensör değeri için z-score yöntemiyle istatistiksel anomali skoru hesaplanır.",
    detail: "anomaly_score = min(100, |z-score| × 25). <30 Normal, 30-60 Şüpheli, ≥60 Anomali.",
    metric: { l: "ANOMALİ ORANI", v: "~%12" } },
  { id: "priority", title: "ÖNCELİKLENDİRME", sub: "BİLİMSEL SINIF", color: "#FF00FF", num: "04",
    desc: "Anomaliler bilimsel önemlerine göre sınıflandırılır. Organik molekül imzası en yüksek önceliği alır.",
    detail: "Organik Molekül→10, Metan→8, Spektral→7, Nem→6, Sıcaklık→4",
    metric: { l: "ÖNCELİK", v: "1-10 skala" } },
  { id: "compress", title: "SIKIŞTIRMA", sub: "BANT OPTİMİZASYON", color: "#00FF88", num: "05",
    desc: "Normal veriler filtrelenir. Sadece anomali skoru yüksek veriler iletilir. %85+ tasarruf.",
    detail: "<30: Filtrelenir. 30-60: Buffer bekler. ≥60: İletim kuyruğuna alınır.",
    metric: { l: "TASARRUF", v: "~%85+" } },
  { id: "transmit", title: "DSN_İLETİM", sub: "DEEP SPACE NETWORK", color: "#00F2FF", num: "06",
    desc: "Veriler Mars-Dünya arası NASA DSN üzerinden iletilir. Tek yön gecikme 4-24 dakika.",
    detail: "X-band ~3 kbps, UHF orbiter ~2 Mbps. Günlük ~1 Gbit kapasite.",
    metric: { l: "GECİKME", v: "4-24 dk" } },
  { id: "ground", title: "YER_İSTASYONU", sub: "REASSEMBLY", color: "#FF00FF", num: "07",
    desc: "Paketler yer istasyonunda birleştirilir, dekode edilir ve dashboard'da gösterilir.",
    detail: "Reassembly → PostgreSQL → WebSocket → Dashboard → Analiz.",
    metric: { l: "GÖSTERIM", v: "GERÇEK ZAMANLI" } },
];

function LiveCanvas({ running, step }) {
  const ref = useRef(null);
  const anim = useRef(null);
  const particles = useRef([]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    const dpr = 2;
    c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = c.offsetWidth, h = c.offsetHeight;
    const nodes = STEPS.map((_, i) => ({ x: 35 + (i * (w - 70)) / (STEPS.length - 1), y: h / 2 }));

    function spawn() {
      const anom = Math.random() < 0.12;
      particles.current.push({ x: nodes[0].x, y: nodes[0].y + (Math.random() - 0.5) * 14,
        seg: 0, prog: 0, spd: 0.008 + Math.random() * 0.005,
        color: anom ? "#FF3366" : "#00F2FF", anom, sz: anom ? 4 : 2.5, alive: true });
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < nodes.length - 1; i++) {
        ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[i+1].x, nodes[i+1].y);
        ctx.strokeStyle = "#1A253530"; ctx.lineWidth = 1; ctx.stroke();
      }
      nodes.forEach((pos, i) => {
        const glow = i === step;
        ctx.beginPath(); ctx.arc(pos.x, pos.y, glow ? 9 : 6, 0, Math.PI * 2);
        ctx.fillStyle = glow ? STEPS[i].color : `${STEPS[i].color}50`; ctx.fill();
        if (glow) { ctx.beginPath(); ctx.arc(pos.x, pos.y, 14, 0, Math.PI * 2);
          ctx.strokeStyle = `${STEPS[i].color}30`; ctx.lineWidth = 2; ctx.stroke(); }
      });
      particles.current.forEach(p => {
        if (!p.alive) return;
        const from = nodes[p.seg], to = nodes[Math.min(p.seg + 1, nodes.length - 1)];
        p.prog += p.spd;
        if (p.prog >= 1) { p.seg++; p.prog = 0;
          if (p.seg === 4 && !p.anom) { p.alive = false; return; }
          if (p.seg >= nodes.length - 1) { p.alive = false; return; } }
        p.x = from.x + (to.x - from.x) * p.prog;
        p.y = from.y + (to.y - from.y) * p.prog + Math.sin(p.prog * Math.PI * 3) * 4;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.shadowColor = p.color; ctx.shadowBlur = 8; ctx.fill(); ctx.shadowBlur = 0;
      });
      particles.current = particles.current.filter(p => p.alive);
      if (running && Math.random() < 0.14) spawn();
      anim.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(anim.current);
  }, [running, step]);

  return <canvas ref={ref} className="w-full h-24" />;
}

function SensorMini() {
  const [vals, setVals] = useState({ TEMP: -30, CH4: 15, O2: 0.14, PRESS: 700 });
  useEffect(() => {
    const t = setInterval(() => setVals({ TEMP: -80 + Math.random() * 100, CH4: Math.random() * 50,
      O2: 0.1 + Math.random() * 0.1, PRESS: 600 + Math.random() * 200 }), 2000);
    return () => clearInterval(t);
  }, []);

  const sensors = [
    { k: "TEMP", l: "SICAKLIK", v: vals.TEMP, u: "°C", min: -80, max: 20, c: "#00F2FF" },
    { k: "CH4", l: "METAN", v: vals.CH4, u: "ppb", min: 0, max: 50, c: "#FFAA00" },
    { k: "O2", l: "OKSİJEN", v: vals.O2, u: "%", min: 0.1, max: 0.2, c: "#00FF88" },
    { k: "PRESS", l: "BASINÇ", v: vals.PRESS, u: "Pa", min: 600, max: 800, c: "#7000FF" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {sensors.map(s => {
        const pct = Math.min(100, Math.max(0, ((s.v - s.min) / (s.max - s.min)) * 100));
        return (
          <div key={s.k} className="p-3" style={{ background: "#050810", border: "1px solid #0D1520" }}>
            <div className="flex justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#708090" }}>{s.l}</span>
              <span className="text-sm font-bold" style={{ color: "#BCC8D4" }}>{s.v.toFixed(1)} <span className="text-xs" style={{ color: "#607080" }}>{s.u}</span></span>
            </div>
            <div className="w-full h-1.5 overflow-hidden" style={{ background: "#0D1520" }}>
              <div className="h-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: s.c, boxShadow: `0 0 6px ${s.c}50` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PipelineAnimation() {
  const [activeStep, setActiveStep] = useState(null);
  const [sim, setSim] = useState(true);
  const [curStep, setCurStep] = useState(0);
  const [log, setLog] = useState([]);

  useEffect(() => {
    if (!sim) return;
    const t = setInterval(() => {
      setCurStep(p => {
        const next = (p + 1) % STEPS.length;
        if (next === 0) {
          const anom = Math.random() < 0.12;
          setLog(prev => [{ id: Date.now(), time: new Date().toLocaleTimeString("tr-TR"),
            sensor: ["TEMP","CH4","O2","CO2","MOIST","SPEC","UV","PRESS"][Math.floor(Math.random()*8)],
            anom, score: anom ? (60+Math.random()*40).toFixed(1) : (Math.random()*29).toFixed(1), tx: anom,
          }, ...prev].slice(0, 12));
        }
        return next;
      });
    }, 700);
    return () => clearInterval(t);
  }, [sim]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold uppercase tracking-wide" style={{ color: "#BCC8D4" }}>VERİ_AKIŞ_MİMARİSİ</p>
          <p className="text-sm mt-1" style={{ color: "#708090" }}>Mars rover sensör verisinin Dünya'ya ulaşma sürecini adım adım gözlemleyin</p>
        </div>
        <button onClick={() => setSim(!sim)} className={sim ? "n-btn-danger" : "n-btn-primary"}>
          {sim ? "SİMÜLASYONU DURDUR" : "SİMÜLASYONU BAŞLAT"}
        </button>
      </div>

      {/* Canvas */}
      <div className="n-hud p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#607080" }}>CANLI_PAKET_AKIŞI</p>
          <div className="flex gap-5 text-xs uppercase tracking-wide" style={{ color: "#708090" }}>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5" style={{ background: "#00F2FF" }} /> NORMAL</span>
            <span className="flex items-center gap-2"><span className="w-2.5 h-2.5" style={{ background: "#FF3366" }} /> ANOMALİ</span>
            <span style={{ color: "#506070" }}>5. adımda normal veri filtrelenir</span>
          </div>
        </div>
        <LiveCanvas running={sim} step={curStep} />
        <div className="flex justify-between mt-2 px-5">
          {STEPS.map((s, i) => (
            <span key={s.id} className="text-xs uppercase tracking-wide text-center font-medium"
              style={{ color: i === curStep ? s.color : "#506070", textShadow: i === curStep ? `0 0 8px ${s.color}40` : "none" }}>
              {s.sub}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Steps */}
        <div className="xl:col-span-2 space-y-1.5">
          {STEPS.map((step, idx) => {
            const isActive = activeStep === idx;
            const isCur = curStep === idx;
            return (
              <button key={step.id} onClick={() => setActiveStep(isActive ? null : idx)}
                className="w-full text-left transition-all duration-200 p-5"
                style={{
                  background: isActive ? "#0A0F18" : "#060910",
                  border: `1px solid ${isActive ? "#1A2535" : "#0D1520"}`,
                  borderLeft: `3px solid ${isCur ? step.color : "transparent"}`,
                  boxShadow: isCur ? `inset 3px 0 12px ${step.color}15` : "none",
                }}>
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 flex items-center justify-center text-sm font-extrabold shrink-0 ${isCur ? "animate-float" : ""}`}
                    style={{ background: `${step.color}15`, border: `1px solid ${step.color}30`, color: step.color, textShadow: `0 0 8px ${step.color}40` }}>
                    {step.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold" style={{ color: "#BCC8D4" }}>{step.title}</span>
                      {isCur && <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: step.color, boxShadow: `0 0 8px ${step.color}` }} />}
                    </div>
                    <span className="text-xs uppercase tracking-widest" style={{ color: `${step.color}99` }}>{step.sub}</span>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-4 pt-4 space-y-3 animate-slide-up" style={{ borderTop: "1px solid #0D1520" }}>
                    <p className="text-sm leading-relaxed" style={{ color: "#8899AA" }}>{step.desc}</p>
                    <div className="p-3" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                      <p className="text-sm leading-relaxed" style={{ color: "#99AAB8" }}>{step.detail}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider"
                        style={{ background: `${step.color}15`, color: step.color }}>{step.metric.l}</span>
                      <span className="text-sm font-bold" style={{ color: "#BCC8D4" }}>{step.metric.v}</span>
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Right panel */}
        <div className="space-y-5">
          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#607080" }}>ANLIK_SENSÖR_OKUMALARI</p>
            <SensorMini />
          </div>

          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>PAKET_İŞLEM_LOGU</p>
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {log.length === 0 ? (
                <p className="text-sm py-6 text-center uppercase tracking-wide" style={{ color: "#607080" }}>SİMÜLASYON BEKLENİYOR...</p>
              ) : log.map(l => (
                <div key={l.id} className="flex items-center justify-between text-sm px-3 py-2" style={{
                  background: l.anom ? "#FF33660A" : "#050810", border: `1px solid ${l.anom ? "#FF336620" : "#0D1520"}`,
                }}>
                  <div className="flex items-center gap-3">
                    <span style={{ color: "#708090" }} className="text-xs">{l.time}</span>
                    <span className="font-bold" style={{ color: "#00F2FF" }}>{l.sensor}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold" style={{ color: l.anom ? "#FF3366" : "#607080" }}>{l.score}</span>
                    {l.tx
                      ? <span className="px-2 py-0.5 text-xs font-bold" style={{ background: "#00FF8815", color: "#00FF88", border: "1px solid #00FF8830" }}>TX</span>
                      : <span className="px-2 py-0.5 text-xs font-bold" style={{ background: "#0A0F18", color: "#506070", border: "1px solid #0D1520" }}>DROP</span>
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>DSN_İSTASYONLARI</p>
            <div className="space-y-2">
              {[
                { n: "GOLDSTONE DSS-14", l: "California, ABD", on: true },
                { n: "CANBERRA DSS-43", l: "Avustralya", on: false },
                { n: "MADRİD DSS-63", l: "İspanya", on: true },
              ].map(d => (
                <div key={d.n} className="flex items-center justify-between px-3 py-2.5" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide" style={{ color: "#99AAB8" }}>{d.n}</p>
                    <p className="text-xs uppercase tracking-wide" style={{ color: "#607080" }}>{d.l}</p>
                  </div>
                  <span className="w-2.5 h-2.5" style={{ background: d.on ? "#00FF88" : "#2A3A4D", boxShadow: d.on ? "0 0 8px #00FF8860" : "none" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
