# Worker WRF SMN

Baja la última corrida completa del WRF determinístico del SMN (4 km, bucket público
`smn-ar-wrf`) y guarda en `clima.forecasts` solo el punto de grilla de cada lugar.
Lo corre GitHub Actions cada 3 h (`.github/workflows/wrf.yml`).

- Variables: temperatura, humedad, lluvia horaria, viento a 10 m, dirección y presión.
  El WRF público no trae ráfagas.
- Latido: `clima.system_health`, fuente `smn-wrf`. Queda en error si la última corrida
  completa tiene más de 12 h.
- Secretos (GitHub): `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.

Correr a mano:

```bash
uv run --with-requirements workers/wrf/requirements.txt python workers/wrf/ingest.py
```

Tests:

```bash
uv run --with-requirements workers/wrf/requirements.txt --with pytest pytest workers/wrf
```

Fuente: Servicio Meteorológico Nacional (CC BY 2.5 AR).
