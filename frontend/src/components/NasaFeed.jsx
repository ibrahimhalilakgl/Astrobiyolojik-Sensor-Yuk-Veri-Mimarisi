import { useEffect, useMemo, useState } from "react";

function formatApiError(detail) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map(x => (typeof x === "object" && x?.msg ? x.msg : String(x))).join("; ");
  }
  return String(detail);
}

async function parseErrorBody(r) {
  try {
    const j = await r.json();
    return formatApiError(j.detail) || `HTTP ${r.status}`;
  } catch {
    return `HTTP ${r.status}`;
  }
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

const RECENT_LIMIT = 50;

export default function NasaFeed() {
  const [filterMode, setFilterMode] = useState("recent");
  const [earthDate, setEarthDate] = useState(isoToday);
  const [rover, setRover] = useState("curiosity");
  const [apod, setApod] = useState(null);
  const [mars, setMars] = useState(null);
  const [apodErr, setApodErr] = useState(null);
  const [marsErr, setMarsErr] = useState(null);
  const [loading, setLoading] = useState(true);

  const photoList = useMemo(() => mars?.photos ?? [], [mars]);
  const marsMeta = mars?.meta;

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setApodErr(null);
      setMarsErr(null);
      try {
        const apodP = fetch("/api/nasa/apod").then(async r => {
          if (!r.ok) throw new Error(await parseErrorBody(r));
          return r.json();
        });
        const marsUrl =
          filterMode === "recent"
            ? `/api/nasa/mars-photos-recent/${rover}?limit=${RECENT_LIMIT}`
            : `/api/nasa/mars-photos/${rover}?earth_date=${encodeURIComponent(earthDate)}&page=1`;
        const marsP = fetch(marsUrl).then(async r => {
          if (!r.ok) throw new Error(await parseErrorBody(r));
          return r.json();
        });

        const results = await Promise.allSettled([apodP, marsP]);
        if (cancel) return;

        if (results[0].status === "fulfilled") {
          setApod(results[0].value);
        } else {
          setApod(null);
          setApodErr(results[0].reason?.message || String(results[0].reason));
        }

        if (results[1].status === "fulfilled") {
          setMars(results[1].value);
        } else {
          setMars(null);
          setMarsErr(results[1].reason?.message || String(results[1].reason));
        }
      } catch (e) {
        if (!cancel) {
          setApodErr(e.message || String(e));
          setMarsErr(e.message || String(e));
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [earthDate, rover, filterMode]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: "#607080" }}>
          Mars fotoğrafları
          <select
            value={filterMode}
            onChange={e => setFilterMode(e.target.value)}
            className="px-3 py-2 text-sm font-mono rounded border min-w-[220px]"
            style={{ background: "#080C14", borderColor: "#0D1520", color: "#99AAB8" }}
          >
            <option value="recent">Son {RECENT_LIMIT} görsel (manifest / en güncel sol)</option>
            <option value="date">Dünya tarihine göre (isteğe bağlı)</option>
          </select>
        </label>
        {filterMode === "date" && (
          <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: "#607080" }}>
            Dünya tarihi
            <input
              type="date"
              value={earthDate}
              onChange={e => setEarthDate(e.target.value)}
              className="px-3 py-2 text-sm font-mono rounded border"
              style={{ background: "#080C14", borderColor: "#0D1520", color: "#99AAB8" }}
            />
          </label>
        )}
        <label className="flex flex-col gap-1 text-xs font-bold uppercase tracking-wider" style={{ color: "#607080" }}>
          Rover
          <select
            value={rover}
            onChange={e => setRover(e.target.value)}
            className="px-3 py-2 text-sm font-mono rounded border min-w-[160px]"
            style={{ background: "#080C14", borderColor: "#0D1520", color: "#99AAB8" }}
          >
            <option value="curiosity">Curiosity (MSL)</option>
            <option value="opportunity">Opportunity</option>
            <option value="spirit">Spirit</option>
          </select>
        </label>
      </div>

      {loading && (
        <p className="text-sm font-mono" style={{ color: "#607080" }}>NASA API yükleniyor…</p>
      )}
      {apodErr && (
        <div className="p-4 rounded border text-sm" style={{ background: "#1A0A10", borderColor: "#FF336650", color: "#FF8899" }}>
          APOD: {apodErr}
        </div>
      )}

      {!loading && !apodErr && apod && (
        <section className="rounded border overflow-hidden" style={{ background: "#060910", borderColor: "#0D1520" }}>
          <div className="px-4 py-3 border-b flex justify-between items-center gap-2 flex-wrap" style={{ borderColor: "#0D1520" }}>
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#00F2FF" }}>APOD — Astronomy Picture of the Day</h2>
            <span className="text-xs font-mono" style={{ color: "#506070" }}>{apod.date}</span>
          </div>
          <div className="p-4 grid md:grid-cols-2 gap-4">
            {apod.media_type === "image" && (apod.hdurl || apod.url) && (
              <a href={apod.hdurl || apod.url} target="_blank" rel="noreferrer" className="block">
                <img
                  src={apod.url}
                  alt={apod.title || "APOD"}
                  className="w-full rounded border object-cover max-h-[320px]"
                  style={{ borderColor: "#0D1520" }}
                />
              </a>
            )}
            {apod.media_type === "video" && apod.url && (
              <div className="aspect-video w-full">
                <iframe title={apod.title} src={apod.url} className="w-full h-full rounded border" style={{ borderColor: "#0D1520" }} />
              </div>
            )}
            <div className="min-w-0 space-y-2">
              <h3 className="text-base font-bold" style={{ color: "#E8ECF0" }}>{apod.title}</h3>
              <p className="text-xs leading-relaxed line-clamp-6 md:line-clamp-none" style={{ color: "#708090" }}>
                {apod.explanation}
              </p>
              {apod.copyright && (
                <p className="text-[10px] uppercase tracking-wider" style={{ color: "#506070" }}>© {apod.copyright}</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="rounded border overflow-hidden" style={{ background: "#060910", borderColor: "#0D1520" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "#0D1520" }}>
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: "#FF00FF" }}>
            Mars Rover Photos — {rover}
          </h2>
          {filterMode === "recent" && (
            <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: "#506070" }}>
              NASA manifest ile en yüksek sol’dan geriye doğru taranır; boş günlük tarih sorunu olmaz.
              {marsMeta && (
                <span className="block mt-1 font-mono normal-case" style={{ color: "#607080" }}>
                  Kaynak: sol {marsMeta.end_sol ?? "—"}–{marsMeta.start_sol ?? "—"}
                  {marsMeta.manifest_max_date != null ? ` · arşiv max ${marsMeta.manifest_max_date}` : ""}
                  {" · "}
                  {marsMeta.count ?? photoList.length} görsel
                </span>
              )}
            </p>
          )}
          {filterMode === "date" && (
            <p className="text-[10px] mt-1 uppercase tracking-wider" style={{ color: "#506070" }}>
              Yalnızca seçilen Dünya tarihinde çekilen kareler (o gün çekim yoksa liste boş kalır).
            </p>
          )}
        </div>
        {marsErr && (
          <div className="p-4 text-sm" style={{ color: "#FF8899" }}>{marsErr}</div>
        )}
        {!loading && !marsErr && (
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {photoList.length === 0 && (
              <p className="col-span-full text-sm font-mono" style={{ color: "#607080" }}>Görsel bulunamadı.</p>
            )}
            {photoList.map(ph => (
              <a
                key={ph.id}
                href={ph.img_src}
                target="_blank"
                rel="noreferrer"
                className="block rounded border overflow-hidden group"
                style={{ borderColor: "#0D1520" }}
              >
                <img
                  src={ph.img_src}
                  alt={ph.camera?.full_name || "Mars"}
                  className="w-full h-28 object-cover transition-opacity group-hover:opacity-90"
                  loading="lazy"
                />
                <p className="text-[10px] font-mono px-2 py-1 truncate" style={{ color: "#506070", background: "#080C14" }}>
                  {ph.camera?.name}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
