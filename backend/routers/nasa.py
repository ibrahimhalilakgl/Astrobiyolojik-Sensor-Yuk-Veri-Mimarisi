import os
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/nasa", tags=["NASA"])

NASA_BASE = "https://api.nasa.gov"


def _api_key() -> str:
    key = (os.getenv("NASA_API_KEY") or "").strip()
    if not key:
        raise HTTPException(
            status_code=503,
            detail="NASA_API_KEY tanımlı değil; backend/.env içine ekleyin.",
        )
    return key


@router.get("/apod")
async def apod(
    date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD (verilmezse bugün)",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    ),
):
    params = {"api_key": _api_key()}
    if date:
        params["date"] = date
    url = f"{NASA_BASE}/planetary/apod"
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(url, params=params)
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"NASA APOD yanıtı: {r.status_code}",
        )
    return r.json()


@router.get("/mars-photos/{rover}")
async def mars_photos(
    rover: Literal["curiosity", "opportunity", "spirit"],
    earth_date: Optional[str] = Query(
        None,
        description="YYYY-MM-DD",
        pattern=r"^\d{4}-\d{2}-\d{2}$",
    ),
    sol: Optional[int] = Query(None, ge=0, description="Mars günü (earth_date ile birlikte vermeyin)"),
    camera: Optional[str] = Query(None, max_length=32, description="Örn. fhaz, rhaz, mast"),
    page: int = Query(1, ge=1, le=100),
):
    if earth_date is None and sol is None:
        raise HTTPException(
            status_code=400,
            detail="earth_date veya sol parametrelerinden biri gerekli.",
        )
    if earth_date is not None and sol is not None:
        raise HTTPException(
            status_code=400,
            detail="earth_date ve sol birlikte kullanılamaz.",
        )
    params: dict = {"api_key": _api_key(), "page": page}
    if earth_date:
        params["earth_date"] = earth_date
    else:
        params["sol"] = sol
    if camera:
        params["camera"] = camera
    url = f"{NASA_BASE}/mars-photos/api/v1/rovers/{rover}/photos"
    async with httpx.AsyncClient(timeout=45.0) as client:
        r = await client.get(url, params=params)
    if r.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"NASA Mars Photos yanıtı: {r.status_code}",
        )
    return r.json()


@router.get("/mars-photos-recent/{rover}")
async def mars_photos_recent(
    rover: Literal["curiosity", "opportunity", "spirit"],
    limit: int = Query(50, ge=1, le=100, description="Toplanacak en fazla fotoğraf"),
):
    """Manifestten max_sol alınır; yeni sol’lardan geriye giderek son N fotoğraf birleştirilir."""
    key = _api_key()
    collected: list[dict] = []
    meta: dict = {"rover": rover, "start_sol": None, "end_sol": None, "pages_fetched": 0}

    async with httpx.AsyncClient(timeout=90.0) as client:
        man_url = f"{NASA_BASE}/mars-photos/api/v1/manifests/{rover}"
        mr = await client.get(man_url, params={"api_key": key})
        if mr.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"NASA manifest yanıtı: {mr.status_code}",
            )
        mj = mr.json()
        pm = mj.get("photo_manifest") or {}
        max_sol = pm.get("max_sol")
        if max_sol is None:
            raise HTTPException(
                status_code=502,
                detail="Manifestte max_sol bulunamadı.",
            )

        photos_url = f"{NASA_BASE}/mars-photos/api/v1/rovers/{rover}/photos"
        sol = int(max_sol)
        meta["start_sol"] = sol
        max_sol_steps = 120

        for _ in range(max_sol_steps):
            if len(collected) >= limit:
                break
            if sol < 0:
                break
            page = 1
            while len(collected) < limit and page <= 10:
                pr = await client.get(
                    photos_url,
                    params={"api_key": key, "sol": sol, "page": page},
                )
                meta["pages_fetched"] += 1
                if pr.status_code != 200:
                    break
                batch = (pr.json() or {}).get("photos") or []
                if not batch:
                    break
                for p in batch:
                    if len(collected) >= limit:
                        break
                    collected.append(p)
                if len(batch) < 25:
                    break
                page += 1
            meta["end_sol"] = sol
            sol -= 1

    return {
        "photos": collected,
        "meta": {
            **meta,
            "count": len(collected),
            "manifest_max_sol": pm.get("max_sol"),
            "manifest_max_date": pm.get("max_date"),
        },
    }
