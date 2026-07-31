# Actualización Talento Público Abierto

## Archivos principales

- `hojas-de-vida.html`
- `hojas-de-vida.css`
- `hojas-de-vida.js`
- `data/funcionarios.json`
- `scripts/sync-funcionarios.mjs`
- `.github/workflows/sync-funcionarios.yml`
- `package.json`
- `docs/directorio-funcionarios-verificados.csv`
- `docs/ultimo-reporte-sincronizacion.json`
- `docs/MANUAL_SINCRONIZACION_HOJAS_DE_VIDA.md`
- `docs/EVIDENCIA_HOJAS_DE_VIDA.md`

## Después de subir a GitHub

1. Abra la pestaña **Actions**.
2. Ejecute manualmente **Sincronizar directorio de funcionarios**.
3. Confirme que `data/funcionarios.json` se actualizó y que GitHub Pages terminó el nuevo despliegue.
4. Pruebe una observación con una cuenta de correo real y confirme que aparece en el panel administrativo de la micropágina.
5. Verifique que el enlace público final sea `[URL-BASE]/hojas-de-vida.html`.

## Firebase

No se crean colecciones nuevas. El módulo utiliza las colecciones ya integradas:

- `gobierno_abierto_observaciones`
- `gobierno_abierto_respuestas_publicas`
- `gobierno_abierto_publicaciones`

Por lo tanto, las reglas Firestore combinadas incluidas en el paquete continúan siendo compatibles.
