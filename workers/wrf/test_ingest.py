from datetime import datetime, timezone

import numpy as np

from ingest import (
    candidate_runs,
    count_hourly_files,
    file_key,
    nearest_grid_points,
)


def test_candidate_runs_van_de_la_mas_nueva_a_la_mas_vieja():
    now = datetime(2026, 9, 30, 8, 50, tzinfo=timezone.utc)
    runs = candidate_runs(now)
    assert [f"{run:%d %H}" for run in runs] == ["30 06", "30 00", "29 18", "29 12"]


def test_file_key():
    run = datetime(2026, 9, 30, 0, tzinfo=timezone.utc)
    assert file_key(run, 5) == "DATA/WRF/DET/2026/09/30/00/WRFDETAR_01H_20260930_00_005.nc"


def test_count_hourly_files_ignora_los_de_10_minutos():
    xml = (
        "<Key>DATA/WRF/DET/2026/09/30/00/WRFDETAR_01H_20260930_00_000.nc</Key>"
        "<Key>DATA/WRF/DET/2026/09/30/00/WRFDETAR_01H_20260930_00_001.nc</Key>"
        "<Key>DATA/WRF/DET/2026/09/30/00/WRFDETAR_10M_20260930_00_000.nc</Key>"
    )
    assert count_hourly_files(xml) == 2


def test_nearest_grid_points():
    lat, lon = np.meshgrid(np.arange(-32.0, -30.9, 0.04), np.arange(-69.0, -67.9, 0.04), indexing="ij")
    [(y, x, distance_km)] = nearest_grid_points(lat, lon, [(-31.5375, -68.5364)])
    assert abs(lat[y, x] - -31.5375) <= 0.02
    assert abs(lon[y, x] - -68.5364) <= 0.02
    assert distance_km < 3

    [(_, _, lejos)] = nearest_grid_points(lat, lon, [(-20.0, -60.0)])
    assert lejos > 100
