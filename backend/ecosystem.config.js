// Archivo: ecosystem.config.js
// Ruta: backend/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'tuparley-backend',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};