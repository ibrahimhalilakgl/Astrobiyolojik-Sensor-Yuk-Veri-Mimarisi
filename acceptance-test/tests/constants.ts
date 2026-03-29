/** `Dashboard.jsx` NAV ile aynı — URL path + üst başlık metni */
export const DASHBOARD_ROUTES = [
  { path: "gosterge_paneli", label: "GÖSTERGE_PANELİ" },
  { path: "veri_akisi", label: "VERİ_AKIŞI" },
  { path: "anomali_tespit", label: "ANOMALİ_TESPİT" },
  { path: "sensor_detay", label: "SENSÖR_DETAY" },
  { path: "telemetri", label: "TELEMETRİ" },
  { path: "rover_harita", label: "ROVER_HARİTA" },
  { path: "iletim_analizi", label: "İLETİM_ANALİZİ" },
  { path: "uplink_kuyrugu", label: "UPLINK_KUYRUĞU" },
  { path: "veri_seti", label: "VERİ_SETİ" },
  { path: "orbiter_role", label: "ORBITER_RÖLE" },
  { path: "yer_istasyonu_bulut", label: "YER_İSTASYONU_BULUT" },
  { path: "rover_zekasi", label: "ROVER_ZEKASİ" },
] as const;

export const BACKEND_HEALTH_URL =
  process.env.BACKEND_URL ?? "http://127.0.0.1:8000/health";
