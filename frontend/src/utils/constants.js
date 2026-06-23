// Archivo: constants.js
// Ruta: frontend/src/utils/constants.js
// Función: constantes de reglas de negocio usadas por múltiples componentes
//          (antes vivían sueltas dentro de DashboardPage.jsx; se centralizan
//          aquí al extraer TicketSlip.jsx para evitar valores duplicados).

export const MAX_GANANCIA_USD   = 300;
export const APUESTA_MINIMA_USD = 1;

// Lista de deportes con su label de display — usada en NavDeportes y
// ColumnaEventos. Antes vivía suelta dentro de DashboardPage.jsx.
export const DEPORTES = [
  { key: 'futbol',     label: 'Fútbol'     },
  { key: 'baloncesto', label: 'Baloncesto' },
  { key: 'beisbol',    label: 'Béisbol'    },
  { key: 'caballos',   label: 'Caballos'   },
  { key: 'tenis',      label: 'Tenis'      },
];

// Color de texto según estado del evento deportivo — usado en TarjetaEvento.
export const COLORES_ESTADO_EVENTO = {
  programado: 'text-[#94a3b8]',
  en_curso:   'text-[#10b981]',
  finalizado: 'text-[#475569]',
  suspendido: 'text-[#f59e0b]',
  cancelado:  'text-[#ef4444]',
};

// Colores de badge por estado de ticket — antes duplicado en
// DashboardPage (ModalTicket), HistorialPage y AdminPage.
export const BADGE_ESTADO_TICKET = {
  PENDIENTE:        'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
  GANADO:           'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/30',
  PERDIDO:          'bg-[#ef4444]/10 text-[#ef4444] border-[#ef4444]/30',
  PAGADO:           'bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/30',
  ANULADO:          'bg-[#475569]/10 text-[#475569] border-[#475569]/30',
  SUSPENDIDO:       'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/30',
  CADUCADO_GANADOR: 'bg-[#6b7280]/10 text-[#6b7280] border-[#6b7280]/30',
};