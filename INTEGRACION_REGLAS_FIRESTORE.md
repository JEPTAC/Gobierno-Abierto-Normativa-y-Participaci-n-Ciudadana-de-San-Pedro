# Integración de reglas Firestore

## Alcance

El archivo `firestore.rules` reúne en un único conjunto:

- autenticación por custom claims;
- perfiles `users/{UID}`;
- perfiles legados `users/{correo}`;
- portal principal y edición administrativa;
- ideas y suscripciones;
- inscripción a participación ciudadana;
- aportes públicos;
- evaluaciones de participación;
- decisiones del laboratorio ciudadano;
- configuración de Google Drive y auditoría general;
- micropágina Gobierno Abierto, Normativa y Participación.

## Colecciones nuevas integradas

- `gobierno_abierto_publicaciones`
- `gobierno_abierto_observaciones`
- `gobierno_abierto_respuestas_publicas`
- `gobierno_abierto_config`
- `gobierno_abierto_admins`
- `gobierno_abierto_auditoria`

## Modelo de permisos

| Recurso | Ciudadanía | Administrador institucional |
|---|---|---|
| Publicaciones | Lectura solo cuando `published == true` | Crear, editar, publicar y eliminar |
| Observaciones | Crear con validación estricta | Lectura, respuesta, actualización y eliminación |
| Respuestas públicas | Lectura solo cuando `published == true` | Crear, editar y eliminar |
| Configuración | Lectura pública | Actualización administrativa |
| Administradores | Consulta del perfil propio | Gestión reservada al superadministrador |
| Auditoría | Sin acceso | Crear y consultar; no se permite alterar ni eliminar |

## Compatibilidad de roles

La micropágina reconoce administradores desde:

1. `gobierno_abierto_admins/{UID}`.
2. `users/{UID}`.
3. `users/{correo}`.
4. Custom claims de Firebase Authentication.

La colección aislada `gobierno_abierto_admins` no concede acceso automático a los demás módulos del portal. Los permisos generales continúan dependiendo de `users` o de custom claims.

## Cambio requerido en la consulta pública

La consulta del código de seguimiento ahora exige simultáneamente:

```javascript
where("ticket", "==", code)
where("published", "==", true)
```

Este ajuste es obligatorio porque las reglas de Firestore no actúan como filtros. La consulta debe demostrar que solo puede devolver respuestas publicadas.

## Despliegue

Reemplace el conjunto completo de reglas del proyecto por `firestore.rules` y despliegue también los índices:

```bash
firebase use rendicion-de-cuentas-6aceb
firebase deploy --only firestore:rules,firestore:indexes
```

No agregue un segundo bloque `service cloud.firestore`; Firestore admite un único conjunto integrado por archivo.
