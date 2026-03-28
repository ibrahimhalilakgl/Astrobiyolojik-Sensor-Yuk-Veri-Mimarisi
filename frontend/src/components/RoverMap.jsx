import { useState, useEffect, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatNumber } from "../utils/formatters";

// MSL (Curiosity) — Gale Krateri / Bradbury İniş bölgesi (harita merkezi)
const GALE_CENTER = [-4.5892, 137.4417];
const LANDING = [-4.5895, 137.4414];
const TRAIL_MAX = 500;
const MARS_TILES = "https://s3-eu-west-1.amazonaws.com/whereonmars.cartodb.net/viking_mdim21_global/{z}/{x}/{y}.png";

export default function RoverMap({ stats }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const roverMarker = useRef(null);
  const trailLine = useRef(null);
  const [trail, setTrail] = useState([]);

  const roverLat = stats?.rover?.lat;
  const roverLon = stats?.rover?.lon;
  const sol = stats?.rover?.sol ?? "—";

  // Initialize map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      center: GALE_CENTER,
      zoom: 6,
      minZoom: 2,
      maxZoom: 9,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer(MARS_TILES, {
      noWrap: false,
      maxNativeZoom: 7,
      maxZoom: 9,
      tileSize: 256,
      errorTileUrl: "",
    }).addTo(map);

    // Gale krateri (yaklaşık gösterim)
    L.circle(GALE_CENTER, {
      radius: 120000,
      color: "#FFAA0050",
      weight: 1,
      fillColor: "#FFAA0010",
      fillOpacity: 0.3,
      dashArray: "6 4",
    }).addTo(map);

    // Landing site marker
    const landIcon = L.divIcon({
      className: "",
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#7000FF50;border:2px solid #9060FF;box-shadow:0 0 10px #7000FF60;"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    L.marker(LANDING, { icon: landIcon }).addTo(map)
      .bindPopup(`
        <div style="background:#080C14;color:#BCC8D4;padding:10px;border:1px solid #1A2535;font-family:JetBrains Mono,monospace;font-size:11px;min-width:180px;">
          <p style="color:#9060FF;font-weight:bold;font-size:12px;">İNİŞ BÖLGESİ</p>
          <p style="color:#708090;margin-top:6px;">MSL Curiosity — Gale Krateri (Bradbury İniş)</p>
          <p style="color:#506070;margin-top:4px;">${LANDING[0].toFixed(4)}°K, ${LANDING[1].toFixed(4)}°D</p>
        </div>
      `, { className: "mars-popup" });

    // Rover marker
    const roverIcon = L.divIcon({
      className: "",
      html: `<div style="position:relative;width:20px;height:20px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:#00F2FF;box-shadow:0 0 14px #00F2FF,0 0 28px #00F2FF80;"></div>
        <div style="position:absolute;inset:-10px;border-radius:50%;border:1.5px solid #00F2FF40;animation:rp 2s ease-in-out infinite;"></div>
      </div>
      <style>@keyframes rp{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(2);opacity:0}}</style>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    roverMarker.current = L.marker(GALE_CENTER, { icon: roverIcon }).addTo(map)
      .bindPopup("", { className: "mars-popup" });

    // Trail polyline
    trailLine.current = L.polyline([], {
      color: "#00F2FF",
      weight: 2,
      opacity: 0.4,
      dashArray: "5 5",
    }).addTo(map);

    mapInstance.current = map;

    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Update rover position
  useEffect(() => {
    if (!roverLat || !roverLon || !roverMarker.current) return;

    const pos = [roverLat, roverLon];
    roverMarker.current.setLatLng(pos);
    roverMarker.current.setPopupContent(`
      <div style="background:#080C14;color:#BCC8D4;padding:10px;border:1px solid #1A2535;font-family:JetBrains Mono,monospace;font-size:11px;min-width:180px;">
        <p style="color:#00F2FF;font-weight:bold;font-size:12px;">CURIOSITY ROVER</p>
        <p style="color:#708090;margin-top:6px;">Enlem: ${roverLat.toFixed(6)}°K</p>
        <p style="color:#708090;">Boylam: ${roverLon.toFixed(6)}°D</p>
        <p style="color:#FF00FF;margin-top:6px;font-weight:bold;">SOL: ${sol}</p>
      </div>
    `);

    setTrail(prev => {
      const next = [...prev, pos].slice(-TRAIL_MAX);
      if (trailLine.current) trailLine.current.setLatLngs(next);
      return next;
    });
  }, [roverLat, roverLon, sol]);

  const dist = useMemo(() => {
    if (trail.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < trail.length; i++) {
      const dlat = trail[i][0] - trail[i - 1][0];
      const dlon = trail[i][1] - trail[i - 1][1];
      d += Math.sqrt(dlat * dlat + dlon * dlon) * 111000;
    }
    return d;
  }, [trail]);

  const focusRover = () => {
    if (mapInstance.current && roverLat && roverLon) {
      mapInstance.current.flyTo([roverLat, roverLon], 8, { duration: 1 });
    }
  };

  const focusGale = () => {
    if (mapInstance.current) {
      mapInstance.current.flyTo(GALE_CENTER, 6, { duration: 1 });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-bold uppercase tracking-wide" style={{ color: "#BCC8D4" }}>ROVER HARİTASI</p>
          <p className="text-sm mt-1" style={{ color: "#708090" }}>
            NASA Mars uydu görüntüsü — fare tekerleği ile yakınlaştır, sürükle ile kaydır
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={focusRover} className="n-btn-primary text-xs py-2 px-4">ROVER'A ODAKLAN</button>
          <button onClick={focusGale} type="button" className="n-btn-primary text-xs py-2 px-4" style={{ borderColor: "#FFAA0040", color: "#FFAA00", background: "#FFAA0010" }}>
            GALE KRATERİ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {/* Map */}
        <div className="xl:col-span-3 relative n-hud overflow-hidden" style={{ height: "calc(100vh - 230px)", minHeight: "480px" }}>
          <div ref={mapRef} className="w-full h-full" />

          {/* HUD overlays */}
          <div className="absolute top-3 left-14 z-[1000] pointer-events-none">
            <div className="p-3 pointer-events-auto" style={{ background: "#060910E0", border: "1px solid #0D1520" }}>
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#00F2FF" }}>MARS YÜZEY HARİTASI</p>
              <p className="text-xs mt-0.5" style={{ color: "#506070" }}>Viking MDIM21 Mozaik — NASA/USGS</p>
            </div>
          </div>

          <div className="absolute top-3 right-3 z-[1000] pointer-events-none">
            <div className="p-3 space-y-1 pointer-events-auto" style={{ background: "#060910E0", border: "1px solid #0D1520", minWidth: "170px" }}>
              {[
                { l: "ENLEM", v: roverLat ? `${formatNumber(roverLat, 4)}°K` : "—", c: "#00F2FF" },
                { l: "BOYLAM", v: roverLon ? `${formatNumber(roverLon, 4)}°D` : "—", c: "#00F2FF" },
                { l: "SOL", v: sol, c: "#FF00FF" },
                { l: "MESAFE", v: `${formatNumber(dist, 1)} m`, c: "#00FF88" },
              ].map(m => (
                <div key={m.l} className="flex justify-between">
                  <span className="text-xs font-bold uppercase" style={{ color: "#506070" }}>{m.l}</span>
                  <span className="text-xs font-bold" style={{ color: m.c }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Info panel */}
        <div className="space-y-4">
          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>HARİTA KONTROL</p>
            <div className="space-y-2 text-sm" style={{ color: "#708090" }}>
              <p><span style={{ color: "#00F2FF" }}>Tekerlek</span> — Yakınlaştır / Uzaklaştır</p>
              <p><span style={{ color: "#00F2FF" }}>Sürükle</span> — Haritayı kaydır</p>
              <p><span style={{ color: "#00F2FF" }}>Tıkla</span> — İşaretçi bilgisi</p>
            </div>
          </div>

          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>ROVER DURUMU</p>
            <div className="space-y-2">
              {[
                { l: "ENLEM", v: roverLat ? `${formatNumber(roverLat, 6)}°K` : "—", c: "#00F2FF" },
                { l: "BOYLAM", v: roverLon ? `${formatNumber(roverLon, 6)}°D` : "—", c: "#00F2FF" },
                { l: "SOL (MARS GÜNÜ)", v: sol, c: "#FF00FF" },
                { l: "İZ NOKTASI", v: trail.length, c: "#8899AA" },
                { l: "TOPLAM MESAFE", v: `${formatNumber(dist, 1)} m`, c: "#00FF88" },
              ].map(m => (
                <div key={m.l} className="flex items-center justify-between px-3 py-2" style={{ background: "#050810", border: "1px solid #0D1520" }}>
                  <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#506070" }}>{m.l}</span>
                  <span className="text-sm font-bold" style={{ color: m.c }}>{m.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>GALE KRATERİ (MSL)</p>
            <div className="space-y-2 text-sm leading-relaxed" style={{ color: "#708090" }}>
              <p><span style={{ color: "#BCC8D4" }}>NASA MSL (Curiosity)</span> görev alanı; veri seti bu uzay aracı telemetrisine dayanır.</p>
              <p>Harita, simüle rover konumunu Gale çevresinde gösterir (yaklaşık koordinatlar).</p>
            </div>
          </div>

          <div className="n-hud p-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#607080" }}>GÖRÜNTÜ KAYNAĞI</p>
            <div className="space-y-1.5 text-xs" style={{ color: "#607080" }}>
              <p><span style={{ color: "#8899AA" }}>Viking MDIM21</span> renk mozaiği</p>
              <p>Çözünürlük: 232m/piksel</p>
              <p>Kaynak: NASA / USGS</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
