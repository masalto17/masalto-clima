# Hito 2 — diagnóstico y método de verificación

Fecha de revisión: 2026-11-11. Lugar prioritario: Estadio San Juan del Bicentenario, Pocito.

## Resultado comprobado

- La web pública responde y ofrece ingreso desde Telegram con `/web` o por correo. En el código, la vista autenticada muestra hoy, mañana y la semana por lugar; en pantalla angosta usa tarjetas. No se verificó una sesión personal completa ni la recepción efectiva de mensajes en el teléfono de Hugo.
- La producción de Vercel está lista sobre el commit `6618364` de `main`. La base compartida `handy`, esquema `clima`, contiene pronósticos de cinco modelos Open-Meteo y WRF SMN desde el 30/09. Para cada una de las 168 horas válidas de los siete días previos a esta revisión hay al menos una versión guardada con 24 h y otra con 48 h de anticipación, tanto de Open-Meteo como de WRF. Esto **no mide acierto**.
- A las 21:12 UTC del 11/11, Open-Meteo llevaba 8 minutos desde su último ingreso; WRF llevaba 8 h 14 min. La tabla `system_health` registró aviso de caída del WRF a las 19:00 UTC. Conviene investigar por qué la corrida WRF no se renueva; ese dato viejo no debe presentarse como actual.
- El bot responde consultas y la web muestra un máximo diario de ráfagas con una hora puntual. No hay todavía avisos preventivos por episodio, detector de Zonda, alertas CAP del SMN integradas, probabilidad horaria de lluvia ni una ventana horaria de inicio y fin. El rótulo de viento usa Beaufort como vocabulario meteorológico, no como riesgo de estructuras.
- No existen tablas de observaciones, alertas ni puntuación de modelos en producción. `docs/refs/backtest_eventos.csv` no tiene episodios. Por tanto no hay hoy una tasa defendible de aciertos, falsas alarmas o episodios perdidos.
- El archivo de observaciones SMN del 11/11 responde y trae una única lectura visible de San Juan (18:00, zona horaria aún no confirmada; viento sudeste de 9 km/h). El archivo pedido para el 09/11 devuelve «El archivo no existe», aunque el servidor responda HTTP 200. No se puede suponer que este enlace sirva como serie histórica horaria ni comparar horas hasta aclarar la zona horaria.

## Comparación preparada

1. Elegir 3 a 5 episodios pasados en `docs/refs/backtest_eventos.csv` con hora aproximada y fuente verificable, incluyendo Zonda, viento de cualquier dirección y lluvia cuando haya evidencia. Guardar por separado lo que se observó realmente en el estadio y lo medido en la estación de San Juan. Conseguir un archivo histórico horario válido antes de calcular errores; el enlace diario probado no lo ofrece para el 09/11.
2. Extraer las versiones de pronóstico con `scripts/backtest-snapshots.sql`, ajustando lugar y fechas. La consulta usa `ingested_at` anterior al instante pronosticado en 24 o 48 h. `run_time` de Open-Meteo es una franja de 6 h y exageraría el margen si se usara como hora de emisión; el WRF también puede publicarse horas después de su corrida.
3. Para cada hora, comparar por modelo viento medio, lluvia y ráfaga prevista. La observación SMN horaria disponible en el diagnóstico previo contiene viento medio, pero no ráfagas. Por eso la ráfaga sólo puede cotejarse con medición local o una fuente histórica que la incluya y documente. Una estación fuera del predio no prueba la ráfaga exacta en el estadio.
4. Definir episodios meteorológicos con una referencia externa y documentada (por ejemplo, alerta CAP y registro de viento/lluvia), sin inventar umbrales estructurales. Medir hora de primera señal, margen antes del inicio observado, diferencia de intensidad de viento y lluvia, error de horario, avisos falsos y episodios sin señal. Distinguir “pronóstico disponible” de “mensaje efectivamente enviado”, porque todavía no hay bitácora de alertas.
5. Publicar resultados por horizonte de 24 y 48 h y por fuente, con número de casos y datos faltantes. Ajustar después el texto y la combinación. Un mayor acuerdo entre modelos puede indicar menor dispersión, pero no demuestra acierto.

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
