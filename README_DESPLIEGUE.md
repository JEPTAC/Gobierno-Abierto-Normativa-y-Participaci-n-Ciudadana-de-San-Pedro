# Gobierno Abierto y Normativa — San Pedro, Valle del Cauca

Micropágina estática para GitHub Pages con actualización dinámica mediante Firebase Firestore. Consolida decisiones de impacto, mecanismos de supervisión, hojas de vida para observaciones, Gaceta Oficial, Agenda Regulatoria y participación normativa/SUCOP.

## 1. Publicación en GitHub Pages

1. Cree un repositorio público, por ejemplo `Gobierno-Abierto-Normativa-San-Pedro`.
2. Suba **todo el contenido de esta carpeta a la raíz** del repositorio. No suba la carpeta contenedora como subcarpeta.
3. Use la rama `main`.
4. En GitHub abra **Settings → Pages**.
5. En **Build and deployment → Source**, seleccione **GitHub Actions**.
6. El flujo `.github/workflows/pages.yml` publicará automáticamente la micropágina.
7. La dirección esperada será similar a:
   `https://USUARIO.github.io/Gobierno-Abierto-Normativa-San-Pedro/`

La página funciona con los datos institucionales precargados aunque Firebase todavía no tenga registros.

## 2. Configuración de Firebase

El archivo `firebase-config.js` ya apunta al proyecto `rendicion-de-cuentas-6aceb` y utiliza colecciones nuevas, sin modificar las colecciones de otras aplicaciones:

- `gobierno_abierto_publicaciones`
- `gobierno_abierto_observaciones`
- `gobierno_abierto_respuestas_publicas`
- `gobierno_abierto_config`
- `gobierno_abierto_admins`
- `gobierno_abierto_auditoria`

### Authentication

1. Abra Firebase Console → Authentication → Sign-in method.
2. Habilite **Google**.
3. En Authentication → Settings → Authorized domains, agregue:
   - `USUARIO.github.io`
   - el dominio municipal, si después se incrusta o publica allí.

### Reglas de Firestore combinadas

El archivo `firestore.rules` ya integra las reglas generales del portal, los formularios de participación, el tablero ciudadano, las evaluaciones, el laboratorio de ideas y las seis colecciones de Gobierno Abierto. Debe reemplazarse el conjunto completo de reglas del proyecto; no se debe pegar como un segundo bloque independiente.

Desde una terminal con Firebase CLI:

```bash
npm install -g firebase-tools
firebase login
firebase use rendicion-de-cuentas-6aceb
firebase deploy --only firestore:rules,firestore:indexes
```

También puede copiar el contenido de `firestore.rules` en Firebase Console → Firestore Database → Rules.

### Autorización administrativa

La micropágina reconoce, en este orden, cualquiera de las siguientes fuentes de autorización:

1. Documento `gobierno_abierto_admins/{UID}`.
2. Perfil institucional `users/{UID}`.
3. Perfil legado `users/{correo}`.
4. Custom claims `role`, `userRole`, `admin` o `super_admin`.

Los roles admitidos para abrir el panel completo son `admin`, `administrador`, `super_admin`, `superadmin`, `super_administrador`, `superadministrador` y `administrador_principal`, siempre que el perfil no tenga `active: false`.

Cuando se prefiera aislar el acceso únicamente para esta micropágina, cree `gobierno_abierto_admins/{UID}` con:

```json
{
  "active": true,
  "role": "superadmin",
  "name": "Nombre del administrador",
  "email": "correo@sanpedro-valle.gov.co"
}
```

La creación y modificación de administradores queda reservada al superadministrador. No existe autoasignación de privilegios desde el navegador.

## 3. Cargar los registros iniciales

1. Abra la micropágina publicada.
2. En el pie de página seleccione **Administración de contenidos**.
3. Inicie sesión con la cuenta autorizada.
4. En **Resumen**, seleccione **Cargar datos iniciales en Firestore**.
5. Verifique que aparezcan las publicaciones en las cinco categorías.

La carga utiliza IDs estables y puede repetirse sin duplicar registros.

## 4. Completar la habilitación SUCOP

Cuando el Departamento Nacional de Planeación entregue el enlace institucional:

1. Abra Administración → Configuración.
2. Pegue la URL directa en **URL directa del perfil o proceso institucional en SUCOP**.
3. Actualice el texto de estado.
4. Guarde.

La sección principal y la página independiente cambiarán automáticamente al enlace institucional.

## 5. Publicar hojas de vida

Cada proceso debe crear una ficha con:

- cargo o designación;
- fundamento del proceso;
- dependencia responsable;
- versión pública de la hoja de vida;
- fecha y hora de apertura;
- fecha y hora de cierre;
- canal de observaciones;
- estado final y archivo histórico.

No publique cédulas completas, direcciones residenciales, teléfonos personales, firmas, información médica, familiar o financiera.

## 6. Operación de observaciones ciudadanas

- La colección `gobierno_abierto_observaciones` es privada.
- El panel administrador muestra los datos de contacto solo a usuarios autorizados.
- La respuesta pública debe ser anonimizada.
- Al publicar una respuesta se crea o actualiza un documento en `gobierno_abierto_respuestas_publicas`.
- La ciudadanía consulta el estado con el código `SP-NOR-AAAA-XXXXXX`.

## 7. Archivos principales

- `index.html`: portada y módulos integrados.
- `app.js`: interfaz, Firebase, formularios y administración.
- `data/seed-data.js`: información institucional precargada.
- `firestore.rules`: seguridad de datos.
- `decisiones-impacto.html`: enlace directo ITA.
- `supervision-vigilancia.html`: enlace directo ITA.
- `hojas-de-vida.html`: enlace directo ITA.
- `gaceta-oficial.html`: enlace directo ITA.
- `agenda-regulatoria-2026.html`: enlace directo ITA.
- `participacion-normativa-sucop.html`: enlace directo ITA.
- `docs/matriz-cumplimiento.html`: cobertura y estado operativo.

## 8. Mantenimiento

- Verificar enlaces mensualmente.
- Registrar cada nuevo acto en la Gaceta.
- Actualizar la Agenda cuando haya adiciones, retiros o cambios.
- Archivar los procesos de hojas de vida al cerrar observaciones.
- Responder observaciones dentro del procedimiento aplicable.
- Revisar accesibilidad, contraste, teclado y reflujo después de cambios de diseño.
- Exportar periódicamente una copia de Firestore.

---

## Directorio automático de funcionarios y hojas de vida

La página `hojas-de-vida.html` fue reemplazada por el módulo **Talento Público Abierto**. Incluye:

- Directorio individual de funcionarios y servidores.
- Enlaces al perfil institucional, hoja de vida pública y SIGEP II.
- Filtros por nombre, cargo, dependencia y estado.
- Procesos activos e históricos sometidos a consideración ciudadana.
- Formulario individual de observaciones con código de seguimiento.
- Integración con el panel administrativo de observaciones existente.
- Actualización diaria desde la sede electrónica mediante GitHub Actions.

### Activar la sincronización

1. Suba todos los archivos del paquete al repositorio.
2. Abra **Actions** en GitHub.
3. Seleccione **Sincronizar directorio de funcionarios**.
4. Pulse **Run workflow** para ejecutar la primera actualización.
5. El flujo se repetirá diariamente a las 5:30 a. m. hora de Colombia.

El resultado queda en `data/funcionarios.json`. El informe técnico de cada revisión queda en `docs/ultimo-reporte-sincronizacion.json`.

No es necesario crear una nueva colección de Firestore: las observaciones utilizan `gobierno_abierto_observaciones` y las respuestas públicas `gobierno_abierto_respuestas_publicas`, ambas ya protegidas por las reglas integradas.


## Talento Público V3 - carrera administrativa

La página `hojas-de-vida.html#carrera` contiene fichas públicas protegidas de servidores de carrera administrativa. No suba los expedientes laborales PDF al repositorio. El paquete ya está diseñado para publicar solo datos funcionales minimizados y conservar los archivos fuente bajo custodia de Talento Humano.

La sincronización diaria reconoce `manualProtected: true`, por lo que no elimina estas fichas aunque la sede electrónica no las devuelva temporalmente. Cuando encuentre un perfil oficial coincidente, actualiza la información institucional y conserva los datos de carrera.

Verifique antes del despliegue:

- que no existan archivos PDF de historias laborales en el repositorio;
- que las cuatro fichas protegidas abran correctamente;
- que el formulario de comentarios radique en Firestore;
- que la URL pública sea `hojas-de-vida.html#carrera`.
