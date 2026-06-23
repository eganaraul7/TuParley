// Logos
export { default as LogoTuParley } from './logos/tuparley-logo.svg?react';

// Sport icons — importar como componentes React con ?react (Vite + @svgr/rollup)
export { default as IconFutbol }     from './icons/sports/futbol.svg?react';
export { default as IconBaloncesto } from './icons/sports/baloncesto.svg?react';
export { default as IconBeisbol }    from './icons/sports/beisbol.svg?react';
export { default as IconCaballos }   from './icons/sports/caballos.svg?react';
export { default as IconTenis }      from './icons/sports/tenis.svg?react';

// Mapa deporte → componente (útil para render dinámico)
// Uso: const Icon = SPORT_ICONS[deporte]; <Icon className="w-5 h-5" />
import FutbolIcon     from './icons/sports/futbol.svg?react';
import BaloncestoIcon from './icons/sports/baloncesto.svg?react';
import BeisbolIcon    from './icons/sports/beisbol.svg?react';
import CaballosIcon   from './icons/sports/caballos.svg?react';
import TenisIcon      from './icons/sports/tenis.svg?react';

export const SPORT_ICONS = {
  futbol:     FutbolIcon,
  baloncesto: BaloncestoIcon,
  beisbol:    BeisbolIcon,
  caballos:   CaballosIcon,
  tenis:      TenisIcon,
};