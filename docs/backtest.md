# Hito 2 — diagnóstico y método de verificación

Fecha de revisión: 2026-11-11. Lugar prioritario: Estadio San Juan del Bicentenario, Pocito.

## Resultado comprobado

- La web pública responde y ofrece ingreso desde Telegram con `/web` o por correo. En el código, la vista autenticada muestra hoy, mañana y la semana por lugar; en pantalla angosta usa tarjetas. No se verificó una sesión personal completa ni la recepción efectiva de mensajes en el teléfono de Hugo.
- La producción de Vercel está lista sobre el commit `6618364` de `main`. La base compartida `handy`, esquema `clima`, contiene pronósticos de cinco modelos Open-Meteo y WRF SMN desde el 30/09. Para cada una de las 168 horas válidas de los siete días previos a esta revisión hay al menos una versión guardada con 24 h y otra con 48 h de anticipación, tanto de Open-Meteo como de WRF. Esto **no mide acierto**.
- A las 21:12 UTC del 11/11, Open-Meteo llevaba 8 minutos desde su último ingreso; WRF llevaba 8 h 14 min. La tabla `system_health` registró aviso de caída del WRF a las 19:00 UTC. Una ejecución posterior a las 21:35 UTC incorporó correctamente la corrida WRF de las 18:00 UTC (219 filas para tres lugares). El atraso fue real y se recuperó; conviene vigilar intervalos largos entre ejecuciones. La vista de prueba excluye fuentes mientras estén atrasadas.
- El bot responde consultas y la web muestra un máximo diario de ráfagas con una hora puntual. No hay todavía avisos preventivos por episodio, detector de Zonda, alertas CAP del SMN integradas, probabilidad horaria de lluvia ni una ventana horaria de inicio y fin. El rótulo de viento usa Beaufort como vocabulario meteorológico, no como riesgo de estructuras.
- No existen tablas de observaciones, alertas ni puntuación de modelos en producción. Ahora hay cinco días con viento medido en SANU en `docs/refs/backtest_eventos.csv`, como referencia externa. No hay aún una tasa defendible de avisos acertados, falsas alarmas o episodios perdidos.
- El archivo de observaciones SMN del 11/11 responde y trae una única lectura visible de San Juan (18:00, zona horaria aún no confirmada; viento sudeste de 9 km/h). El archivo pedido para el 09/11 devuelve «El archivo no existe», aunque el servidor responda HTTP 200. No se puede suponer que este enlace sirva como serie histórica horaria ni comparar horas hasta aclarar la zona horaria.

## Comparación preparada

1. Elegir 3 a 5 episodios pasados en `docs/refs/backtest_eventos.csv` con hora aproximada y fuente verificable, incluyendo Zonda, viento de cualquier dirección y lluvia cuando haya evidencia. Los cinco días actuales son una muestra de viento medido en el aeropuerto; confirmar inicio y fin de cada episodio y obtener evidencia de Zonda o lluvia por separado. Guardar por separado lo que se observó realmente en el Estadio y lo medido en SANU.
2. Extraer las versiones de pronóstico con `scripts/backtest-snapshots.sql`, ajustando lugar y fechas. La consulta usa `ingested_at` anterior al instante pronosticado en 24 o 48 h. `run_time` de Open-Meteo es una franja de 6 h y exageraría el margen si se usara como hora de emisión; el WRF también puede publicarse horas después de su corrida.
3. Para cada hora, comparar por modelo viento medio, lluvia y ráfaga prevista cuando haya observación adecuada. El METAR de SANU trae viento medio horario y sólo algunas ráfagas informadas; no ofrece una serie completa de ráfagas ni lluvia cuantitativa comparable. Una estación fuera del predio no prueba la ráfaga exacta en el Estadio.
4. Definir episodios meteorológicos con una referencia externa y documentada (por ejemplo, alerta CAP y registro de viento/lluvia), sin inventar umbrales estructurales. Medir hora de primera señal, margen antes del inicio observado, diferencia de intensidad de viento y lluvia, error de horario, avisos falsos y episodios sin señal. Distinguir “pronóstico disponible” de “mensaje efectivamente enviado”, porque todavía no hay bitácora de alertas.
5. Publicar resultados por horizonte de 24 y 48 h y por fuente, con número de casos y datos faltantes. Ajustar después el texto y la combinación. Un mayor acuerdo entre modelos puede indicar menor dispersión, pero no demuestra acierto.

## Primer contraste medido: viento medio, estación SANU

El 11/11 se consultó la [API oficial de METAR de Aviation Weather Center](https://aviationweather.gov/api/data/metar?ids=SANU&hours=720&format=json). Devolvió 400 registros entre el 26/10 y el 11/11. Se conservaron las 120 observaciones horarias de los cinco días UTC con mayor pico diario de viento medio en esa muestra (1, 4, 6, 7 y 10/11) en `docs/refs/sanu_metar_windy_days_2026-11.csv`; los días y sus máximos están en `docs/refs/backtest_eventos.csv`. SANU informa coordenadas -31,572, -68,418, aproximadamente **11,3 km** del Estadio. Sus datos son de estación, no del predio.

Se tomó para cada modelo la última versión guardada **antes** del corte de 24 o 48 h, y se comparó su viento medio horario previsto para el Estadio con el viento medio medido en SANU (nudos convertidos a km/h con factor 1,852). Los seis modelos tuvieron datos para las 120 horas. Error absoluto medio y sesgo positivo = pronóstico más alto que la estación:

| Horizonte | Valor más alto entre modelos: error / sesgo | Mediana: error / sesgo |
| --- | ---: | ---: |
| 24 h | 9,6 / +8,1 km/h | 7,8 / -3,1 km/h |
| 48 h | 9,7 / +7,9 km/h | 8,3 / -3,9 km/h |

El 10/11 a las 14:00 UTC, SANU midió viento sur de 33 nudos (61,1 km/h). Para esa hora, el valor más alto entre los modelos archivados para el Estadio era 46,6 km/h a 24 h y 47,7 km/h a 48 h. Es un ejemplo concreto de posible subestimación **en la comparación entre dos sitios**; no prueba qué velocidad hubo en el Estadio ni qué aviso se habría enviado.

**Alcance del contraste:** los cinco días fueron elegidos por viento observado, por lo que los errores no representan todos los días y no permiten contar falsas alarmas. Una estación a 11,3 km puede diferir por terreno y exposición; no hay verificación de ráfagas del predio. Los desfasajes de pico diario calculados entre pronóstico y estación van de -3 a +7 h, pero el inicio y fin de cada episodio todavía no están validados. No se evaluaron lluvia ni Zonda. No cambiar la regla de peor caso sólo porque una mediana tenga menor error medio en esta muestra.

## Prioridad de producto tras esta medición

1. Fiesta del Sol: mostrar por lugar **ventanas horarias** para lluvia, viento fuerte de cualquier dirección y posible Zonda como fenómeno local adicional, con intensidad prevista, rango entre modelos, hora de actualización y una indicación honesta de incertidumbre. Adelantar cambios relevantes de mañana; evitar prometer una hora exacta cuando los modelos discrepan. Usar las alertas oficiales del SMN como señal identificada y con atribución. El ejemplo de 60 km/h dado por Hugo no fija un umbral de aviso.
2. Abrir fácilmente la web en el celular y consultar el pronóstico cuando Hugo lo necesite. Probar con su sesión real el recorrido `/web` → “Entrar” → estadio; revisar legibilidad y acceso directo en su teléfono.
3. Evaluar un canal de aviso que se vea mejor que Telegram. Las notificaciones web y WhatsApp figuran en Fase 2 del plan; elegir canal y costos antes de implementarlo, sin contratar ni enviar pruebas a terceros durante este hito.
4. Luego, permitir varios eventos simultáneos con ubicación, calendario, fases y avisos separados, reutilizando el mismo pronóstico por lugar. Para la primera entrega, concentrarse en Fiesta del Sol.

Los avisos pedidos son meteorológicos y preventivos para organizar horarios y asegurar materiales sueltos. Los umbrales de resistencia de estructuras no bloquean este trabajo.

## Versión de prueba en el PR #7

- La web autenticada muestra mañana por hora local: el momento del mayor viento, rangos de viento y ráfagas entre modelos, dirección del modelo más intenso y tramos consecutivos donde al menos un modelo pronostica lluvia. El detalle de las 24 horas queda desplegable para consultar a demanda. No convierte cantidad de modelos en probabilidad ni el ejemplo de 60 km/h en umbral.
- Las fuentes con más de 6 h sin actualizar quedan fuera del pronóstico combinado y del detalle horario. La página avisa qué fuente está atrasada y muestra cuáles aportan datos recientes. El bot conserva su consulta diaria y también identifica sólo las fuentes que aportan datos recientes.
- Para lugares de San Juan, la vista aclara que aún no determina Zonda y dirige a las alertas oficiales del SMN. No clasifica Zonda sólo por dirección del viento.
- Es una **vista de prueba**, no un envío de avisos. Falta validar con Hugo en su teléfono, medir el backtest, definir reglas de aviso meteorológico y elegir un canal visible antes de activar notificaciones.
- Para revisar el diseño sin iniciar sesión en el dominio temporal, `/demo` está disponible sólo en despliegues Vercel de vista previa. La pantalla lleva una advertencia destacada y usa datos ficticios. Se comprobó en un ancho de 390 px; el detalle de las 24 horas se abre y desplaza dentro de la tarjeta. El acceso autenticado con datos reales sigue pendiente de prueba en el teléfono de Hugo.
