"""Ingesta del WRF determinístico del SMN (4 km).

Baja la última corrida completa del bucket público `smn-ar-wrf` (sin credenciales),
se queda solo con el punto de grilla de cada lugar y lo guarda en `clima.forecasts`.
Deja el latido en `clima.system_health` (fuente `smn-wrf`).

Datos: Servicio Meteorológico Nacional (CC BY 2.5 AR).
"""

from __future__ import annotations

import os
import re
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import requests
import xarray as xr

BUCKET_URL = "https://smn-ar-wrf.s3.amazonaws.com"
SOURCE = "smn-wrf"
MODEL = "wrf_smn_4km"
RUN_HOURS = 73  # pronóstico horario de 0 a 72 h
# Una corrida sale cada 6 h y se publica unas 3 h después: si la última que
# tenemos es más vieja que esto, la fuente está atrasada.
MAX_RUN_AGE = timedelta(hours=12)
# La grilla es de 4 km: un lugar a más de esto de su punto más cercano está fuera del dominio.
MAX_GRID_DISTANCE_KM = 6.0
DOWNLOAD_WORKERS = 6

# Variable del archivo → (columna de forecasts, factor de conversión)
VARIABLES = {
    "T2": ("temperature_c", 1.0),
    "HR2": ("humidity_pct", 1.0),
    "PP": ("precipitation_mm", 1.0),  # acumulada de la hora
    "magViento10": ("wind_speed_kmh", 3.6),  # viene en m/s
    "dirViento10": ("wind_direction_deg", 1.0),
    "PSFC": ("pressure_hpa", 1.0),
}
# El WRF público del SMN no trae ráfagas: wind_gust_kmh queda vacío.


def run_prefix(run: datetime) -> str:
    return f"DATA/WRF/DET/{run:%Y/%m/%d/%H}/"


def file_key(run: datetime, hour: int) -> str:
    return f"{run_prefix(run)}WRFDETAR_01H_{run:%Y%m%d_%H}_{hour:03d}.nc"


def candidate_runs(now: datetime, count: int = 4) -> list[datetime]:
    """Las últimas corridas posibles (00, 06, 12 y 18 UTC), de la más nueva a la más vieja."""
    latest = now.replace(hour=now.hour // 6 * 6, minute=0, second=0, microsecond=0)
    return [latest - timedelta(hours=6 * i) for i in range(count)]


def count_hourly_files(listing_xml: str) -> int:
    return len(set(re.findall(r"<Key>[^<]*WRFDETAR_01H_[^<]*\.nc</Key>", listing_xml)))


def latest_complete_run(now: datetime, session: requests.Session) -> datetime | None:
    for run in candidate_runs(now):
        response = session.get(
            BUCKET_URL,
            params={"list-type": "2", "prefix": f"{run_prefix(run)}WRFDETAR_01H"},
            timeout=30,
        )
        response.raise_for_status()
        if count_hourly_files(response.text) >= RUN_HOURS:
            return run
    return None


def nearest_grid_points(
    lat: np.ndarray, lon: np.ndarray, points: list[tuple[float, float]]
) -> list[tuple[int, int, float]]:
    """Índices (y, x) del punto de grilla más cercano a cada lugar y su distancia en km."""
    result = []
    for place_lat, place_lon in points:
        dy = (lat - place_lat) * 111.2
        dx = (lon - place_lon) * 111.2 * np.cos(np.radians(place_lat))
        distance = np.hypot(dx, dy)
        y, x = np.unravel_index(np.argmin(distance), distance.shape)
        result.append((int(y), int(x), float(distance[y, x])))
    return result


def extract_rows(path: Path, places: list[dict], run: datetime) -> list[dict]:
    """Filas de `forecasts` de un archivo horario, una por lugar."""
    with xr.open_dataset(path, engine="h5netcdf") as ds:
        grid = nearest_grid_points(
            ds["lat"].values, ds["lon"].values, [(p["lat"], p["lon"]) for p in places]
        )
        valid_time = str(np.datetime_as_string(ds["time"].values[0], unit="s", timezone="UTC"))
        values = {name: ds[name].values[0] for name in VARIABLES}

    rows = []
    for place, (y, x, distance_km) in zip(places, grid):
        if distance_km > MAX_GRID_DISTANCE_KM:
            continue
        row = {
            "place_id": place["id"],
            "source": SOURCE,
            "model": MODEL,
            "run_time": run.isoformat(),
            "valid_time": valid_time,
            "wind_gust_kmh": None,
        }
        for name, (column, factor) in VARIABLES.items():
            value = float(values[name][y, x])
            row[column] = None if np.isnan(value) else round(value * factor, 2)
        rows.append(row)
    return rows


class Supabase:
    """Acceso mínimo a la API REST de Supabase sobre el esquema `clima`."""

    def __init__(self, url: str, service_role_key: str, session: requests.Session):
        self.base = f"{url.rstrip('/')}/rest/v1"
        self.session = session
        self.headers = {
            "apikey": service_role_key,
            "authorization": f"Bearer {service_role_key}",
            "accept-profile": "clima",
            "content-profile": "clima",
        }

    def select(self, table: str, params: dict) -> list[dict]:
        response = self.session.get(
            f"{self.base}/{table}", params=params, headers=self.headers, timeout=30
        )
        response.raise_for_status()
        return response.json()

    def upsert(self, table: str, rows: list[dict] | dict, on_conflict: str) -> None:
        response = self.session.post(
            f"{self.base}/{table}",
            params={"on_conflict": on_conflict},
            json=rows,
            headers={**self.headers, "prefer": "resolution=merge-duplicates,return=minimal"},
            timeout=60,
        )
        response.raise_for_status()


def download_and_extract(
    run: datetime, hour: int, places: list[dict], folder: Path, session: requests.Session
) -> list[dict]:
    path = folder / f"{hour:03d}.nc"
    with session.get(f"{BUCKET_URL}/{file_key(run, hour)}", stream=True, timeout=120) as response:
        response.raise_for_status()
        with open(path, "wb") as file:
            for chunk in response.iter_content(chunk_size=1 << 20):
                file.write(chunk)
    try:
        return extract_rows(path, places, run)
    finally:
        path.unlink(missing_ok=True)


def ingest(now: datetime, db: Supabase, session: requests.Session) -> str:
    places = db.select("places", {"select": "id,name,lat,lon"})
    run = latest_complete_run(now, session)
    if run is None:
        raise RuntimeError("No hay ninguna corrida completa del WRF en las últimas 24 h")

    # Lugares que ya tienen la última hora de esta corrida: no se vuelven a bajar.
    last_valid = run + timedelta(hours=RUN_HOURS - 1)
    done = {
        row["place_id"]
        for row in db.select(
            "forecasts",
            {
                "select": "place_id",
                "model": f"eq.{MODEL}",
                "run_time": f"eq.{run.isoformat()}",
                "valid_time": f"eq.{last_valid.isoformat()}",
            },
        )
    }
    pending = [place for place in places if place["id"] not in done]

    rows: list[dict] = []
    if pending:
        with tempfile.TemporaryDirectory() as folder:
            with ThreadPoolExecutor(max_workers=DOWNLOAD_WORKERS) as pool:
                for result in pool.map(
                    lambda hour: download_and_extract(run, hour, pending, Path(folder), session),
                    range(RUN_HOURS),
                ):
                    rows.extend(result)
        if rows:
            db.upsert("forecasts", rows, "place_id,model,valid_time,run_time")

    if now - run > MAX_RUN_AGE:
        raise RuntimeError(f"WRF atrasado: la última corrida completa es {run:%Y-%m-%d %H} UTC")

    return f"corrida {run:%Y-%m-%d %H} UTC: {len(pending)} lugares, {len(rows)} filas nuevas"


def main() -> int:
    session = requests.Session()
    db = Supabase(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"], session)
    now = datetime.now(timezone.utc)
    health = {"source": SOURCE, "updated_at": now.isoformat()}
    try:
        summary = ingest(now, db, session)
    except Exception as error:  # noqa: BLE001 - cualquier falla se anota en el latido
        # Sin last_ok_at: el latido sigue contando desde la última vez que anduvo.
        # Solo el tipo y el mensaje: un error HTTP puede traer la URL, nunca la clave.
        message = f"{type(error).__name__}: {error}"[:500]
        db.upsert("system_health", {**health, "last_error": message}, "source")
        print(f"ERROR {message}", file=sys.stderr)
        return 1
    db.upsert(
        "system_health", {**health, "last_ok_at": now.isoformat(), "last_error": None}, "source"
    )
    print(summary)
    return 0


if __name__ == "__main__":
    sys.exit(main())
