# Actualización Talento Público Abierto V3

## Alcance

Esta versión incorpora un módulo específico de **servidores de carrera administrativa** con cuatro fichas públicas protegidas:

- Jorge Ricardo Peláez Ospina.
- Maricel Warner Garzón.
- Jimmy Alexander Alzate.
- Dahianna Echeverry Santacoloma.

Las fichas muestran únicamente nombre, cargo, dependencia, naturaleza de la vinculación, código, grado y síntesis del soporte de mérito o nombramiento. Los expedientes laborales escaneados no se incluyen en el repositorio ni se entregan al navegador.

## Archivos principales

- `hojas-de-vida.html`
- `hojas-de-vida.css`
- `hojas-de-vida.js`
- `data/funcionarios.json`
- `scripts/sync-funcionarios.mjs`
- `.github/workflows/sync-funcionarios.yml`
- `docs/directorio-funcionarios-verificados.csv`
- `docs/PROTOCOLO_PUBLICACION_CARRERA_ADMINISTRATIVA.md`
- `docs/REGISTRO_VERIFICACION_CARRERA.md`

## Protección aplicada

1. No se copian los PDF laborales a GitHub Pages.
2. La ficha protegida no ofrece botón de descarga ni impresión.
3. Se bloquean, como medida disuasoria, menú contextual, selección, copia, arrastre y atajos comunes.
4. Se agrega marca de agua dinámica de sesión.
5. El formulario ciudadano permite comentar o solicitar corrección sin exponer el expediente.
6. La protección principal es la minimización: el navegador nunca recibe cédulas, firmas, datos bancarios, familiares, médicos, afiliaciones ni evaluaciones individuales.

> Ningún sitio web puede impedir de forma absoluta una captura de pantalla o una fotografía tomada desde otro dispositivo. No se debe afirmar lo contrario.

## Sincronización automática

El flujo diario conserva las fichas con `manualProtected: true`. Si la sede electrónica publica un perfil coincidente, actualiza los datos institucionales sin eliminar la condición de carrera ni la síntesis documental protegida.

## Después de subir a GitHub

1. Reemplace todos los archivos por esta versión.
2. Verifique `firebase-config.js`.
3. Publique la rama principal.
4. Ejecute **Actions → Sincronizar directorio de funcionarios → Run workflow**.
5. Abra `hojas-de-vida.html#carrera`.
6. Pruebe las cuatro fichas protegidas y una observación ciudadana.
7. Confirme que ningún PDF de expediente laboral aparezca en el repositorio público.

## Firebase

No se crean colecciones nuevas. Se mantienen:

- `gobierno_abierto_observaciones`
- `gobierno_abierto_respuestas_publicas`
- `gobierno_abierto_publicaciones`

Las reglas Firestore combinadas incluidas en el paquete continúan siendo compatibles.
