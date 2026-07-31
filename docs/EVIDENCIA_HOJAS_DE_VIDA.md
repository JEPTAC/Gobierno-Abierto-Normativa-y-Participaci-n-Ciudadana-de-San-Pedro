# Evidencia de publicación: directorio y hojas de vida

## URL directa para la matriz ITA

`[URL-BASE]/hojas-de-vida.html`

## Alcance publicado

- Directorio individual de funcionarios y servidores públicos identificados en la sede electrónica.
- Cargo, dependencia, correo institucional, teléfono y estado de verificación.
- Enlace directo al perfil institucional.
- Acceso a la hoja de vida pública o a SIGEP II.
- Procesos activos e históricos sometidos a consideración ciudadana.
- Periodo de observaciones cuando sea aplicable.
- Canal de participación individual con código de seguimiento.
- Moderación institucional y respuesta pública anonimizada.
- Sincronización automática diaria desde las fuentes oficiales.

## Fuentes

- https://www.sanpedro-valle.gov.co/tema/directorio-de-funcionarios
- https://www.sanpedro-valle.gov.co/directorio-de-funcionarios/directorio-de-funcionarios-269806
- https://www.sanpedro-valle.gov.co/buscar?q=hoja%20de%20vida
- https://www.sanpedro-valle.gov.co/tema/ofertas-de-empleo
- https://www.sanpedro-valle.gov.co/tema/convocatorias
- https://www.funcionpublica.gov.co/sigep2/directorio

## Archivos verificables

- `data/funcionarios.json`: fuente estructurada consumida por la página.
- `docs/directorio-funcionarios-verificados.csv`: exportación tabular.
- `docs/ultimo-reporte-sincronizacion.json`: resultado de la última revisión automática.
- `.github/workflows/sync-funcionarios.yml`: programación diaria.
- `scripts/sync-funcionarios.mjs`: lógica de descubrimiento, actualización e histórico.
