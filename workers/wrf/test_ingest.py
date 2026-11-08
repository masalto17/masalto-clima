from datetime import datetime, timezone

import numpy as np
import requests

from ingest import (
    candidate_runs,
    count_hourly_files,
    file_key,
    get_with_retry,
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


class _FakeResponse:
    def __init__(self, status_code: int, text: str = ""):
        self.status_code = status_code
        self.text = text

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f"{self.status_code}")

    def close(self):
        pass


def test_get_with_retry_reintenta_503(monkeypatch):
    calls = {"n": 0}

    def fake_get(self, url, **kwargs):  # noqa: ARG001
        calls["n"] += 1
        if calls["n"] < 3:
            return _FakeResponse(503)
        return _FakeResponse(200, "ok")

    monkeypatch.setattr(requests.Session, "get", fake_get)
    monkeypatch.setattr("ingest.time.sleep", lambda _seconds: None)
    response = get_with_retry(requests.Session(), "https://example.test")
    assert response.status_code == 200
    assert calls["n"] == 3


def test_get_with_retry_no_reintenta_404(monkeypatch):
    calls = {"n": 0}

    def fake_get(self, url, **kwargs):  # noqa: ARG001
        calls["n"] += 1
        return _FakeResponse(404)

    monkeypatch.setattr(requests.Session, "get", fake_get)
    try:
        get_with_retry(requests.Session(), "https://example.test")
        raise AssertionError("tenía que fallar")
    except requests.HTTPError:
        pass
    assert calls["n"] == 1
