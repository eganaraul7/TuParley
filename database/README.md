# TuParley — Base de Datos

## Orden de ejecución

**Desarrollo local con Docker:** `docker compose up -d` crea la base con `schema.sql`, `seeds.sql` y las migraciones 002 → 007 (solo la primera vez, con el volumen vacío).

**Base existente o servidor:** desde `backend/`

```bash
npm run db:migrate
```

`migrate.js` lee `backend/.env`, aplica en orden `schema.sql`, `seeds.sql` y `migrations/*.sql`, y salta las versiones ya registradas en `schema_migrations`. Se puede ejecutar varias veces sin riesgo: no borra datos.

Cada migración nueva debe terminar registrando su versión:

```sql
INSERT IGNORE INTO schema_migrations (version) VALUES ('008_mi_cambio');
```

(`schema_migrations.version` es VARCHAR(20): se comparan los primeros 20 caracteres del nombre del archivo.)

## Credenciales iniciales

| Campo          | Valor                    |
|----------------|--------------------------|
| Usuario        | `computadora_madre`      |
| Contraseña     | `Admin@TuParley2024!`    |
| Rol            | `computadora_madre`      |

> ⚠️ **CAMBIA LA CONTRASEÑA INMEDIATAMENTE** tras el primer login.

## Regenerar el hash de contraseña

Si necesitas cambiar la contraseña del root antes de insertar seeds:

```bash
cd backend
node -e "require('bcrypt').hash('TuNuevaContraseña',12).then(h=>console.log(h))"
```

Reemplaza el hash en `seeds.sql` línea del INSERT de `computadora_madre`.

## Tablas y su propósito

| Tabla                    | Descripción                                      |
|--------------------------|--------------------------------------------------|
| `bodegas`                | Locales físicos donde opera el sistema           |
| `usuarios`               | Cuentas del sistema (todos los roles)            |
| `configuracion_sistema`  | Parámetros globales configurables por admin      |
| `tasa_bcv`               | Historial de tasas BCV (API + manual)            |
| `categorias_config`      | Activar/desactivar deportes por admin            |
| `eventos`                | Partidos y competencias disponibles para apostar |
| `modalidades`            | Tipos de apuesta por deporte con cuotas          |
| `tickets`                | Apuestas realizadas por clientes                 |
| `selecciones_ticket`     | Cada evento dentro de un ticket parlay           |
| `pagos`                  | Registro de premios pagados                      |
| `solicitudes_anulacion`  | Flujo formal de anulación de tickets             |
| `cierre_caja`            | Cierre diario del bodeguero con validación       |
| `auditoria_logs`         | Log completo de acciones críticas                |
| `notificaciones`         | Alertas para el panel de administración          |
| `solicitudes_reingreso`  | Solicitudes de acceso accidental post-cierre     |
| `estadisticas_mensuales` | Reportes agregados por bodega y global           |
| `schema_migrations`      | Control de versiones de la BD                    |

## Estados de ticket

```
PENDIENTE       → apuesta activa, evento no ha terminado
GANADO          → cliente acertó, puede cobrar (48h)
PERDIDO         → cliente no acertó
PAGADO          → premio entregado
ANULADO         → cancelado por admin (solicitud formal)
SUSPENDIDO      → evento cancelado, cliente puede pedir devolución
REEMBOLSADO     → se devolvió lo apostado (pagos.tipo = 'reembolso')
CADUCADO_GANADOR→ ganó pero no cobró en 48 horas
```

## Roles de usuario

```
computadora_madre  → acceso total; única que gestiona su propia cuenta
administrador      → panel completo, no puede gestionar a computadora_madre
bodeguero          → solo su bodega, sin acceso global
desconocido        → acceso pendiente de aprobación por admin
```