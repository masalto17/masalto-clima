# Propuesta — vuelta de rosca de MasAlto Clima

Noviembre 2026. Para Hugo. El objetivo no cambia: ver el tiempo del lugar del evento, ahora y los próximos días, de un vistazo. Si está todo bien, tiene que leerse **todo bien**. Si hay viento, lluvia, tormenta o Zonda, tiene que saltar.

## Diagnóstico

La app de hoy hace bien la parte difícil de juntar datos, y se queda corta en la decisión.

- El combinado vive en `lib/forecast/combine.ts`. Temperatura y lluvia salen de la mediana. Viento y ráfaga salen del máximo entre modelos. Esa regla de viento está bien para estructuras: no se promedia un riesgo. Lo que no hace es acordarse de quién vino acertando. ECMWF, GFS, ICON, GEM, Météo-France y el WRF pesan siempre igual, aunque uno se equivoque seguido en San Juan.
- Las fuentes reales son dos: Open-Meteo (cinco modelos, Edge Function cada hora) y el WRF 4 km del SMN (GitHub Actions). El WRF no trae ráfagas, así que en la variable que más importa no suma. MET Norway, el METAR del aeropuerto y las observaciones horarias del SMN no entran al número que ve la pantalla.
- No hay detector de Zonda. La tarjeta de San Juan lo dice: solo aparece si el SMN publica un aviso. El índice CAP se lee, con tope de 16 XML por visita, y la propia interfaz avisa que una lectura parcial no prueba que no haya alerta.
- El estado de cada día es vocabulario de Beaufort (`lib/forecast/phrases.ts`), no un semáforo de trabajo. Una ráfaga de 60 km/h puede quedar en «Ventoso», en ámbar, al lado de un día tranquilo. Para quien está armando una torre, eso es poco.
- `docs/refs/umbrales_estructuras.csv` tiene encabezado y cero filas. No se pueden inventar límites de una estructura y presentarlos como si vinieran de ahí.
- La página pública no existe sin Supabase. Si la base de Handy no responde, no hay pronóstico de respaldo armado en el momento. El plan gratuito de Open-Meteo, además, no es para uso comercial: antes de cobrar esto hay que tener la clave del plan pago.
- La pantalla es completa y, por eso, lenta de leer. Alertas del SMN, frases, hora por hora de mañana y la semana plegada. Falta un cartel único arriba: se puede trabajar, o no.

## Qué se propone

Una vista que arranca por el estado, alimentada por varias fuentes en vivo, con un registro aparte que vaya aprendiendo a quién creerle en cada variable. El bot, el ingreso y la base de Handy quedan como están.

### Fuentes

Sin clave, en cada consulta:

| Fuente | Qué aporta | Límite |
| --- | --- | --- |
| Open-Meteo: ECMWF, GFS, ICON, GEM, Météo-France | Hora a hora, 7 días, incluida la ráfaga | Plan gratuito no comercial. Con `OPEN_METEO_API_KEY` o `CLIMA_OPEN_METEO_API_KEY` pasa al host comercial. |
| MET Norway Locationforecast | Temperatura, humedad, viento, lluvia de la hora siguiente, presión a nivel del mar | Sin clave. Pide un User-Agent identificable y cache. El compact no trae ráfaga. |
| SMN, archivo `tiepre` | Última hora de la estación (San Juan, Córdoba) | Sin ráfaga ni milímetros. Hora local UTC−3. |
| SMN, índice CAP | Avisos oficiales que cubren el punto | Igual que hoy: puede quedar parcial. |
| METAR (aviationweather.gov) | SANU para San Juan, SACO para Villa Allende. Temperatura, viento, ráfaga si el parte la trae, humedad a partir del punto de rocío | Es el aeropuerto, no el predio. San Juan ciudad y el estadio comparten SANU (el estadio está a unos 11 km). |

Con clave, opcionales, y la página no las extraña si faltan:

- OpenWeatherMap, pronóstico cada 3 horas (`OPENWEATHER_API_KEY`). El viento viene en m/s aunque se pida métrico.
- WeatherAPI, 3 días (`WEATHERAPI_KEY`).
- Tomorrow.io, horario (`TOMORROW_API_KEY`). En métrico el viento también viene en m/s.

Si Supabase está configurado, se suma el WRF que ya ingesta el worker (`smn-wrf`). Si no está, la página igual abre.

### Consenso

Cada hora UTC se arma así:

- Temperatura, humedad y lluvia: promedio ponderado por el acierto reciente de esa fuente en esa variable.
- Viento y ráfaga: el valor más alto entre las fuentes que todavía no demostraron ser claramente peores. Con historial vacío, eso es el máximo: la misma regla de hoy. Una fuente cuyo peso cae por debajo de la mitad de la mejor queda afuera del número, y su pico se muestra igual como «una fuente marca ráfagas altas».
- Si dos fuentes, aunque pesen poco, superan el umbral de alerta, el estado sube a alerta. Un modelo solo no pinta la pantalla de rojo.
- La presión a nivel del mar (MET Norway) no se mezcla con la presión de superficie (Open-Meteo). Sirve para ver si baja, no para un promedio.

El peso es `1 / (error medio + un piso)`. Recién se usa después de 8 comparaciones. Antes, todas pesan igual.

### Registro de aciertos

La página no escribe nada. Un cron diario (`/api/cron/precision`, 12:00 UTC, 9 de la mañana en San Juan) hace tres cosas:

1. Guarda, por fuente y lugar, el pronóstico a 1, 3, 6, 12 y 24 horas.
2. Baja las últimas 26 horas de METAR y la última fila del SMN.
3. Cierra los pronósticos cuya hora ya pasó: elige el METAR a menos de 45 minutos (si no hay, la estación SMN) y acumula el error absoluto. La ráfaga solo cuenta cuando el METAR trae `wgst`. La lluvia queda en cero hasta que haya una observación de milímetros: el archivo del SMN no los trae.

Con un cron por día alcanza para cerrar los cinco horizontes del día anterior, porque el METAR de 26 horas cubre esas horas. En un plan Pro de Vercel el mismo route se puede pasar a cada hora (`0 * * * *`) y el registro se pone más denso. El plan Hobby solo deja crons diarios: por eso el `vercel.json` va así y el deploy no se rechaza.

El archivo es un JSON (`clima/ledger.json`), no una tabla nueva en la base de Handy. Así no se toca el historial de migraciones de ese proyecto.

Dónde se guarda, en este orden:

1. **Vercel Blob** si existe `BLOB_READ_WRITE_TOKEN`. Acceso privado, se pisa el mismo archivo.
2. Si no, **Vercel KV / Upstash** con `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
3. Si no hay ninguno, el cron responde que no guardó y la página sigue. Todas las fuentes pesan igual y el ranking lo dice.

Sin `CRON_SECRET`, en producción el route responde 401. En desarrollo se puede llamar para probar.

### Zonda y cortes de viento

El detector corre solo en los lugares de San Juan. Una alerta oficial del SMN con la palabra Zonda manda en cualquier lugar, aunque el modelo no acompañe.

Para decir **posible Zonda** hacen falta las tres patas, no una tarde seca de verano:

- Viento del oeste a noroeste (entre 247,5° y 337,5°).
- Ráfaga o viento de al menos 50 km/h.
- Y aire de foehn: humedad de 25 % o menos, o en 3 horas una suba de 8 °C o una caída de 20 puntos de humedad.

Si el viento del oeste pasa 40 km/h y la humedad baja de 35 %, sin llegar a lo anterior, queda en **vigilancia**. La presión que baja 3 hPa en 3 horas se muestra como explicación; sola no dispara nada. Una tarde a 34 °C, 15 % de humedad y 12 km/h no es Zonda: en San Juan eso es un día normal.

Los cortes del semáforo arrancan así y se cambian con variables de entorno. Salen de la escala de Beaufort (OMM), que la app ya usa como lenguaje, y son un punto de partida operativo. **No** son el límite de una torre: ese número tiene que venir del CSV, con fuente, cuando exista.

| Señal | Atención | Alerta |
| --- | --- | --- |
| Ráfaga | 45 km/h | 65 km/h |
| Viento medio | — | 50 km/h |
| Lluvia | 1 mm en 24 h | 10 mm en 24 h, o 5 mm en una hora |

Tormenta o granizo en un aviso del SMN que cubre el punto es alerta, igual que severidad Severe o Extreme.

### La pantalla

Arriba, un solo cartel: **Todo bien**, **Atención**, **Alerta** o **Sin datos**. Si no llegó ningún modelo, no se dice que está todo bien: se pide usar el SMN.

Después, el estadio primero y el resto de los lugares. En cada uno: el motivo en una caja, la lectura de ahora (estación o, si no hay, el pronóstico de esta hora), y siete días en una tira. El Zonda tiene su propio bloque, con la palabra a la vista.

Abajo, «Qué fuente viene mejor»: ráfaga, viento, lluvia, temperatura y humedad, ordenadas por error medio. Hasta que no haya comparaciones, se explica por qué todas pesan igual.

## Esta primera iteración

Entra en el código ahora:

- Consulta en vivo de las fuentes sin clave, más las tres con clave si están en el entorno, más el WRF si Supabase responde.
- Consenso y semáforo, con Zonda por reglas y por aviso oficial.
- Pantalla de estado en `/`, sobre el mismo fondo y el logo que ya están.
- Cron y ledger. Si no hay Blob ni KV, no se rompe el deploy.
- Tests del consenso, del Zonda, de los lectores y del registro.

Queda afuera, a propósito:

- No se cierra el Hito 2 ni se reescribe el bot. `/demo` sigue mostrando la vista anterior.
- No se calibró el Zonda contra episodios reales. Los cortes hay que moverlos cuando haya bitácora.
- Lluvia observada: falta una fuente con milímetros. El ranking de lluvia va a decir «sin comparaciones» hasta entonces.
- El puntaje no se parte por lugar ni por horizonte, y no se olvida de los errores viejos. Con más meses de registro eso va a hacer falta.
- No está la diferencia de presión entre Chile central y Cuyo, que es la otra pata clásica del Zonda.
- No hay umbral por estructura, fases ni margen de armado. Eso sigue siendo el Hito 3, y depende del CSV.

## Roadmap

1. **Medir.** Dejar el cron corriendo con Blob, anotar los Zonda y los días de viento del estadio, y comparar el cartel con lo que pasó. Recién ahí mover umbrales.
2. **Afinar el registro.** Cron horario si el plan de Vercel lo permite. Separar el error por horizonte (1 h no es lo mismo que 24 h) y por lugar cuando haya un sensor en el predio. Bajar el peso de los aciertos viejos.
3. **Lluvia de verdad.** Sumar una observación de precipitación (estación que la publique, o el pluviómetro del predio) para que el ranking de lluvia deje de estar vacío.
4. **Zonda de cordillera.** Presión de una estación chilena contra San Juan, y revisión de las reglas con los episodios del backtest.
5. **Evento.** Cuando el CSV de estructuras tenga filas, el mismo semáforo se calcula contra el umbral de la torre que está armada, con la acción y las horas que lleva. Hasta entonces el cartel es del lugar, no de una estructura.

## Qué hay que configurar

Nada es obligatorio para que la página abra. Para que el ranking empiece a llenarse:

- Un store de Vercel Blob y `BLOB_READ_WRITE_TOKEN`, o las dos variables de KV.
- `CRON_SECRET` en Vercel, el mismo que el cron manda en `Authorization`.

El detalle de nombres está en el `README.md` y en `.env.example`.
