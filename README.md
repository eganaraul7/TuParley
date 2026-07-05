# TuParley — Sistema de Gestión de Apuestas Deportivas

Sistema de apuestas tipo parlay para bodegas físicas venezolanas. Opera desde tablets en locales, con sincronización en tiempo real a un servidor central en la nube, soporte offline con cola local y control administrativo total desde un panel web.

---

## Índice

1. [Qué es TuParley](#1-qué-es-tuparley)
2. [Stack técnico](#2-stack-técnico)
3. [Lo que necesitas instalar una sola vez](#3-lo-que-necesitas-instalar-una-sola-vez)
4. [Configuración inicial — solo la primera vez](#4-configuración-inicial--solo-la-primera-vez)
5. [Flujo de trabajo diario — Desarrollo local](#5-flujo-de-trabajo-diario--desarrollo-local)
6. [Si hiciste cambios ayer y quieres verlos hoy](#6-si-hiciste-cambios-ayer-y-quieres-verlos-hoy)
7. [Cerrar todo al final del día](#7-cerrar-todo-al-final-del-día)
8. [Despliegue en la nube — DigitalOcean](#8-despliegue-en-la-nube--digitalocean)
9. [Distribución a las tablets](#9-distribución-a-las-tablets)
10. [Variables de entorno — referencia completa](#10-variables-de-entorno--referencia-completa)
11. [Credenciales iniciales](#11-credenciales-iniciales)
12. [Estructura del proyecto](#12-estructura-del-proyecto)

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
| **Deportes** | Fútbol, Baloncesto, Béisbol, Tenis, Carreras de Caballos |
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
| Autenticación | JWT + TOTP 2FA (admins) |
| Impresión | ESC/POS vía WebUSB y Bluetooth Web API |
| PWA | Service Worker + Web Manifest (instalable en tablets) |
| Proceso en prod | PM2 |
| Proxy inverso | Nginx |
| Nube | DigitalOcean (Droplet + Managed MySQL + Managed Redis + Spaces) |
| DNS / CDN | Cloudflare |
| Dominio | Namecheap |

---

## 3. Lo que necesitas instalar una sola vez

Instala esto en tu computadora. Solo se hace una vez.

### Node.js 20

Descarga desde https://nodejs.org → elige la versión **LTS 20.x**

```bash
node -v   # debe mostrar v20.x.x
npm -v    # debe mostrar 10.x.x
```

### Docker Desktop

Descarga desde https://www.docker.com/products/docker-desktop

Es la app que corre MySQL y Redis localmente sin instalarlos directamente en tu máquina.

### Git

Descarga desde https://git-scm.com

### Clonar el repositorio

```bash
git clone https://github.com/eganaraul7/TuParley.git
cd TuParley
```

---

## 4. Configuración inicial — solo la primera vez

Haz esto **una sola vez** cuando clonas el proyecto en una máquina nueva.

### Paso 1 — Instalar dependencias del backend

```bash
cd backend
npm install
```

### Paso 2 — Crear el archivo de entorno del backend

```bash
# Estando dentro de backend/
cp .env.example .env
```

Abre `backend/.env` y rellena los valores para desarrollo local:

```env
NODE_ENV=development
PORT=4000

DB_HOST=127.0.0.1
DB_PORT=3307
DB_NAME=tuparley
DB_USER=tuparley_user
DB_PASSWORD=tuparley_local_pass

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false

JWT_SECRET=pon_aqui_cualquier_string_largo_y_aleatorio_minimo_64_chars
JWT_EXPIRES_IN=14h
TOTP_APP_NAME=TuParley

API_SPORTS_KEY=tu_key_de_api_sports
API_SPORTS_BASE_URL=https://v3.football.api-sports.io
API_BCV_URL=https://ve.dolarapi.com/v1/dolares/oficial

MAX_GANANCIA_USD=300
APUESTA_MINIMA_USD=1
BCV_RANGO_MINIMO=100
BCV_RANGO_MAXIMO=5000
HORAS_VENCIMIENTO_PREMIO=48
FRONTEND_URL=http://localhost:5173
```

### Paso 3 — Instalar dependencias del frontend

```bash
# Desde la raíz del proyecto
cd frontend
npm install
```

### Paso 4 — Levantar la base de datos y Redis por primera vez

Abre **Docker Desktop**. Espera que el ícono de la ballena esté verde.

Desde la raíz del proyecto:

```bash
docker compose up -d
```

La primera vez descarga MySQL 8 y Redis 7, crea los contenedores y ejecuta automáticamente `schema.sql` y `seeds.sql`. Tarda 1–3 minutos.

Verifica que estén listos:

```bash
docker compose ps
# Ambos deben mostrar "healthy" en STATUS
```

### Paso 5 — Aplicar migraciones adicionales

Las migraciones 003 y 004 agregan tablas nuevas. Córrelas una sola vez:

```bash
# Desde la raíz del proyecto
docker exec -i tuparley_mysql mysql -utuparley_user -ptuparley_local_pass tuparley < database/migrations/003_torneos_config.sql

docker exec -i tuparley_mysql mysql -utuparley_user -ptuparley_local_pass tuparley < database/migrations/004_config_impresion_bodega.sql
```

### Paso 6 — Verificar que todo funciona

```bash
cd backend
npm run dev
# Debe mostrar: "MySQL OK", "Redis OK", "Servidor corriendo en puerto 4000"
```

Si ves eso, presiona `Ctrl+C`. La configuración inicial está lista.

---

## 5. Flujo de trabajo diario — Desarrollo local

Sigue estos pasos **en orden** cada día que quieras trabajar.

### Paso 1 — Abrir Docker Desktop

Abre la aplicación desde tu escritorio o barra de tareas. Espera que la ballena esté verde.

Si los contenedores están detenidos (Status: Exited), desde la raíz del proyecto:

```bash
docker compose up -d
```

### Paso 2 — Arrancar el backend

Abre una terminal:

```bash
cd TuParley/backend
npm run dev
```

Salida esperada:
```
[DB] Conexión MySQL OK
[Redis] Conexión OK
Servidor TuParley corriendo en puerto 4000
[bcv.job] Cron registrado → 9:00 AM diario
[deportes.job] Crons registrados → sync 1h | cierre 2min | resultados 5min
```

**Deja esta terminal abierta.** El backend se reinicia solo con cada cambio en `backend/src/`.

### Paso 3 — Arrancar el frontend

Abre **otra terminal**:

```bash
cd TuParley/frontend
npm run dev
```

Salida esperada:
```
  VITE v5.x.x  ready

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

**Deja esta terminal abierta.**

### Paso 4 — Abrir la aplicación

Abre Chrome y ve a `http://localhost:5173`

Para probar desde una tablet en la misma red WiFi, usa la dirección `Network` que mostró Vite.

Credenciales iniciales:
- **Usuario:** `computadora_madre`
- **Contraseña:** `Admin@TuParley2024!`

> ⚠️ Cambia esta contraseña al primer login.

---

## 6. Si hiciste cambios ayer y quieres verlos hoy

### Cambios en el BACKEND (`backend/src/`)

No necesitas hacer nada. `nodemon` detecta los cambios y reinicia solo. Simplemente guarda el archivo.

### Cambios en el FRONTEND (`frontend/src/`)

No necesitas hacer nada. Vite actualiza el navegador automáticamente al guardar.

### Cambios en la BASE DE DATOS (nueva migración)

Crea un archivo en `database/migrations/` (ej. `005_mi_cambio.sql`) y córrelo:

```bash
docker exec -i tuparley_mysql mysql -utuparley_user -ptuparley_local_pass tuparley < database/migrations/005_mi_cambio.sql
```

Si necesitas recrear la BD desde cero (⚠️ borra todos los datos locales):

```bash
docker compose down -v
docker compose up -d
# Espera "healthy", luego aplica las migraciones 003 y 004 otra vez:
docker exec -i tuparley_mysql mysql -utuparley_user -ptuparley_local_pass tuparley < database/migrations/003_torneos_config.sql
docker exec -i tuparley_mysql mysql -utuparley_user -ptuparley_local_pass tuparley < database/migrations/004_config_impresion_bodega.sql
```

### Jalaste cambios de GitHub (`git pull`)

```bash
git pull origin main

# Si cambiaron las dependencias del backend:
cd backend && npm install

# Si cambiaron las dependencias del frontend:
cd frontend && npm install

# Si hay migraciones nuevas en database/migrations/:
# córrelas manualmente con el comando de arriba
```

---

## 7. Cerrar todo al final del día

### Paso 1 — Detener el frontend

En la terminal de Vite: `Ctrl + C`

### Paso 2 — Detener el backend

En la terminal de nodemon: `Ctrl + C`

### Paso 3 — Pausar los contenedores Docker

```bash
# "stop" pausa sin borrar datos — úsalo siempre
docker compose stop
```

> ⚠️ No uses `docker compose down` (borra los datos). Usa solo `stop`.

### Paso 4 — Cerrar Docker Desktop

Clic derecho en el ícono de la ballena en la barra de tareas → **Quit Docker Desktop**

Listo. Al día siguiente empieza desde el Paso 1 del flujo diario.

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

Aplica el schema, seeds y migraciones:

```bash
cd /var/www/TuParley
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u tuparley_user -p tuparley < database/schema.sql
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u tuparley_user -p tuparley < database/seeds.sql
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u tuparley_user -p tuparley < database/migrations/002_additional_indexes.sql
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u tuparley_user -p tuparley < database/migrations/003_torneos_config.sql
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u tuparley_user -p tuparley < database/migrations/004_config_impresion_bodega.sql
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
DB_POOL_MIN=2
DB_POOL_MAX=20

REDIS_HOST=TU_REDIS.db.ondigitalocean.com
REDIS_PORT=25061
REDIS_PASSWORD=contraseña_redis_de_digitalocean
REDIS_TLS=true

JWT_SECRET=genera_uno_en_https://randomkeygen.com_minimo_64_chars
JWT_EXPIRES_IN=14h
TOTP_APP_NAME=TuParley

API_SPORTS_KEY=tu_key_real
API_SPORTS_BASE_URL=https://v3.football.api-sports.io
API_BCV_URL=https://ve.dolarapi.com/v1/dolares/oficial

MAX_GANANCIA_USD=300
APUESTA_MINIMA_USD=1
BCV_RANGO_MINIMO=100
BCV_RANGO_MAXIMO=5000
HORAS_VENCIMIENTO_PREMIO=48

FRONTEND_URL=https://tuparley.com.ve
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

# Si hay migraciones nuevas:
mysql -h TU_HOST.db.ondigitalocean.com -P 25060 -u tuparley_user -p tuparley < database/migrations/005_nuevo_cambio.sql
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

1. Arranca el frontend con `npm run dev` (ya expone en la red local automáticamente)
2. Toma la dirección `Network` que mostró Vite (ej. `http://192.168.1.10:5173`)
3. En la tablet, abre Chrome y ve a esa dirección
4. Instala como PWA igual que arriba

### Actualización automática

Cuando subas cambios al servidor, las tablets se actualizan solas al próximo acceso gracias al Service Worker. No necesitas reinstalar en cada tablet.

---

## 10. Variables de entorno — referencia completa

| Variable | Descripción | Local | Producción |
|---|---|---|---|
| `NODE_ENV` | Entorno | `development` | `production` |
| `PORT` | Puerto del backend | `4000` | `4000` |
| `DB_HOST` | Host MySQL | `127.0.0.1` | host de DigitalOcean |
| `DB_PORT` | Puerto MySQL | `3307` | `25060` |
| `DB_NAME` | Nombre BD | `tuparley` | `tuparley` |
| `DB_USER` | Usuario MySQL | `tuparley_user` | `tuparley_user` |
| `DB_PASSWORD` | Contraseña MySQL | `tuparley_local_pass` | tu contraseña segura |
| `DB_POOL_MIN` | Conexiones mínimas | `2` | `2` |
| `DB_POOL_MAX` | Conexiones máximas | `20` | `20` |
| `REDIS_HOST` | Host Redis | `127.0.0.1` | host de DigitalOcean |
| `REDIS_PORT` | Puerto Redis | `6379` | `25061` |
| `REDIS_PASSWORD` | Contraseña Redis | *(vacío)* | contraseña de DO |
| `REDIS_TLS` | TLS Redis | `false` | `true` |
| `JWT_SECRET` | Clave JWT | cualquier string 64+ chars | string aleatorio seguro |
| `JWT_EXPIRES_IN` | Duración token | `14h` | `14h` |
| `TOTP_APP_NAME` | Nombre en autenticador 2FA | `TuParley` | `TuParley` |
| `API_SPORTS_KEY` | Key API-Sports | tu key | tu key |
| `API_SPORTS_BASE_URL` | URL API deportes | `https://v3.football.api-sports.io` | igual |
| `API_BCV_URL` | URL tasa BCV | `https://ve.dolarapi.com/v1/dolares/oficial` | igual |
| `MAX_GANANCIA_USD` | Límite ganancia por ticket | `300` | `300` |
| `APUESTA_MINIMA_USD` | Apuesta mínima | `1` | `1` |
| `BCV_RANGO_MINIMO` | Mínimo válido tasa BCV | `100` | `100` |
| `BCV_RANGO_MAXIMO` | Máximo válido tasa BCV | `5000` | `5000` |
| `HORAS_VENCIMIENTO_PREMIO` | Horas para cobrar premio | `48` | `48` |
| `FRONTEND_URL` | URL frontend (CORS) | `http://localhost:5173` | `https://tuparley.com.ve` |

---

## 11. Credenciales iniciales

| Campo | Valor |
|---|---|
| Usuario | `computadora_madre` |
| Contraseña | `Admin@TuParley2024!` |
| Rol | `computadora_madre` (acceso total, 2FA requerido) |

> ⚠️ **Cambia esta contraseña inmediatamente** al hacer el primer login.

Para regenerar el hash si necesitas cambiarlo antes de insertar seeds:

```bash
cd backend
node -e "const b=require('bcryptjs'); b.hash('TuNuevaContraseña',12).then(h=>console.log(h))"
```

Reemplaza el hash en `database/seeds.sql` en el INSERT de `computadora_madre`.

---

## 12. Estructura del proyecto

```
TuParley/
├── backend/
│   ├── src/
│   │   ├── config/          # DB, Redis, variables de entorno
│   │   ├── controllers/     # Lógica de cada endpoint
│   │   ├── jobs/            # Crons: BCV (9AM), deportes (1h), caducidad (24h)
│   │   ├── middlewares/     # Auth JWT, roles, rate limiter
│   │   ├── routes/          # Definición de rutas por módulo
│   │   ├── services/        # hash, BCV, deportes, traducción EN→ES
│   │   ├── socket/          # Eventos Socket.io en tiempo real
│   │   └── app.js
│   ├── ecosystem.config.js  # Configuración PM2 para producción
│   ├── server.js            # Punto de entrada
│   └── .env.example         # Plantilla de variables de entorno
│
├── frontend/
│   ├── public/              # PWA: icons, manifest.json, sw.js
│   └── src/
│       ├── assets/          # SVGs de deportes
│       ├── components/
│       │   ├── admin/       # Tabs del panel administrativo (usuarios, eventos, bodegas, etc.)
│       │   ├── bodeguero/   # Dashboard: navbar, columna eventos, barra superior
│       │   ├── common/      # Componentes reutilizables
│       │   └── ticket/      # TicketSlip, ModalImpresion, ModalQR
│       ├── hooks/           # useSocket
│       ├── pages/           # LoginPage, DashboardPage, AdminPage, HistorialPage, etc.
│       ├── services/        # Llamadas API, offlineQueue, printerService, bodegaService
│       ├── store/           # Zustand: authStore, bcvStore
│       └── utils/           # constants, formatters, roles
│
├── database/
│   ├── schema.sql           # Esquema completo de tablas
│   ├── seeds.sql            # Datos iniciales (usuario root, deportes, modalidades)
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_additional_indexes.sql
│       ├── 003_torneos_config.sql           # Control de torneos/ligas por deporte
│       └── 004_config_impresion_bodega.sql  # Config impresión física/QR por bodega
│
├── docker-compose.yml       # MySQL 8 + Redis 7 para desarrollo local
└── README.md
```

### Roles del sistema

| Rol | Acceso |
|---|---|
| `computadora_madre` | Total, sin restricciones. 2FA obligatorio. |
| `administrador` | Igual a computadora_madre. 2FA obligatorio. |
| `bodeguero` | Solo su bodega. Sin historial global ni acceso admin. |
| `desconocido` | Solo pantalla de espera. Admin le asigna un rol. |

### Estados de ticket

| Estado | Significado |
|---|---|
| `PENDIENTE` | Apuesta activa, evento no terminó |
| `GANADO` | Cliente acertó. Tiene 48 h para cobrar |
| `PERDIDO` | Cliente no acertó |
| `PAGADO` | Premio entregado al cliente |
| `ANULADO` | Cancelado por admin vía solicitud formal |
| `SUSPENDIDO` | Evento cancelado. Cliente puede pedir devolución |
| `CADUCADO_GANADOR` | Ganó pero no cobró en 48 horas |