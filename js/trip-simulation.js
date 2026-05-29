export const TRIP_STATUSES = [
  "Planificado",
  "En preparación",
  "En ruta",
  "Cerca del destino",
  "En destino",
  "Fuera de ruta",
  "Finalizado",
  "Incidencia"
];

const DEFAULT_ORIGIN = { lat: 4.7016, lng: -74.1469, label: "Aeropuerto Internacional El Dorado, Bogotá" };
const DEFAULT_DESTINATION = { lat: 6.2442, lng: -75.5812, label: "Medellín" };

const CITY_COORDS = [
  ["aeropuerto internacional el dorado", 4.7016, -74.1469, "Aeropuerto Internacional El Dorado, Bogotá"],
  ["el dorado", 4.7016, -74.1469, "Aeropuerto Internacional El Dorado, Bogotá"],
  ["bogota aeropuerto", 4.7016, -74.1469, "Aeropuerto Internacional El Dorado, Bogotá"],
  ["jose maria cordova", 6.1645, -75.4231, "Aeropuerto Internacional José María Córdova"],
  ["rafael nunez", 10.4424, -75.513, "Aeropuerto Internacional Rafael Núñez"],
  ["alfonso bonilla aragon", 3.5432, -76.3816, "Aeropuerto Internacional Alfonso Bonilla Aragón"],
  ["jfk", 40.6413, -73.7781, "Aeropuerto Internacional JFK"],
  ["barajas", 40.4983, -3.5676, "Aeropuerto Adolfo Suárez Madrid-Barajas"],
  ["charles de gaulle", 49.0097, 2.5479, "Aeropuerto Charles de Gaulle"],
  ["narita", 35.772, 140.3929, "Aeropuerto Internacional de Narita"],
  ["bogota", 4.711, -74.0721, "Bogotá"],
  ["medellin", 6.2442, -75.5812, "Medellín"],
  ["cartagena", 10.391, -75.4794, "Cartagena"],
  ["santa marta", 11.2408, -74.199, "Santa Marta"],
  ["san andres", 12.5847, -81.7006, "San Andrés"],
  ["cali", 3.4516, -76.532, "Cali"],
  ["barranquilla", 10.9685, -74.7813, "Barranquilla"],
  ["pereira", 4.8087, -75.6906, "Pereira"],
  ["bucaramanga", 7.1193, -73.1227, "Bucaramanga"],
  ["manizales", 5.0703, -75.5138, "Manizales"],
  ["paris", 48.8566, 2.3522, "París"],
  ["madrid", 40.4168, -3.7038, "Madrid"],
  ["barcelona", 41.3851, 2.1734, "Barcelona"],
  ["roma", 41.9028, 12.4964, "Roma"],
  ["venecia", 45.4408, 12.3155, "Venecia"],
  ["tokio", 35.6762, 139.6503, "Tokio"],
  ["kioto", 35.0116, 135.7681, "Kioto"],
  ["osaka", 34.6937, 135.5023, "Osaka"],
  ["amsterdam", 52.3676, 4.9041, "Ámsterdam"],
  ["nueva york", 40.7128, -74.006, "Nueva York"],
  ["miami", 25.7617, -80.1918, "Miami"],
  ["orlando", 28.5383, -81.3792, "Orlando"],
  ["ciudad de mexico", 19.4326, -99.1332, "Ciudad de México"],
  ["cancun", 21.1619, -86.8515, "Cancún"],
  ["rio de janeiro", -22.9068, -43.1729, "Río de Janeiro"],
  ["sao paulo", -23.5558, -46.6396, "São Paulo"],
  ["buenos aires", -34.6037, -58.3816, "Buenos Aires"],
  ["bariloche", -41.1335, -71.31, "Bariloche"]
];

const activeSimulations = new Map();

export function clean(text) {
  return String(text || "").trim();
}

export function normalizeForSearch(text) {
  return clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function normalizeTripStatus(status) {
  const raw = normalizeForSearch(status);
  if (!raw) return "Planificado";
  if (raw.includes("incid")) return "Incidencia";
  if (raw.includes("fuera") || raw.includes("desvio") || raw.includes("desv")) return "Fuera de ruta";
  if (raw.includes("final")) return "Finalizado";
  if (raw.includes("destino") || raw.includes("llego") || raw.includes("llegó")) return "En destino";
  if (raw.includes("cerca")) return "Cerca del destino";
  if (raw.includes("ruta") || raw.includes("curso")) return "En ruta";
  if (raw.includes("prepar") || raw.includes("organ") || raw.includes("reserv")) return "En preparación";
  if (raw.includes("reprogram") || raw.includes("cambio")) return "Incidencia";
  return "Planificado";
}

export function statusClass(status) {
  const normalized = normalizeTripStatus(status);
  if (normalized === "En preparación") return "preparacion";
  if (normalized === "En ruta") return "ruta";
  if (normalized === "Cerca del destino") return "cerca";
  if (normalized === "En destino") return "destino";
  if (normalized === "Fuera de ruta") return "incidencia";
  if (normalized === "Finalizado") return "finalizado";
  if (normalized === "Incidencia") return "incidencia";
  return "planificado";
}

export function calcularEstadoPorProgreso(progreso) {
  const value = Number(progreso) || 0;
  if (value === 0) return "Planificado";
  if (value > 0 && value <= 20) return "En preparación";
  if (value > 20 && value < 80) return "En ruta";
  if (value >= 80 && value < 100) return "Cerca del destino";
  if (value === 100) return "En destino";
  return "Planificado";
}

export function calcularProgreso(indiceActual, totalPuntos) {
  if (!totalPuntos || totalPuntos <= 1) return 0;
  return Math.round((indiceActual / (totalPuntos - 1)) * 100);
}

export function normalizeTripCode(value) {
  return clean(value).toUpperCase();
}

export function getTripCode(viaje = {}) {
  return normalizeTripCode(viaje.codigoViaje || viaje.code || viaje.codigo || "");
}

export function getTripName(viaje = {}) {
  const destino = getTripDestination(viaje);
  return clean(viaje.nombreViaje || viaje.name || viaje.tripName) || (destino ? `Viaje a ${destino}` : "Viaje WayTure");
}

export function getTripOrigin(viaje = {}) {
  return clean(viaje.origen || viaje.origin || viaje.from || viaje.route?.[0]?.label || "Aeropuerto Internacional El Dorado, Bogotá");
}

export function getTripDestination(viaje = {}) {
  return clean(viaje.destino || viaje.destination || viaje.to || viaje.destinoFinal || "Destino");
}

export function routePointFromLabel(label, fallback = DEFAULT_ORIGIN) {
  const value = normalizeForSearch(label);
  const found = CITY_COORDS.find(([key]) => value.includes(key));
  if (found) return { lat: found[1], lng: found[2], label: clean(label) || found[3] };
  return { lat: fallback.lat, lng: fallback.lng, label: clean(label) || fallback.label };
}

function interpolatePoint(start, end, ratio, label) {
  return {
    lat: Number((start.lat + ((end.lat - start.lat) * ratio)).toFixed(6)),
    lng: Number((start.lng + ((end.lng - start.lng) * ratio)).toFixed(6)),
    label
  };
}

function withTime(point, minutesFromStart) {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutesFromStart);
  return { ...point, time: point.time || date.toISOString() };
}

export function generarRutaSimulada(origen, destino, puntoIntermedio1 = "", puntoIntermedio2 = "") {
  const start = routePointFromLabel(origen, DEFAULT_ORIGIN);
  const end = routePointFromLabel(destino, DEFAULT_DESTINATION);
  const firstMid = clean(puntoIntermedio1)
    ? routePointFromLabel(puntoIntermedio1, interpolatePoint(start, end, 0.33, puntoIntermedio1))
    : interpolatePoint(start, end, 0.33, "Punto intermedio 1");
  const secondMid = clean(puntoIntermedio2)
    ? routePointFromLabel(puntoIntermedio2, interpolatePoint(start, end, 0.66, puntoIntermedio2))
    : interpolatePoint(start, end, 0.66, "Punto intermedio 2");
  const departure = interpolatePoint(start, end, 0.15, `Salida de ${start.label}`);
  const arrivalArea = interpolatePoint(start, end, 0.85, `Cerca de ${end.label}`);

  return [
    withTime(start, 0),
    withTime(departure, 45),
    withTime(firstMid, 90),
    withTime(secondMid, 180),
    withTime(arrivalArea, 230),
    withTime(end, 270)
  ];
}

export function normalizeRoute(route, origen, destino, puntoIntermedio1 = "", puntoIntermedio2 = "") {
  const validRoute = Array.isArray(route)
    ? route
      .map((point, index) => {
        const lat = Number(point?.lat ?? point?.[0]);
        const lng = Number(point?.lng ?? point?.lon ?? point?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return {
          lat,
          lng,
          label: clean(point?.label || point?.name || point?.ubicacion) || `Punto ${index + 1}`,
          time: point?.time || point?.fecha || ""
        };
      })
      .filter(Boolean)
    : [];

  if (validRoute.length >= 2) return validRoute;
  return generarRutaSimulada(origen, destino, puntoIntermedio1, puntoIntermedio2);
}

export function routeIndexFromProgress(progreso, totalPuntos) {
  if (!totalPuntos || totalPuntos <= 1) return 0;
  const value = Math.max(0, Math.min(100, Number(progreso) || 0));
  return Math.round((value / 100) * (totalPuntos - 1));
}

export function currentPointFromTrip(viaje = {}) {
  const route = normalizeRoute(viaje.route, getTripOrigin(viaje), getTripDestination(viaje), viaje.puntoIntermedio1, viaje.puntoIntermedio2);
  const current = viaje.currentLocation || {};
  const lat = Number(current.lat);
  const lng = Number(current.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, label: clean(current.label || current.ubicacion) || "Ubicación GPS real" };
  }
  return route[routeIndexFromProgress(viaje.progreso, route.length)] || route[0];
}

export function crearEntradaHistorial(estado, progreso, puntoActual = {}, observacion = "Estado actualizado por GPS", previousStatus = "") {
  const normalized = normalizeTripStatus(estado);
  const fecha = new Date().toISOString();
  const ubicacion = clean(puntoActual.label || puntoActual.ubicacion || puntoActual.location) || "Ubicación GPS real";
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    estado: normalized,
    newStatus: normalized,
    previousStatus: previousStatus ? normalizeTripStatus(previousStatus) : "",
    progreso: Number(progreso) || 0,
    ubicacion,
    location: ubicacion,
    lat: Number(puntoActual.lat) || null,
    lng: Number(puntoActual.lng) || null,
    fecha,
    changedAt: fecha,
    observacion,
    comment: observacion
  };
}

function migrateHistoryEntry(entry = {}) {
  const estado = normalizeTripStatus(entry.estado || entry.newStatus || entry.status);
  const fecha = entry.fecha || entry.changedAt || entry.createdAt || new Date().toISOString();
  const ubicacion = clean(entry.ubicacion || entry.location || entry.label) || "Ubicación GPS real";
  return {
    ...entry,
    estado,
    newStatus: estado,
    previousStatus: entry.previousStatus ? normalizeTripStatus(entry.previousStatus) : "",
    progreso: Number(entry.progreso ?? entry.progress ?? 0) || 0,
    ubicacion,
    location: ubicacion,
    lat: Number(entry.lat) || null,
    lng: Number(entry.lng) || null,
    fecha,
    changedAt: fecha,
    observacion: clean(entry.observacion || entry.comment) || "Actualización registrada por WayTure",
    comment: clean(entry.comment || entry.observacion) || "Actualización registrada por WayTure"
  };
}

export function sortHistory(statusHistory = []) {
  return [...statusHistory].sort((a, b) => String(a.fecha || a.changedAt || "").localeCompare(String(b.fecha || b.changedAt || "")));
}

export function ensureTripSimulationFields(viaje = {}) {
  const codigoViaje = getTripCode(viaje) || (viaje.id ? `WT-${String(viaje.id).slice(0, 6).toUpperCase()}` : `WT-${Date.now()}`);
  const origen = getTripOrigin(viaje);
  const destino = getTripDestination(viaje);
  const route = normalizeRoute(viaje.route, origen, destino, viaje.puntoIntermedio1, viaje.puntoIntermedio2);
  const progreso = Math.max(0, Math.min(100, Number(viaje.progreso ?? viaje.progress ?? 0) || 0));
  const currentLocation = currentPointFromTrip({ ...viaje, route, progreso });
  const estado = normalizeTripStatus(viaje.estado || viaje.status || calcularEstadoPorProgreso(progreso));
  const history = Array.isArray(viaje.statusHistory) ? viaje.statusHistory.map(migrateHistoryEntry) : [];
  const statusHistory = history.length
    ? sortHistory(history)
    : [crearEntradaHistorial(estado, progreso, currentLocation, "Viaje creado")];

  return {
    ...viaje,
    codigoViaje,
    code: codigoViaje,
    nombreViaje: getTripName({ ...viaje, destino }),
    origen,
    destino,
    destination: destino,
    estado,
    status: estado,
    progreso,
    simulacionActiva: Boolean(viaje.simulacionActiva),
    currentLocation,
    route,
    statusHistory
  };
}

export function agregarHistorialSiCambio(viaje, nuevoEstado, puntoActual, progreso, observacion = "Estado actualizado por GPS") {
  const normalized = normalizeTripStatus(nuevoEstado);
  const history = Array.isArray(viaje.statusHistory) ? sortHistory(viaje.statusHistory.map(migrateHistoryEntry)) : [];
  const last = history[history.length - 1];
  if (last && normalizeTripStatus(last.estado || last.newStatus) === normalized) return history;
  const previousStatus = last?.estado || viaje.estado || viaje.status || "";
  history.push(crearEntradaHistorial(normalized, progreso, puntoActual, observacion, previousStatus));
  return sortHistory(history);
}

export function actualizarEstadoAutomatico(viaje, indiceActual) {
  const next = ensureTripSimulationFields(viaje);
  const route = next.route;
  const point = route[Math.min(Math.max(0, indiceActual), route.length - 1)] || route[0];
  const progreso = calcularProgreso(indiceActual, route.length);
  const estado = calcularEstadoPorProgreso(progreso);
  const statusHistory = agregarHistorialSiCambio(next, estado, point, progreso);
  return {
    ...next,
    estado,
    status: estado,
    progreso,
    currentLocation: point,
    simulacionActiva: progreso < 100,
    statusHistory
  };
}

export function finalizarViaje(viaje) {
  const next = ensureTripSimulationFields(viaje);
  const point = next.route[next.route.length - 1] || next.currentLocation;
  const statusHistory = agregarHistorialSiCambio(next, "Finalizado", point, 100, "Viaje finalizado por GPS");
  return {
    ...next,
    estado: "Finalizado",
    status: "Finalizado",
    progreso: 100,
    currentLocation: point,
    simulacionActiva: false,
    finishedAt: new Date().toISOString(),
    statusHistory
  };
}

export function detenerSimulacionLocal(viajeOrKey) {
  const key = typeof viajeOrKey === "string" ? viajeOrKey : simulationKey(viajeOrKey);
  const active = activeSimulations.get(key);
  if (!active) return;
  clearInterval(active.timer);
  clearTimeout(active.finishTimer);
  activeSimulations.delete(key);
}

export function detenerSimulacionPorIncidencia(viaje) {
  const next = ensureTripSimulationFields(viaje);
  detenerSimulacionLocal(next);
  const statusHistory = agregarHistorialSiCambio(
    next,
    "Incidencia",
    next.currentLocation,
    next.progreso,
    "El viaje presenta una incidencia y se encuentra detenido temporalmente."
  );
  return {
    ...next,
    estado: "Incidencia",
    status: "Incidencia",
    simulacionActiva: false,
    statusHistory
  };
}

export function reiniciarSimulacion(viaje) {
  const next = ensureTripSimulationFields(viaje);
  detenerSimulacionLocal(next);
  const point = next.route[0] || DEFAULT_ORIGIN;
  const statusHistory = agregarHistorialSiCambio(
    { ...next, estado: "Finalizado", status: "Finalizado" },
    "Planificado",
    point,
    0,
    "GPS reiniciado desde WayTure"
  );
  return {
    ...next,
    estado: "Planificado",
    status: "Planificado",
    progreso: 0,
    currentLocation: point,
    simulacionActiva: false,
    finishedAt: "",
    statusHistory
  };
}

function simulationKey(viaje = {}) {
  return viaje.id || getTripCode(viaje) || "wayture-simulation";
}

export function iniciarSimulacionViaje(viaje, options = {}) {
  const {
    intervalMs = 1500,
    finishDelayMs = 3000,
    onTick = () => {},
    onPersist = () => {},
    onDone = () => {},
    getLatestTrip = null
  } = options;
  let current = ensureTripSimulationFields(viaje);
  const key = simulationKey(current);
  detenerSimulacionLocal(key);

  let index = routeIndexFromProgress(current.progreso, current.route.length);
  if (current.progreso >= 100 || current.estado === "Finalizado") index = 0;
  let running = false;
  const state = { timer: null, finishTimer: null };

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      if (typeof getLatestTrip === "function") {
        const latest = await getLatestTrip(current);
        if (latest) current = ensureTripSimulationFields(latest);
      }
      if (current.estado === "Incidencia" || current.estado === "Finalizado") {
        detenerSimulacionLocal(key);
        return;
      }

      current = actualizarEstadoAutomatico({ ...current, simulacionActiva: true }, index);
      await onTick(current, index);
      await onPersist(current, index);

      if (current.progreso >= 100) {
        clearInterval(state.timer);
        state.finishTimer = setTimeout(async () => {
          current = finalizarViaje(current);
          await onTick(current, index);
          await onPersist(current, index);
          await onDone(current, index);
          activeSimulations.delete(key);
        }, finishDelayMs);
        return;
      }

      index += 1;
    } finally {
      running = false;
    }
  };

  state.timer = setInterval(tick, intervalMs);
  activeSimulations.set(key, state);
  tick();

  return {
    stop() {
      detenerSimulacionLocal(key);
    }
  };
}

export function buildSimulationFirestorePatch(viaje = {}) {
  const next = ensureTripSimulationFields(viaje);
  return {
    codigoViaje: next.codigoViaje,
    code: next.codigoViaje,
    nombreViaje: next.nombreViaje,
    origen: next.origen,
    destino: next.destino,
    destination: next.destino,
    estado: next.estado,
    status: next.estado,
    progreso: next.progreso,
    gpsRealActivo: Boolean(next.gpsRealActivo),
    gpsFueraDeRuta: Boolean(next.gpsFueraDeRuta),
    gpsDistanciaRutaKm: Number(next.gpsDistanciaRutaKm || 0),
    simulacionActiva: next.simulacionActiva,
    currentLocation: next.currentLocation,
    route: next.route,
    statusHistory: next.statusHistory,
    lastLocation: next.currentLocation?.label || next.destino,
    mapQuery: next.currentLocation ? `${next.currentLocation.lat},${next.currentLocation.lng}` : next.destino,
    finishedAt: next.finishedAt || "",
    lastUpdate: new Date().toISOString()
  };
}
