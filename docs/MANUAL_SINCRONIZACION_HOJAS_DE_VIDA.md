# Sincronización automática de funcionarios y hojas de vida

## Fuente maestra

La micropágina consulta únicamente fuentes públicas oficiales de la Alcaldía de San Pedro:

- Directorio de funcionarios.
- Publicación consolidada del directorio.
- Buscador institucional de hojas de vida.
- Ofertas de empleo y convocatorias.
- Enlaces a SIGEP II publicados en cada perfil.

## Funcionamiento

El flujo `.github/workflows/sync-funcionarios.yml` se ejecuta diariamente a las 5:30 a. m. hora de Colombia y también puede iniciarse manualmente desde la pestaña **Actions** de GitHub.

El script:

1. Revisa las fuentes institucionales.
2. Descubre perfiles individuales del directorio.
3. Extrae nombre, cargo, dependencia, correo, teléfono, perfil, hoja de vida y enlace SIGEP.
4. Incorpora perfiles nuevos.
5. Actualiza los existentes sin borrar el histórico.
6. Localiza publicaciones de candidatos, aspirantes y convocatorias.
7. Genera `data/funcionarios.json` y un informe técnico de sincronización.
8. Publica automáticamente el cambio en GitHub Pages.

## Gestión de fallos

Si la sede electrónica no responde, el flujo conserva la última versión válida y no vacía el directorio. El resultado de cada revisión queda en `docs/ultimo-reporte-sincronizacion.json`.

## Participación ciudadana

Los formularios de cada perfil escriben en la colección privada `gobierno_abierto_observaciones`. El panel administrador existente permite revisar la observación, responderla y publicar únicamente una versión anonimizada en `gobierno_abierto_respuestas_publicas`.

## Protección de datos

La micropágina no descarga ni replica números de identificación, direcciones, datos familiares, firmas, soportes académicos ni otros datos sensibles. Enlaza la versión pública de la fuente institucional y SIGEP II.
