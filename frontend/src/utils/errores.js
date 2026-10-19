// Archivo: errores.js
// Ruta: frontend/src/utils/errores.js
// Función: extraer el mensaje de error de una respuesta del backend.
//          El backend responde { error: '...' }; algunos flujos usan { mensaje }.

export function mensajeError(err, porDefecto = 'Ocurrió un error. Intenta de nuevo.') {
  const data = err?.response?.data;
  if (data?.error)   return data.error;
  if (data?.mensaje) return data.mensaje;
  if (err && !err.response) return 'Sin conexión con el servidor.';
  return porDefecto;
}
