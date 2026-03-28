import { useState, useEffect } from "react";

const LSTM_PARAMS = [
  { key: "KATMANLAR", val: "2 × LSTM (80 birim)" },
  { key: "BATCH_SIZE", val: "70" },
  { key: "EPOCHS", val: "35" },
  { key: "DROPOUT", val: "0.3" },
  { key: "OPTIMİZER", val: "Adam" },
  { key: "LOSS", val: "MSE (Mean Squared Error)" },
  { key: "SEQUENCE_LENGTH", val: "250 timestep" },
  { key: "WINDOW_SIZE", val: "30" },
  { key: "SMOOTHING", val: "%5" },
  { key: "VALİDASYON", val: "%20 split" },
  { key: "MİN_DELTA", val: "0.0003" },
  { key: "PATIENCE", val: "10 epoch" },
];

const CHANNELS = [
  { id: "T-1", type: "TEMP", craft: "MSL", desc: "Sıcaklık sensörü", shape: "2875×25" },
  { id: "T-2", type: "TEMP", craft: "MSL", desc: "Termal kontrol", shape: "2880×25" },
  { id: "P-10", type: "PRESS", craft: "MSL", desc: "Basınç sistemi", shape: "6100×25" },
  { id: "P-14", type: "PRESS", craft: "MSL", desc: "Hidrolik basınç", shape: "6100×25" },
  { id: "M-6", type: "CH4", craft: "MSL", desc: "Metan dedektörü", shape: "2049×55" },
  { id: "M-7", type: "MOIST", craft: "MSL", desc: "Nem sensörü", shape: "2156×55" },
  { id: "C-1", type: "SPEC", craft: "MSL", desc: "Spektrometre A", shape: "2264×55" },
  { id: "C-2", type: "SPEC", craft: "MSL", desc: "Spektrometre B", shape: "2051×55" },
  { id: "D-14", type: "UV", craft: "MSL", desc: "UV radyasyon", shape: "2625×55" },
  { id: "D-15", type: "O2", craft: "MSL", desc: "Oksijen sensörü", shape: "2158×55" },
  { id: "D-16", type: "CO2", craft: "MSL", desc: "CO₂ sensörü", shape: "2191×55" },
  { id: "F-7", type: "SPEC", craft: "MSL", desc: "FTIR spektroskopi", shape: "5054×25" },
];

function StatCard({ label, value, sub, color }) {
  return (
    <div className="n-hud p-5" style={{ background: "linear-gradient(135deg, #080C14, #060910)" }}>
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#607080" }}>{label}</p>
      <p className="text-3xl font-extrabold mt-2" style={{ color, textShadow: `0 0 12px ${color}40` }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#506070" }}>{sub}</p>}
    </div>
  );
}

export default function DatasetInfo() {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-lg font-bold uppercase tracking-wide" style={{ color: "#BCC8D4" }}>VERİ_SETİ_BİLGİSİ</p>
        <p className="text-sm mt-1" style={{ color: "#708090" }}>NASA SMAP/MSL Anomaly Detection Dataset — Hundman et al., KDD 2018</p>
      </div>

      {/* Overview stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="TOPLAM_KANAL" value="82" sub="54 SMAP + 28 MSL" color="#00F2FF" />
        <StatCard label="VERİ_NOKTASI" value="496.444" sub="Telemetri değeri" color="#FF00FF" />
        <StatCard label="ANOMALİ_SEKANS" value="105" sub="Etiketlenmiş bölge" color="#FF3366" />
        <StatCard label="ANOMALİ_ORANI" value="%16" sub="~75.387 anomalous sample" color="#FFAA00" />
      </div>

      {/* LSTM Model */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="n-hud p-5">
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#607080" }}>LSTM_MODEL_PARAMETRELERİ</p>
          <div className="space-y-1">
            {LSTM_PARAMS.map(p => (
              <div key={p.key} className="flex items-center justify-between px-3 py-2" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#708090" }}>{p.key}</span>
                <span className="text-sm font-bold" style={{ color: "#BCC8D4" }}>{p.val}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          {/* Performance */}
          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#607080" }}>MODEL_PERFORMANSI</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#607080" }}>PRECİSİON</p>
                <p className="text-4xl font-extrabold mt-2" style={{ color: "#00FF88", textShadow: "0 0 16px #00FF8840" }}>%88.4</p>
                <p className="text-xs mt-1" style={{ color: "#506070" }}>84 TP / (84 TP + 11 FP)</p>
              </div>
              <div className="text-center p-4" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#607080" }}>RECALL</p>
                <p className="text-4xl font-extrabold mt-2" style={{ color: "#00F2FF", textShadow: "0 0 16px #00F2FF40" }}>%80.0</p>
                <p className="text-xs mt-1" style={{ color: "#506070" }}>84 TP / (84 TP + 21 FN)</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { l: "TRUE_POSİTİVE", v: "84", c: "#00FF88" },
                { l: "FALSE_POSİTİVE", v: "11", c: "#FFAA00" },
                { l: "FALSE_NEGATİVE", v: "21", c: "#FF3366" },
              ].map(m => (
                <div key={m.l} className="text-center p-3" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#506070" }}>{m.l}</p>
                  <p className="text-xl font-extrabold mt-1" style={{ color: m.c }}>{m.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Algorithm */}
          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>ANOMALİ_TESPİT_ALGORİTMASI</p>
            <div className="space-y-2 text-sm" style={{ color: "#8899AA" }}>
              <p><span style={{ color: "#00F2FF" }}>1.</span> LSTM modeli geçmiş telemetri verisinden gelecek değeri tahmin eder</p>
              <p><span style={{ color: "#00F2FF" }}>2.</span> Tahmin hatası (prediction error) hesaplanır: <span style={{ color: "#FF00FF" }}>e = |y - ŷ|</span></p>
              <p><span style={{ color: "#00F2FF" }}>3.</span> Hatalar üstel düzeltme ile smoothed_error'a dönüştürülür</p>
              <p><span style={{ color: "#00F2FF" }}>4.</span> Dinamik eşik belirlenir (nonparametric thresholding)</p>
              <p><span style={{ color: "#00F2FF" }}>5.</span> Eşiği aşan bölgeler anomali olarak işaretlenir</p>
            </div>
          </div>
        </div>
      </div>

      {/* Channel table */}
      <div className="n-hud p-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#607080" }}>KULLANILAN_MSL_KANALLARI</p>
        <div style={{ background: "#050810", border: "1px solid #0D1520" }} className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid #0F1923" }}>
                {["KANAL_ID", "SENSÖR_TİPİ", "UZAY_ARACI", "AÇIKLAMA", "VERİ_BOYUTU"].map(h => (
                  <th key={h} className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-left" style={{ color: "#607080" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map(ch => (
                <tr key={ch.id} style={{ borderBottom: "1px solid #0A0F18" }}>
                  <td className="py-2.5 px-4 text-sm font-bold" style={{ color: "#00F2FF" }}>{ch.id}</td>
                  <td className="py-2.5 px-4 text-sm font-bold" style={{ color: "#BCC8D4" }}>{ch.type}</td>
                  <td className="py-2.5 px-4 text-sm" style={{ color: "#708090" }}>{ch.craft}</td>
                  <td className="py-2.5 px-4 text-sm" style={{ color: "#8899AA" }}>{ch.desc}</td>
                  <td className="py-2.5 px-4 text-sm font-mono" style={{ color: "#607080" }}>{ch.shape}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Source */}
      <div className="n-hud p-5">
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>REFERANSLAR</p>
        <div className="space-y-2 text-sm" style={{ color: "#708090" }}>
          <p>Hundman, K. et al. (2018). <span style={{ color: "#BCC8D4" }}>"Detecting Spacecraft Anomalies Using LSTMs and Nonparametric Dynamic Thresholding"</span> — KDD 2018</p>
          <p>NASA SMAP/MSL Anomaly Detection Dataset — <span style={{ color: "#00F2FF" }}>Kaggle</span></p>
          <p>Mars Science Laboratory (Curiosity) — <span style={{ color: "#00F2FF" }}>NASA JPL</span></p>
        </div>
      </div>
    </div>
  );
}
