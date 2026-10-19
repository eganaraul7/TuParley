# TuParley — Sistema de Gestión de Apuestas Deportivas

Sistema de apuestas tipo parlay para bodegas físicas venezolanas. Opera desde tablets en locales, con sincronización en tiempo real a un servidor central en la nube, soporte offline con cola local y control administrativo total desde un panel web.

---

## Índice

1. [Qué es TuParley](#1-qué-es-tuparley)
2. [Stack técnico](#2-stack-técnico)
3. [Lo que necesitas instalar una sola vez (Windows)](#3-lo-que-necesitas-instalar-una-sola-vez-windows)
4. [Configuración inicial — solo la primera vez](#4-configuración-inicial--solo-la-primera-vez)
5. [Flujo de trabajo diario — Desarrollo local](#5-flujo-de-trabajo-diario--desarrollo-local)
6. [Si hiciste cambios o jalaste de GitHub](#6-si-hiciste-cambios-o-jalaste-de-github)
7. [Cerrar todo al final del día](#7-cerrar-todo-al-final-del-día)
8. [Despliegue en la nube — DigitalOcean](#8-despliegue-en-la-nube--digitalocean)
9. [Distribución a las tablets](#9-distribución-a-las-tablets)
10. [Variables de entorno — referencia completa](#10-variables-de-entorno--referencia-completa)
11. [Credenciales iniciales](#11-credenciales-iniciales)
12. [Estructura del proyecto](#12-estructura-del-proyecto)
13. [Apuestas, resultados y liquidación](#13-apuestas-resultados-y-liquidación)
14. [Pruebas](#14-pruebas)
15. [Solución de problemas](#15-solución-de-problemas)

---

## 1. Qué es TuParley

| Campo | Detalle |
|---|---|
| **Nombre** | TuParley |
| **Función** | POS de apuestas deportivas tipo parlay para bodegas físicas |
| **Usuarios** | Bodegueros (operan la tablet) y clientes (hacen apuestas) |
| **Administración** | Panel web accesible desde cualquier dispositivo con credenciales admin |
| **Monetización** | 80 % operador central / 20 % bodega |
| **Límite de ganancia** | $300 USD por ticket (configurable) |
| **Apuesta mínima** | $1 USD (se convierte a Bs según tasa BCV del día) |
| **Deportes** | Fútbol, Baloncesto, Béisbol, Tenis, MMA |
| **Impresión** | Física (térmica USB/BT) y digital (QR) — configurable por bodega |
| **Offline** | Cola local en IndexedDB; sincroniza automáticamente al recuperar conexión |

---

## 2. Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Zustand |
| Backend | Node.js 20 + Express + Socket.io |
| Base de datos | MySQL 8 |
| Caché / Sesiones | Redis 7 |
| Autenticación | JWT (una sesión activa por usuario) + TOTP 2FA opcional para admins |
| Impresión | ESC/POS vía WebUSB y Bluetooth Web API |
| PWA | Service Worker + Web Manifest (instalable en tablets) |
| Proceso en prod | PM2 |
| Proxy inverso | Nginx |
| Nube | DigitalOcean (Droplet + Managed MySQL + Managed Redis + Spaces) |
| DNS / CDN | Cloudflare |
| Dominio | Namecheap |

---

## 3. Lo que necesitas instalar una sola vez (Windows)

| Herramienta | Dónde | Comprobar |
|---|---|---|
| **Node.js 20 LTS** (o 22 LTS) | https://nodejs.org | `node -v` → `v20.x` / `v22.x` |
| **Docker Desktop** (con WSL 2) | https://www.docker.com/products/docker-desktop | `docker --version` |
| **Git** | https://git-scm.com | `git --version` |
| **Visual Studio Code** | https://code.visualstudio.com | — |

Docker Desktop corre MySQL y Redis sin instalarlos en Windows. Durante su instalación acepta habilitar **WSL 2** y reinicia si lo pide.

### Clonar y abrir en VS Code

```cmd
git clone https://github.com/eganaraul7/TuParley.git
cd TuParley
code .
```

> En VS Code abre la terminal con **Ctrl + ñ** (o *Terminal → Nueva terminal*). Los comandos de esta guía funcionan en **Command Prompt** y en **PowerShell** salvo donde se indique.

---

## 4. Configuración inicial — solo la primera vez

Todos los comandos se ejecutan **desde la raíz del proyecto** (`TuParley\`) salvo que se indique otra carpeta.

### Paso 1 — Instalar dependencias

```cmd
cd backend
npm install
cd ..\frontend
npm install
cd ..
```

### Paso 2 — Crear `backend\.env`

```cmd
copy backend\.env.example backend\.env
```

Abre `backend\.env` en VS Code. Los valores de base de datos y Redis ya coinciden con `docker-compose.yml`. Solo debes completar:

- `JWT_SECRET` — genera uno y pégalo:
  ```cmd
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```
- `API_SPORTS_KEY` — tu clave de https://dashboard.api-football.com (plan gratuito: ~100 peticiones/día por deporte).
- `API_TENNIS_KEY` — tu clave de RapidAPI para api-tennis (opcional).

> Nunca subas `backend\.env` a GitHub (ya está en `.gitignore`).

### Paso 3 — Levantar MySQL y Redis

Abre **Docker Desktop** y espera a que diga *Engine running*. Luego:

```cmd
docker compose up -d
docker compose ps
```

Ambos contenedores deben mostrar `healthy`. La primera vez se crea la base de datos con el esquema, los datos iniciales y **todas** las migraciones (002 → 007).

### Paso 4 — Si tu base de datos ya existía de antes

Si ya tenías el volumen de una versión anterior, aplica las migraciones que falten (no borra datos y salta las ya aplicadas):

```cmd
cd backend
npm run db:migrate
cd ..
```

### Paso 5 — Verificar

```cmd
cd backend
npm test
npm run dev
```

`npm test` debe terminar con `# fail 0`. `npm run dev` debe mostrar `[DB] Conectado a MySQL`, `[Redis] Ping OK` y `TuParley backend corriendo en puerto 4000`. Presiona `Ctrl+C` para detenerlo.

---

## 5. Flujo de trabajo diario — Desarrollo local

1. **Docker Desktop** abierto. Si los contenedores están detenidos: `docker compose up -d` (desde la raíz).
2. **Terminal 1 — backend:**
   ```cmd
   cd backend
   npm run dev
   ```
   Se reinicia solo al guardar cambios en `backend\src\`.
3. **Terminal 2 — frontend** (botón `+` de la terminal de VS Code):
   ```cmd
   cd frontend
   npm run dev
   ```
4. Abre **http://localhost:5173** en Chrome e inicia sesión (ver sección 11).
5. Comprueba que el backend responde: abre http://localhost:4000/health → `{"status":"ok",...}`.

### Primer uso tras instalar

1. Entra como `computadora_madre` y **cambia la contraseña**.
2. **Admin → BCV**: si la API del BCV no respondió, carga la tasa del día a mano (rango 100–5000 Bs/$, configurable en `.env`).
3. **Admin → Usuarios**: crea los bodegueros y asígnales bodega.
4. **Admin → Eventos**: los eventos llegan solos desde API-Sports (cada 6 h). Si no hay clave o se agotó la cuota, usa **Crear evento manual**.
5. **Admin → Configuración**: activa la verificación en dos pasos (2FA) para la cuenta.

### Probar desde una tablet en la misma WiFi

1. Averigua la IP de tu PC: `ipconfig` → *Dirección IPv4* (ej. `192.168.1.50`).
2. En la tablet abre `http://192.168.1.50:5173`. En desarrollo el frontend usa automáticamente el backend de esa misma IP (puerto 4000) y el backend acepta orígenes de la red local.
3. Si no carga, permite **Node.js** en el Firewall de Windows (redes privadas) para los puertos 5173 y 4000.

---

## 6. Si hiciste cambios o jalaste de GitHub

```cmd
git pull origin main
cd backend && npm install && npm run db:migrate && cd ..
cd frontend && npm install && cd ..
```

- Cambios en `backend\src\` o `frontend\src\` se recargan solos.
- **Nueva migración**: crea `database\migrations\00N_descripcion.sql` (que termine con `INSERT IGNORE INTO schema_migrations (version) VALUES ('00N_descripcion');`) y ejecuta `npm run db:migrate` desde `backend\`.
- **Recrear la BD desde cero** (⚠️ borra todos los datos locales): `docker compose down -v` y luego `docker compose up -d`.

---

## 7. Cerrar todo al final del día

1. `Ctrl + C` en la terminal del frontend y en la del backend.
2. Detener contenedores conservando los datos:
   ```cmd
   docker compose stop
   ```
   (`docker compose down` también conserva los datos; **`docker compose down -v` los borra**.)
3. Cierra Docker Desktop si quieres liberar memoria.

---

## 8. Despliegue en la nube — DigitalOcean

### 8.1 Crear cuenta y recursos en DigitalOcean

Entra a https://www.digitalocean.com y crea los siguientes recursos **en este orden**:

**a) Managed MySQL 8**
- `Databases` → `Create Database` → MySQL 8
- Plan básico (1 GB RAM)
- Región: New York o Toronto (más cercanas a Venezuela)
- Nombre: `tuparley-db`
- Anota: **host, puerto, usuario, contraseña** (DigitalOcean los muestra)

**b) Managed Redis 7**
- `Databases` → `Create Database` → Redis 7
- Plan básico, misma región
- Nombre: `tuparley-redis`
- Anota: **host, puerto, contraseña**

**c) Spaces (backups)**
- `Spaces` → `Create Space`
- Nombre: `tuparley-backups`
- Guarda **Access Key** y **Secret Key**

**d) Droplet (servidor)**
- `Droplets` → `Create Droplet`
- Sistema: Ubuntu 22.04 LTS
- Plan: Basic $12/mes (2 GB RAM, 1 vCPU)
- Misma región
- Autenticación por SSH (recomendado) o contraseña
- Nombre: `tuparley-server`
- Anota la **IP pública** del Droplet

### 8.2 Configurar dominio (Namecheap + Cloudflare)

1. Compra un dominio en https://www.namecheap.com (ej. `tuparley.com.ve`)
2. Crea cuenta en https://www.cloudflare.com
3. En Cloudflare → `Add Site` → ingresa tu dominio
4. Cloudflare te dará dos nameservers (ej. `ns1.cloudflare.com`, `ns2.cloudflare.com`)
5. En Namecheap → tu dominio → `Nameservers` → Custom → pega los nameservers de Cloudflare
6. En Cloudflare → `DNS` → crea un registro:
   - Tipo: `A` | Nombre: `@` | IPv4: IP del Droplet | Proxy: activado (nube naranja)

### 8.3 Configurar el servidor Droplet

Conéctate via SSH:

```bash
ssh root@IP_DE_TU_DROPLET
```

Instala las dependencias del servidor:

```bash
apt update && apt upgrade -y

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# PM2, Nginx, Git
npm install -g pm2
apt install -y nginx git

# Verificar
node -v    # v20.x.x
nginx -v
```

### 8.4 Clonar el proyecto en el servidor

```bash
cd /var/www
git clone https://github.com/eganaraul7/TuParley.git
cd TuParley
```

### 8.5 Crear la base de datos en la nube

Conéctate a tu Managed MySQL de DigitalOcean:

```bash
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u doadmin -p
```

Dentro de MySQL:

```sql
CREATE DATABASE tuparley CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'tuparley_user'@'%' IDENTIFIED BY 'TuContraseñaSegura123!';
GRANT ALL PRIVILEGES ON tuparley.* TO 'tuparley_user'@'%';
FLUSH PRIVILEGES;
EXIT;
```

Aplica el esquema, los datos iniciales y todas las migraciones (desde el Droplet, después del paso 8.6 para que exista `backend/.env`):

```bash
cd /var/www/TuParley/backend
npm run db:migrate
```

### 8.6 Configurar el backend en producción

```bash
cd /var/www/TuParley/backend
npm install --omit=dev
cp .env.example .env
nano .env
```

Rellena el `.env` con datos reales de producción:

```env
NODE_ENV=production
PORT=4000

DB_HOST=TU_HOST.db.ondigitalocean.com
DB_PORT=25060
DB_NAME=tuparley
DB_USER=tuparley_user
DB_PASSWORD=TuContraseñaSegura123!
DB_POOL_MAX=20

REDIS_HOST=TU_REDIS.db.ondigitalocean.com
REDIS_PORT=25061
REDIS_PASSWORD=contraseña_redis_de_digitalocean
REDIS_TLS=true

# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=genera_uno_aleatorio_de_64_bytes
JWT_EXPIRES_IN=14h

API_SPORTS_KEY=tu_key_real
API_TENNIS_KEY=tu_key_rapidapi
BCV_API_URL=https://ve.dolarapi.com/v1/dolares/oficial
BCV_RANGO_MINIMO=100
BCV_RANGO_MAXIMO=5000

GANANCIA_MAXIMA_USD=300
APUESTA_MINIMA_USD=1

FRONTEND_URL=https://tuparley.com.ve
TRUST_PROXY=loopback
```

Arranca con PM2:

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Ejecuta el comando que PM2 te indique para que arranque al reiniciar el servidor
```

Verifica:

```bash
pm2 status
pm2 logs tuparley-backend
```

### 8.7 Construir y servir el frontend

```bash
cd /var/www/TuParley/frontend
npm install
npm run build
# Genera frontend/dist/ con todos los archivos estáticos
```

### 8.8 Configurar Nginx

```bash
nano /etc/nginx/sites-available/tuparley
```

Pega (reemplaza el dominio):

```nginx
server {
    listen 80;
    server_name tuparley.com.ve www.tuparley.com.ve;

    root /var/www/TuParley/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Activa y recarga:

```bash
ln -s /etc/nginx/sites-available/tuparley /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 8.9 SSL / HTTPS con Cloudflare

Cloudflare maneja SSL automáticamente cuando la proxy esté activa (nube naranja). En Cloudflare → `SSL/TLS` → modo **Full**. Tu app estará en `https://tuparley.com.ve` sin configuración adicional.

### 8.10 Actualizar el servidor tras hacer cambios

```bash
ssh root@IP_DEL_DROPLET
cd /var/www/TuParley
git pull origin main

# Si cambiaste el backend:
cd backend && npm install --omit=dev && pm2 restart tuparley-backend

# Si cambiaste el frontend:
cd frontend && npm install && npm run build

# Si hay migraciones nuevas (salta las ya aplicadas):
cd backend && npm run db:migrate
```

---

## 9. Distribución a las tablets

TuParley es una **PWA** — se instala desde Chrome como app nativa, sin Play Store ni App Store.

### Instalación en cada tablet

1. Abre **Google Chrome** en la tablet
2. Ve a `https://tuparley.com.ve`
3. Chrome mostrará: **"Agregar TuParley a la pantalla de inicio"** → toca **Instalar**
4. Si no aparece: toca ⋮ (tres puntos) → **Agregar a pantalla de inicio**
5. La app queda en el escritorio de la tablet como cualquier app nativa

### Probar en tablets desde desarrollo local

Las tablets deben estar en la misma red WiFi que tu computadora.

Sigue los pasos de la sección 5 → *Probar desde una tablet en la misma WiFi*.

### Actualización automática

Cuando subas cambios al servidor, las tablets se actualizan solas al próximo acceso gracias al Service Worker. No necesitas reinstalar en cada tablet.

---

## 10. Variables de entorno — referencia completa

`backend/.env` (plantilla completa en `backend/.env.example`):

| Variable | Descripción | Local | Producción |
|---|---|---|---|
| `NODE_ENV` | Entorno | `development` | `production` |
| `PORT` | Puerto del backend | `4000` | `4000` |
| `FRONTEND_URL` | URL del frontend (CORS y Socket.io) | `http://localhost:5173` | `https://tuparley.com.ve` |
| `CORS_ORIGINS` | Orígenes extra separados por coma (tablets LAN) | *(vacío)* | *(vacío)* |
| `TRUST_PROXY` | Proxy de confianza para la IP real | `loopback` | `loopback` (Nginx local) |
| `DB_HOST` / `DB_PORT` | MySQL | `127.0.0.1` / `3307` | host DO / `25060` |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Credenciales MySQL | ver `docker-compose.yml` | las tuyas |
| `DB_POOL_MAX` | Conexiones máximas | `10` | `20` |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis | `127.0.0.1` / `6379` / vacío | DO |
| `REDIS_TLS` | Redis con TLS | `false` | `true` (DO Managed Redis) |
| `JWT_SECRET` | Clave de firma de sesiones (≥ 32 caracteres) | **obligatorio** | **obligatorio** (sin él no arranca) |
| `JWT_EXPIRES_IN` | Duración del token | `14h` | `14h` |
| `API_SPORTS_KEY` | Clave API-Sports | tu clave | tu clave |
| `API_SPORTS_URL_FUTBOL` / `_BALONCESTO` / `_BEISBOL` / `_MMA` | URLs API-Sports | ver plantilla | igual |
| `API_TENNIS_KEY` / `API_SPORTS_URL_TENIS` | RapidAPI tenis | tu clave | tu clave |
| `API_LIMITE_DIARIO` | Tope de peticiones por API y día | `90` | `90` |
| `DEPORTES_DIAS_SYNC` | Días hacia adelante que se sincronizan | `7` | `7` |
| `SYNC_AL_ARRANCAR` | Forzar sincronización en cada arranque | `false` | `false` |
| `BCV_API_URL` | URL de la tasa BCV | `https://ve.dolarapi.com/v1/dolares/oficial` | igual |
| `BCV_API_URL_RESPALDO` | Fuente alternativa si la principal falla (opcional) | *(vacío)* | *(vacío)* |
| `BCV_RANGO_MINIMO` / `BCV_RANGO_MAXIMO` | Rango aceptado de la tasa | `100` / `5000` | ajustar a la realidad |
| `GANANCIA_MAXIMA_USD` / `APUESTA_MINIMA_USD` | Respaldo si no están en `configuracion_sistema` | `300` / `1` | igual |
| `RATE_LIMIT_LOGIN_MIN` / `RATE_LIMIT_API_MIN` / `RATE_LIMIT_TICKETS_10S` | Límites de peticiones | `10` / `300` / `5` | igual |

`frontend/.env.local` (opcional, plantilla en `frontend/.env.example`): `VITE_API_URL`, `VITE_SOCKET_URL`.

Los límites de negocio (ganancia máxima, apuesta mínima, horas para cobrar, % bodeguero/operador) se leen de la tabla `configuracion_sistema`.

---

## 11. Credenciales iniciales

| Campo | Valor |
|---|---|
| Usuario | `computadora_madre` |
| Contraseña | `Admin@TuParley2024!` |
| Rol | `computadora_madre` (acceso total) |

> ⚠️ **Cambia esta contraseña inmediatamente** al hacer el primer login y activa 2FA en *Admin → Configuración*.

Para cambiar el hash antes de insertar los datos iniciales:

```cmd
cd backend
node -e "require('bcrypt').hash('TuNuevaContraseña',12).then(h=>console.log(h))"
```

Reemplaza el hash en `database/seeds.sql` en el INSERT de `computadora_madre`.

---

## 12. Estructura del proyecto

```
TuParley/
├── backend/
│   ├── src/
│   │   ├── config/          # DB (sesión en -04:00), Redis, env, CORS
│   │   ├── controllers/     # Lógica de cada endpoint
│   │   ├── jobs/            # Crons: BCV (9AM), eventos (6h), cierre (1min), resultados (30min), caducidad
│   │   ├── middlewares/     # Auth JWT, roles, rate limiter
│   │   ├── routes/          # Definición de rutas por módulo
│   │   ├── services/        # apuestas (validación/cuotas), liquidacion, resultadosApi, deportes, BCV, hash
│   │   ├── socket/          # Eventos Socket.io en tiempo real
│   │   ├── utils/           # fecha (hora de Venezuela), paginacion
│   │   └── app.js
│   ├── test/                # unit.test.js (npm test) y e2e.mjs (npm run test:e2e)
│   ├── ecosystem.config.js  # Configuración PM2 para producción
│   ├── server.js            # Punto de entrada
│   └── .env.example
│
├── frontend/
│   ├── public/              # PWA: icons, manifest.json, sw.js
│   └── src/
│       ├── components/
│       │   ├── admin/       # Tabs del panel (usuarios, eventos + resultados, bodegas, 2FA…)
│       │   ├── bodeguero/   # Dashboard: navbar, columna eventos, tarjeta con marcador opcional
│       │   ├── common/
│       │   └── ticket/      # TicketSlip, ModalImpresion, ModalQR, detalle con pago/devolución
│       ├── hooks/ pages/ services/ store/ utils/
│
├── database/
│   ├── schema.sql           # Esquema base
│   ├── seeds.sql            # Datos iniciales
│   ├── migrate.js           # Aplica schema/seeds/migraciones pendientes (npm run db:migrate)
│   └── migrations/          # 001 … 007
│
├── docker-compose.yml       # MySQL 8 + Redis 7 para desarrollo local
└── README.md
```

### Roles del sistema

| Rol | Acceso |
|---|---|
| `computadora_madre` | Total. Es la única que puede gestionar su propia cuenta. Tras 5 intentos fallidos se bloquea 15 min (no permanente). |
| `administrador` | Panel completo. Puede gestionar bodegueros y otros administradores, **no** a la computadora madre. |
| `bodeguero` | Solo su bodega. |
| `desconocido` | Solo pantalla de espera. Admin le asigna un rol. |

Bloquear a un usuario, cambiarle el rol o resetearle la contraseña cierra su sesión al instante.

### Estados de ticket

| Estado | Significado |
|---|---|
| `PENDIENTE` | Apuesta activa, algún evento no terminó |
| `GANADO` | Cliente acertó todo. Tiene 48 h (configurable) para cobrar |
| `PERDIDO` | Falló al menos una selección |
| `PAGADO` | Premio entregado |
| `ANULADO` | Cancelado por admin vía solicitud formal |
| `SUSPENDIDO` | Un evento del ticket se suspendió/canceló. El cliente puede pedir la devolución |
| `REEMBOLSADO` | Se devolvió lo apostado (en la moneda y monto originales) |
| `CADUCADO_GANADOR` | Ganó pero no cobró a tiempo |

---

## 13. Apuestas, resultados y liquidación

- Cada evento ofrece **Local / Empate / Visitante** (empate solo en fútbol). Al elegir, la tarjeta muestra opcionales que multiplican la cuota:
  - **Marcador exacto** (fútbol, béisbol, tenis en sets) o **diferencia de puntos** (baloncesto).
  - **Tiempo extra / penales** (fútbol, empate en fase eliminatoria) y **método de victoria** (MMA).
- El servidor recalcula siempre las cuotas desde la base de datos; nunca usa las que envía la tablet. No acepta apuestas en eventos que ya empezaron, ni en categorías o torneos desactivados.
- **Resultados automáticos**: cada 30 min se consultan los partidos de API-Sports que ya deberían haber terminado (una petición por deporte y día). Fútbol se liquida con el marcador de los 90 minutos.
- **Resultados manuales** (*Admin → Eventos → Resultados pendientes*): tenis, método de victoria en MMA, eventos creados a mano o cuando la API no trae el dato. Una selección **nunca** se da por perdida por falta de datos: queda pendiente y el admin recibe una notificación.
- **Suspender** un evento deja sus tickets pendientes en `SUSPENDIDO`; desde el historial, el bodeguero usa **Devolver dinero**.
- **Tickets offline**: al recuperar conexión el servidor los revalida. Se rechazan si la cuota cambió, si un evento ya empezó o si no corresponden a la bodega/usuario; el admin recibe la notificación para devolver el dinero.
- Las APIs gratuitas tienen ~100 peticiones/día: el backend lleva la cuenta en Redis y se detiene en `API_LIMITE_DIARIO`.

---

### Tasa BCV

- Se consulta DolarAPI al arrancar el backend, todos los días a las **9:00 AM** y **cada hora (7:30–20:30)** mientras no exista tasa del día. Cada consulta reintenta 3 veces y, si se configura, usa `BCV_API_URL_RESPALDO`.
- Si todo falla se mantiene la última tasa, se notifica al admin (una vez al día) y en **Admin → BCV** se ve el error del último intento.
- **Admin → BCV** permite **Consultar API ahora** o **Aplicar tasa manual** (dentro de `BCV_RANGO_MINIMO`–`BCV_RANGO_MAXIMO`). Una tasa manual del día no la reemplaza la consulta automática; solo el botón *Consultar API ahora*.
- Cada cambio se envía al instante a todas las tablets por WebSocket.

---

## 14. Pruebas

Desde `backend\`:

```cmd
npm test
```

Pruebas unitarias (liquidación, fechas, paginación, hash, lectura de resultados de la API). No necesitan BD.

Prueba de punta a punta contra **la BD local de desarrollo** (crea usuarios, eventos y tickets de prueba; se niega a correr contra una BD que no sea local):

```cmd
:: Command Prompt
set ADMIN_PASS=<contraseña de computadora_madre>
npm run test:e2e
```
```powershell
# PowerShell
$env:ADMIN_PASS="<contraseña de computadora_madre>"; npm run test:e2e
```

Requiere el backend corriendo (`npm run dev`) y una tasa BCV cargada. Verifica apuestas, cuotas, liquidación, pagos (incluidos pagos simultáneos), reembolsos, tickets offline, anulaciones, sesiones, jerarquía de roles y 2FA.

Frontend: `cd frontend && npm run build` debe terminar sin errores.

---

## 15. Solución de problemas

| Síntoma | Causa / solución |
|---|---|
| `[DB] No se pudo conectar a MySQL ... 3307` | Docker Desktop cerrado o contenedores detenidos → `docker compose up -d` |
| `Unknown column ...` / `Table ... doesn't exist` | Faltan migraciones → `cd backend && npm run db:migrate` |
| `[env] JWT_SECRET ausente o débil` | Completa `JWT_SECRET` en `backend\.env` |
| `EADDRINUSE :4000` o `:5173` | Puerto ocupado → `netstat -ano \| findstr :4000` y `taskkill /PID <pid> /F` |
| El login responde 429 | Límite de intentos: espera 1 minuto (la computadora madre, 15 minutos tras 5 fallos) |
| No aparecen eventos | Sin clave de API, cuota agotada (`límite diario` en el log) o eventos ya iniciados. Crea eventos en *Admin → Eventos* |
| `Tasa BCV no disponible` al vender | Carga la tasa en *Admin → BCV* |
| La tablet no carga / error CORS | Firewall de Windows; si el backend está en otro equipo usa `frontend\.env.local` y `CORS_ORIGINS` |
| `npm install` falla en `bcrypt` | Usa Node 20 o 22 LTS de 64 bits (bcrypt 6 trae binarios para Windows) |
| `docker compose` no existe | Actualiza Docker Desktop; en versiones viejas usa `docker-compose` |
