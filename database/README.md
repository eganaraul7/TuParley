# TuParley — Base de Datos

## Orden de ejecución

```bash
# 1. Crear la base de datos y todas las tablas
mysql -u root -p < schema.sql

# 2. Insertar datos iniciales
mysql -u root -p < seeds.sql

# 3. Aplicar índices adicionales (opcional pero recomendado)
mysql -u root -p < migrations/002_additional_indexes.sql
```

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
node -e "const b=require('bcrypt'); b.hash('TuNuevaContraseña',12).then(h=>console.log(h))"
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
CADUCADO_GANADOR→ ganó pero no cobró en 48 horas
```

## Roles de usuario

```
computadora_madre  → acceso total, 2FA obligatorio
administrador      → igual a computadora_madre, 2FA obligatorio
bodeguero          → solo su bodega, sin acceso global
desconocido        → acceso pendiente de aprobación por admin
```