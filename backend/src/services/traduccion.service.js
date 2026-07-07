'use strict';

// Nombre de archivo: traduccion.service.js
// Ruta: backend/src/services/traduccion.service.js
// Función: Mapeo Key-Value (EN→ES) para países, ligas y equipos recibidos de la API de deportes

const PAISES = {
  'Afghanistan': 'Afganistán', 'Albania': 'Albania', 'Algeria': 'Argelia',
  'Andorra': 'Andorra', 'Angola': 'Angola', 'Argentina': 'Argentina',
  'Armenia': 'Armenia', 'Australia': 'Australia', 'Austria': 'Austria',
  'Azerbaijan': 'Azerbaiyán', 'Bahrain': 'Baréin', 'Bangladesh': 'Bangladés',
  'Belarus': 'Bielorrusia', 'Belgium': 'Bélgica', 'Bolivia': 'Bolivia',
  'Bosnia and Herzegovina': 'Bosnia y Herzegovina', 'Bosnia': 'Bosnia',
  'Brazil': 'Brasil', 'Bulgaria': 'Bulgaria', 'Cameroon': 'Camerún',
  'Canada': 'Canadá', 'Chile': 'Chile', 'China': 'China',
  'Colombia': 'Colombia', 'Costa Rica': 'Costa Rica', 'Croatia': 'Croacia',
  'Cuba': 'Cuba', 'Cyprus': 'Chipre', 'Czech Republic': 'República Checa',
  'Czechia': 'República Checa', 'Denmark': 'Dinamarca',
  'Dominican Republic': 'República Dominicana', 'Ecuador': 'Ecuador',
  'Egypt': 'Egipto', 'El Salvador': 'El Salvador', 'England': 'Inglaterra',
  'Estonia': 'Estonia', 'Ethiopia': 'Etiopía', 'Finland': 'Finlandia',
  'France': 'Francia', 'Georgia': 'Georgia', 'Germany': 'Alemania',
  'Ghana': 'Ghana', 'Greece': 'Grecia', 'Guatemala': 'Guatemala',
  'Honduras': 'Honduras', 'Hungary': 'Hungría', 'Iceland': 'Islandia',
  'India': 'India', 'Indonesia': 'Indonesia', 'Iran': 'Irán',
  'Iraq': 'Irak', 'Ireland': 'Irlanda', 'Israel': 'Israel',
  'Italy': 'Italia', 'Jamaica': 'Jamaica', 'Japan': 'Japón',
  'Jordan': 'Jordania', 'Kazakhstan': 'Kazajistán', 'Kenya': 'Kenia',
  'Kosovo': 'Kosovo', 'Kuwait': 'Kuwait', 'Latvia': 'Letonia',
  'Lebanon': 'Líbano', 'Libya': 'Libia', 'Lithuania': 'Lituania',
  'Luxembourg': 'Luxemburgo', 'Malaysia': 'Malasia', 'Malta': 'Malta',
  'Mexico': 'México', 'Moldova': 'Moldavia', 'Montenegro': 'Montenegro',
  'Morocco': 'Marruecos', 'Netherlands': 'Países Bajos',
  'New Zealand': 'Nueva Zelanda', 'Nicaragua': 'Nicaragua',
  'Nigeria': 'Nigeria', 'North Macedonia': 'Macedonia del Norte',
  'Northern Ireland': 'Irlanda del Norte', 'Norway': 'Noruega',
  'Oman': 'Omán', 'Panama': 'Panamá', 'Paraguay': 'Paraguay',
  'Peru': 'Perú', 'Philippines': 'Filipinas', 'Poland': 'Polonia',
  'Portugal': 'Portugal', 'Puerto Rico': 'Puerto Rico', 'Qatar': 'Catar',
  'Romania': 'Rumania', 'Russia': 'Rusia', 'Saudi Arabia': 'Arabia Saudita',
  'Scotland': 'Escocia', 'Senegal': 'Senegal', 'Serbia': 'Serbia',
  'Slovakia': 'Eslovaquia', 'Slovenia': 'Eslovenia',
  'South Africa': 'Sudáfrica', 'South Korea': 'Corea del Sur',
  'Spain': 'España', 'Sweden': 'Suecia', 'Switzerland': 'Suiza',
  'Syria': 'Siria', 'Taiwan': 'Taiwán', 'Thailand': 'Tailandia',
  'Trinidad and Tobago': 'Trinidad y Tobago', 'Tunisia': 'Túnez',
  'Turkey': 'Turquía', 'Ukraine': 'Ucrania',
  'United Arab Emirates': 'Emiratos Árabes Unidos',
  'United Kingdom': 'Reino Unido', 'United States': 'Estados Unidos',
  'USA': 'EE.UU.', 'Uruguay': 'Uruguay', 'Uzbekistan': 'Uzbekistán',
  'Venezuela': 'Venezuela', 'Vietnam': 'Vietnam', 'Wales': 'Gales',
  'World': 'Mundial',
};

const LIGAS = {
  'World Cup': 'Copa Mundial', 'FIFA World Cup': 'Copa Mundial FIFA',
  'World Cup - Qualification': 'Eliminatorias Copa Mundial',
  'World Cup - Qualification CONMEBOL': 'Eliminatorias CONMEBOL',
  'World Cup - Qualification UEFA': 'Eliminatorias UEFA',
  'World Cup - Qualification CONCACAF': 'Eliminatorias CONCACAF',
  'Copa America': 'Copa América', 'Copa América': 'Copa América',
  'Gold Cup': 'Copa Oro', 'Nations League': 'Liga de Naciones',
  'UEFA Nations League': 'Liga de Naciones UEFA',
  'CONMEBOL Sudamericana': 'Copa Sudamericana',
  'Copa Sudamericana': 'Copa Sudamericana',
  'CONMEBOL Libertadores': 'Copa Libertadores',
  'Copa Libertadores': 'Copa Libertadores',
  'UEFA Champions League': 'Liga de Campeones UEFA',
  'Champions League': 'Liga de Campeones',
  'UEFA Europa League': 'Liga Europa UEFA', 'Europa League': 'Liga Europa',
  'UEFA Conference League': 'Liga Conferencia UEFA',
  'Conference League': 'Liga Conferencia',
  'Premier League': 'Liga Premier Inglesa',
  'English Premier League': 'Liga Premier Inglesa',
  'La Liga': 'LaLiga', 'Primera Division': 'LaLiga',
  'Serie A': 'Serie A (Italia)', 'Bundesliga': 'Bundesliga',
  '1. Bundesliga': 'Bundesliga', '2. Bundesliga': '2. Bundesliga',
  'Ligue 1': 'Ligue 1 (Francia)', 'Ligue 2': 'Ligue 2 (Francia)',
  'Eredivisie': 'Eredivisie (Países Bajos)',
  'Primeira Liga': 'Primera Liga (Portugal)',
  'Liga Portugal': 'Primera Liga (Portugal)',
  'Süper Lig': 'Superliga Turca', 'Super Lig': 'Superliga Turca',
  'Russian Premier League': 'Premier Liga Rusa',
  'Belgian First Division A': 'Primera División Belga',
  'Scottish Premiership': 'Premiership Escocesa',
  'Championship': 'Championship (Inglaterra)',
  'FA Cup': 'Copa FA', 'Copa del Rey': 'Copa del Rey',
  'DFB Pokal': 'Copa DFB', 'Coupe de France': 'Copa de Francia',
  'Coppa Italia': 'Copa Italia', 'MLS': 'MLS (EE.UU.)',
  'Major League Soccer': 'MLS (EE.UU.)', 'Liga MX': 'Liga MX (México)',
  'Brasileirao': 'Brasileirao (Brasil)',
  'Serie A Brazil': 'Serie A de Brasil',
  'Argentine Primera Division': 'Primera División Argentina',
  'Liga Profesional': 'Liga Profesional Argentina',
  'Primera A': 'Primera A (Colombia)', 'Liga 1': 'Liga 1 (Perú)',
  'Primera Division Venezuela': 'Primera División Venezuela',
  'Liga FUTVE': 'Liga FUTVE',
  'NBA': 'NBA', 'National Basketball Association': 'NBA',
  'NBA - Playoffs': 'Playoffs NBA', 'NBA - Finals': 'Finales NBA',
  'EuroLeague': 'Euroliga', 'Euroleague': 'Euroliga', 'NCAA': 'NCAA',
  'FIBA World Cup': 'Mundial FIBA',
  'FIBA Basketball World Cup': 'Mundial de Básquetbol FIBA',
  'MLB': 'MLB', 'Major League Baseball': 'MLB',
  'MLB - Regular Season': 'Temporada Regular MLB',
  'MLB - Playoffs': 'Playoffs MLB',
  'MLB - World Series': 'Serie Mundial MLB', 'World Series': 'Serie Mundial',
  'LMB': 'Liga Mexicana de Béisbol',
  'Venezuelan Winter League': 'Liga Venezolana de Béisbol', 'LVBP': 'LVBP',
  'ATP': 'ATP', 'WTA': 'WTA', 'ATP - Grand Slam': 'Grand Slam ATP',
  'WTA - Grand Slam': 'Grand Slam WTA', 'Wimbledon': 'Wimbledon',
  'Roland Garros': 'Roland Garros', 'US Open': 'US Open',
  'Australian Open': 'Abierto de Australia',
  'ATP Masters 1000': 'Masters 1000 ATP', 'ATP 500': 'ATP 500',
  'ATP 250': 'ATP 250', 'Davis Cup': 'Copa Davis', 'UFC': 'UFC', 'Ultimate Fighting Championship': 'UFC',
  'Bellator': 'Bellator MMA', 'Bellator MMA': 'Bellator MMA',
  'ONE Championship': 'ONE Championship',
  'PFL': 'PFL (Professional Fighters League)',
  'Professional Fighters League': 'PFL (Professional Fighters League)',
  'MMA': 'MMA',
};

const EQUIPOS = {
  'Real Madrid': 'Real Madrid', 'FC Barcelona': 'FC Barcelona',
  'Barcelona': 'FC Barcelona', 'Manchester City': 'Manchester City',
  'Manchester United': 'Manchester United', 'Liverpool': 'Liverpool',
  'Arsenal': 'Arsenal', 'Chelsea': 'Chelsea', 'Tottenham': 'Tottenham',
  'Tottenham Hotspur': 'Tottenham', 'Bayern Munich': 'Bayern Múnich',
  'FC Bayern München': 'Bayern Múnich',
  'Borussia Dortmund': 'Borussia Dortmund', 'Juventus': 'Juventus',
  'AC Milan': 'AC Milán', 'Inter Milan': 'Inter de Milán',
  'AS Roma': 'AS Roma', 'Napoli': 'Nápoles',
  'Paris Saint-Germain': 'PSG', 'Paris SG': 'PSG', 'PSG': 'PSG',
  'Atletico Madrid': 'Atlético de Madrid',
  'Atlético Madrid': 'Atlético de Madrid', 'Sevilla': 'Sevilla',
  'Valencia': 'Valencia', 'Athletic Club': 'Athletic de Bilbao',
  'Ajax': 'Ajax', 'Porto': 'FC Porto', 'Benfica': 'Benfica',
  'Celtic': 'Celtic', 'Rangers': 'Rangers',
  'Boca Juniors': 'Boca Juniors', 'River Plate': 'River Plate',
  'Flamengo': 'Flamengo', 'Palmeiras': 'Palmeiras',
  'Club America': 'Club América', 'Chivas': 'Guadalajara',
  'Cruz Azul': 'Cruz Azul', 'Tigres UANL': 'Tigres',
  'England': 'Inglaterra', 'France': 'Francia', 'Germany': 'Alemania',
  'Spain': 'España', 'Italy': 'Italia', 'Brazil': 'Brasil',
  'Argentina': 'Argentina', 'Portugal': 'Portugal',
  'Netherlands': 'Países Bajos', 'Belgium': 'Bélgica',
  'Uruguay': 'Uruguay', 'Colombia': 'Colombia', 'Chile': 'Chile',
  'Mexico': 'México', 'USA': 'EE.UU.', 'United States': 'Estados Unidos',
  'Japan': 'Japón', 'South Korea': 'Corea del Sur',
  'Australia': 'Australia', 'Venezuela': 'Venezuela',
  'Los Angeles Lakers': 'Lakers', 'Golden State Warriors': 'Warriors',
  'Boston Celtics': 'Celtics', 'Miami Heat': 'Heat',
  'Chicago Bulls': 'Bulls', 'New York Knicks': 'Knicks',
  'Brooklyn Nets': 'Nets', 'Milwaukee Bucks': 'Bucks',
  'Phoenix Suns': 'Suns', 'Dallas Mavericks': 'Mavericks',
  'Denver Nuggets': 'Nuggets', 'Cleveland Cavaliers': 'Cavaliers',
  'New York Yankees': 'Yankees', 'Los Angeles Dodgers': 'Dodgers',
  'Boston Red Sox': 'Red Sox', 'Chicago Cubs': 'Cubs',
  'Houston Astros': 'Astros', 'Atlanta Braves': 'Braves',
  'San Francisco Giants': 'Giants', 'San Diego Padres': 'Padres',
  'St. Louis Cardinals': 'Cardinals', 'Philadelphia Phillies': 'Phillies',
  'Toronto Blue Jays': 'Blue Jays', 'Washington Nationals': 'Nationals',
  'New York Mets': 'Mets', 'Milwaukee Brewers': 'Brewers',
};

function _traducir(nombre, mapa) {
  if (!nombre) return nombre;
  return mapa[nombre.trim()] ?? nombre.trim();
}

function traducirPais(pais) {
  return _traducir(pais, PAISES);
}

function traducirLiga(liga) {
  if (!liga) return liga;
  const limpio = liga.trim();
  if (LIGAS[limpio]) return LIGAS[limpio];
  for (const [clave, valor] of Object.entries(LIGAS)) {
    if (limpio.toLowerCase().includes(clave.toLowerCase())) return valor;
  }
  return limpio;
}

function traducirEquipo(equipo) {
  return _traducir(equipo, EQUIPOS);
}

function traducirEvento(evento) {
  return {
    ...evento,
    liga:        traducirLiga(evento.liga),
    equipoLocal: traducirEquipo(evento.equipoLocal),
    equipoVisit: traducirEquipo(evento.equipoVisit),
  };
}

module.exports = { traducirPais, traducirLiga, traducirEquipo, traducirEvento };