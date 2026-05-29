import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  buildSimulationFirestorePatch,
  agregarHistorialSiCambio,
  clean,
  detenerSimulacionLocal,
  detenerSimulacionPorIncidencia,
  ensureTripSimulationFields,
  getTripCode,
  getTripDestination,
  getTripName,
  getTripOrigin,
  normalizeTripStatus,
  statusClass
} from "./trip-simulation.js";
import {
  moverMarcadorEnRuta,
  renderizarMapaRuta
} from "./tracking-map.js";

const trackingForm = document.getElementById("trackingForm");
const trackingCode = document.getElementById("trackingCode");
const trackingMessage = document.getElementById("trackingMessage");
const trackingMatches = document.getElementById("trackingMatches");
const trackingResult = document.getElementById("trackingResult");
const resultDestination = document.getElementById("resultDestination");
const resultOrigin = document.getElementById("resultOrigin");
const resultDestinationMetric = document.getElementById("resultDestinationMetric");
const resultCode = document.getElementById("resultCode");
const resultCodeRepeat = document.getElementById("resultCodeRepeat");
const resultStatus = document.getElementById("resultStatus");
const resultLocation = document.getElementById("resultLocation");
const resultFinished = document.getElementById("resultFinished");
const resultStart = document.getElementById("resultStart");
const resultEnd = document.getElementById("resultEnd");
const resultMapCaption = document.getElementById("resultMapCaption");
const trackingMap = document.getElementById("trackingMap");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const progressState = document.getElementById("progressState");
const publicItinerary = document.getElementById("publicItinerary");
const publicStatusHistory = document.getElementById("publicStatusHistory");
const publicStartSimulationBtn = document.getElementById("publicStartSimulationBtn");
const publicResetSimulationBtn = document.getElementById("publicResetSimulationBtn");
const publicIncidentSimulationBtn = document.getElementById("publicIncidentSimulationBtn");
const publicSimulationMessage = document.getElementById("publicSimulationMessage");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let unsubscribeSelectedTrip = null;
let selectedTrip = null;
let simulationController = null;
let gpsWatchId = null;

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function mapsLink(q) {
  return "https://maps.google.com/?q=" + encodeURIComponent(q || "");
}

function fmtDate(d) {
  if (!d) return "Sin fecha";
  const date = new Date(d + "T00:00:00");
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(value) {
  if (!value) return "Sin fecha";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function distanceKm(a = {}, b = {}) {
  const lat1 = Number(a.lat);
  const lng1 = Number(a.lng);
  const lat2 = Number(b.lat);
  const lng2 = Number(b.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return 0;
  const toRad = value => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const start = toRad(lat1);
  const end = toRad(lat2);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(start) * Math.cos(end) * Math.sin(dLng / 2) ** 2;
  return 2 * earthKm * Math.asin(Math.sqrt(h));
}

function projectedDistanceToSegmentKm(point, start, end) {
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  const startLat = Number(start.lat);
  const startLng = Number(start.lng);
  const endLat = Number(end.lat);
  const endLng = Number(end.lng);
  if (![lat, lng, startLat, startLng, endLat, endLng].every(Number.isFinite)) return Infinity;
  const kmPerDegreeLat = 111.32;
  const midLat = ((startLat + endLat) / 2) * Math.PI / 180;
  const kmPerDegreeLng = 111.32 * Math.cos(midLat);
  const px = (lng - startLng) * kmPerDegreeLng;
  const py = (lat - startLat) * kmPerDegreeLat;
  const vx = (endLng - startLng) * kmPerDegreeLng;
  const vy = (endLat - startLat) * kmPerDegreeLat;
  const segmentLengthSq = (vx * vx) + (vy * vy);
  const ratio = segmentLengthSq ? Math.max(0, Math.min(1, ((px * vx) + (py * vy)) / segmentLengthSq)) : 0;
  const closest = {
    lat: startLat + ((endLat - startLat) * ratio),
    lng: startLng + ((endLng - startLng) * ratio)
  };
  return distanceKm(point, closest);
}

function distanceToRouteKm(point, route = []) {
  if (route.length < 2) return Infinity;
  return route.slice(0, -1).reduce((best, start, index) => {
    const distance = projectedDistanceToSegmentKm(point, start, route[index + 1]);
    return Math.min(best, distance);
  }, Infinity);
}

function inferGpsPlace(point) {
  const knownPlaces = [
    { label: "Berlin, Alemania", lat: 52.520007, lng: 13.404954, radiusKm: 60 },
    { label: "Moscu, Rusia", lat: 55.755826, lng: 37.6173, radiusKm: 80 },
    { label: "Aeropuerto Internacional El Dorado, Bogota", lat: 4.7016, lng: -74.1469, radiusKm: 25 },
    { label: "Nueva York, Estados Unidos", lat: 40.7128, lng: -74.006, radiusKm: 60 }
  ];
  return knownPlaces.find(place => distanceKm(point, place) <= place.radiusKm)?.label || "";
}

function progressInfoFromGps(point, trip) {
  const route = trip.route || [];
  const origin = route[0];
  const destination = route[route.length - 1];
  if (!origin || !destination) return { progress: Number(trip.progreso || 0), offRoute: false, offRouteKm: 0 };
  const offRouteKm = distanceToRouteKm(point, route);
  const offRoute = Number.isFinite(offRouteKm) && offRouteKm > 250;
  const fromOrigin = distanceKm(origin, point);
  const toDestination = distanceKm(point, destination);
  const total = fromOrigin + toDestination;
  if (!total) return { progress: Number(trip.progreso || 0), offRoute, offRouteKm };
  const progress = offRoute ? 0 : Math.max(0, Math.min(100, Math.round((fromOrigin / total) * 100)));
  return { progress, offRoute, offRouteKm };
}

function statusFromGpsProgress(progress) {
  if (progress >= 97) return "En destino";
  if (progress >= 80) return "Cerca del destino";
  if (progress > 3) return "En ruta";
  return "En preparación";
}

function stopGpsTracking(showMessage = true) {
  if (gpsWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(gpsWatchId);
  }
  gpsWatchId = null;
  simulationController?.stop?.();
  simulationController = null;
  if (showMessage && publicSimulationMessage) {
    publicSimulationMessage.textContent = "GPS detenido. La última ubicación guardada queda visible en el mapa.";
  }
}

function shouldBackfillTrip(raw, normalized) {
  return !raw.codigoViaje ||
    !raw.code ||
    raw.estado !== normalized.estado ||
    raw.status !== normalized.status ||
    raw.destino !== normalized.destino ||
    raw.destination !== normalized.destination ||
    typeof raw.progreso === "undefined" ||
    !raw.currentLocation ||
    !Array.isArray(raw.route) ||
    raw.route.length < 2 ||
    !Array.isArray(raw.statusHistory);
}

function normalizeTripDoc(snap) {
  const raw = { id: snap.id, ...snap.data() };
  const normalized = ensureTripSimulationFields(raw);
  if (shouldBackfillTrip(raw, normalized)) {
    updateDoc(doc(db, "viajes", snap.id), {
      ...buildSimulationFirestorePatch(normalized),
      updatedAt: serverTimestamp()
    }).catch(error => console.warn("No se pudo guardar la ruta GPS por defecto:", error));
  }
  return normalized;
}

async function persistTrip(trip) {
  if (!trip?.id) return;
  await updateDoc(doc(db, "viajes", trip.id), {
    ...buildSimulationFirestorePatch(trip),
    updatedAt: serverTimestamp()
  });
}

function renderProgress(trip) {
  const progress = Math.max(0, Math.min(100, Number(trip.progreso || 0)));
  progressPercent.textContent = `${progress}%`;
  progressFill.style.width = `${progress}%`;
  progressState.textContent = trip.estado || normalizeTripStatus(trip.status);
}

function renderItinerary(t) {
  const items = [...(t.itinerary || [])].sort((a, b) => String((a.date || "") + (a.time || "")).localeCompare(String((b.date || "") + (b.time || ""))));
  if (!items.length) {
    publicItinerary.innerHTML = '<div class="empty-state">Este viaje aún no tiene actividades públicas registradas.</div>';
    return;
  }
  publicItinerary.innerHTML = items.map(a => `
    <article class="history-card">
      <strong>${esc(a.time || "--:--")} - ${esc(a.place)}</strong>
      <p class="muted">${fmtDate(a.date)} · <span class="category-pill">${esc(a.category)}</span><br>${esc(a.description || "Sin descripción.")}</p>
      ${a.place ? `<a class="small-btn location-link" href="${esc(mapsLink(a.place))}" target="_blank" rel="noopener noreferrer"><i data-lucide="map-pin"></i><span>Abrir ubicacion</span></a>` : ""}
    </article>
  `).join("");
  refreshIcons();
}

function renderPublicHistory(t) {
  const items = [...(t.statusHistory || [])]
    .sort((a, b) => String(b.fecha || b.changedAt || "").localeCompare(String(a.fecha || a.changedAt || "")));

  if (!items.length) {
    publicStatusHistory.innerHTML = '<div class="empty-state">Aún no hay cambios de estado para mostrar.</div>';
    return;
  }

  publicStatusHistory.innerHTML = items.map(h => `
    <article class="history-entry">
      <strong>${esc(h.estado || h.newStatus || "Estado actualizado")} · ${Number(h.progreso || 0)}%</strong>
      <p class="muted">${fmtDateTime(h.fecha || h.changedAt)}${h.ubicacion || h.location ? " · " + esc(h.ubicacion || h.location) : ""}</p>
      <p class="muted">${esc(h.observacion || h.comment || "Actualización registrada por WayTure.")}</p>
    </article>
  `).join("");
}

function renderTrip(rawTrip) {
  const t = ensureTripSimulationFields(rawTrip);
  selectedTrip = t;
  const status = normalizeTripStatus(t.status);
  trackingResult.classList.add("is-visible");
  resultDestination.textContent = getTripName(t);
  resultOrigin.textContent = getTripOrigin(t);
  resultDestinationMetric.textContent = getTripDestination(t);
  resultCode.textContent = getTripCode(t) || "Sin código";
  resultCodeRepeat.textContent = getTripCode(t) || "Sin código";
  resultStatus.innerHTML = `<span class="status-pill ${statusClass(status)}">${esc(status)}</span>`;
  resultLocation.textContent = t.currentLocation?.label || t.lastLocation || getTripDestination(t) || "Sin ubicación";
  resultFinished.textContent = status === "Finalizado" ? fmtDateTime(t.finishedAt) : "Sin finalizar";
  resultStart.textContent = fmtDate(t.startDate);
  resultEnd.textContent = fmtDate(t.endDate);
  resultMapCaption.textContent = `Ruta GPS: ${getTripOrigin(t)} → ${getTripDestination(t)}`;
  renderProgress(t);
  renderizarMapaRuta(t, { container: trackingMap, fit: true });
  renderItinerary(t);
  renderPublicHistory(t);
}

function mergeUniqueTrips(snaps) {
  const map = new Map();
  snaps.forEach(snap => snap.docs.forEach(d => map.set(d.id, normalizeTripDoc(d))));
  return Array.from(map.values());
}

async function findTripByCode(code) {
  const c = clean(code).toUpperCase();
  if (!c) return null;
  const [byCode, byCodigo] = await Promise.all([
    getDocs(query(collection(db, "viajes"), where("code", "==", c))),
    getDocs(query(collection(db, "viajes"), where("codigoViaje", "==", c)))
  ]);
  return mergeUniqueTrips([byCode, byCodigo])[0] || null;
}

async function findTripsByEmail(email) {
  const e = clean(email).toLowerCase();
  if (!e || !e.includes("@")) return [];
  const snap = await getDocs(query(collection(db, "viajes"), where("userEmail", "==", e)));
  return snap.docs
    .map(normalizeTripDoc)
    .sort((a, b) => String(b.createdAt?.seconds || b.lastUpdate || "").localeCompare(String(a.createdAt?.seconds || a.lastUpdate || "")));
}

function renderMatches(trips) {
  if (!trackingMatches) return;
  trackingMatches.innerHTML = trips.length > 1 ? trips.map(t => `
    <article class="history-card">
      <strong>${esc(getTripCode(t) || "Sin codigo")} - ${esc(getTripName(t))}</strong>
      <p class="muted">${esc(normalizeTripStatus(t.status))} · ${Number(t.progreso || 0)}% · ${esc(getTripDestination(t))}</p>
      <button class="small-btn icon-btn labeled" data-track-id="${esc(t.id)}" type="button"><i data-lucide="eye"></i><span>Ver viaje</span></button>
    </article>
  `).join("") : "";
  refreshIcons();
}

function watchTrip(trip) {
  unsubscribeSelectedTrip?.();
  if (!trip?.id) {
    renderTrip(trip);
    return;
  }
  unsubscribeSelectedTrip = onSnapshot(doc(db, "viajes", trip.id), snap => {
    if (!snap.exists()) return;
    renderTrip(normalizeTripDoc(snap));
  }, error => {
    console.error("Error en rastreo en tiempo real:", error);
    renderTrip(trip);
  });
}

async function findTripById(tripId) {
  const snap = await getDoc(doc(db, "viajes", tripId));
  if (!snap.exists()) return null;
  return normalizeTripDoc(snap);
}

async function searchTracking(term) {
  try {
    publicSimulationMessage.textContent = "";
    trackingMessage.textContent = "Consultando el viaje en WayTure...";
    if (trackingMatches) trackingMatches.innerHTML = "";
    const value = clean(term);
    const emailMatches = value.includes("@") ? await findTripsByEmail(value) : [];
    renderMatches(emailMatches);
    const t = emailMatches[0] || await findTripByCode(value);
    if (!t) {
      unsubscribeSelectedTrip?.();
      trackingResult.classList.remove("is-visible");
      trackingMessage.textContent = "No encontramos ningun viaje con ese codigo o correo.";
      return;
    }
    trackingMessage.textContent = emailMatches.length > 1 ? "Encontramos varios viajes para ese correo. Mostrando el mas reciente." : "";
    watchTrip(t);
  } catch (error) {
    console.error("Error consultando rastreo:", error);
    trackingResult.classList.remove("is-visible");
    trackingMessage.textContent = "No pudimos cargar el rastreo. Intenta de nuevo en un momento.";
  }
}

function renderLocalSimulationUpdate(updated) {
  selectedTrip = ensureTripSimulationFields({ ...updated, id: selectedTrip?.id });
  renderProgress(selectedTrip);
  resultStatus.innerHTML = `<span class="status-pill ${statusClass(selectedTrip.status)}">${esc(selectedTrip.status)}</span>`;
  resultLocation.textContent = selectedTrip.currentLocation?.label || "Ubicación GPS real";
  resultFinished.textContent = selectedTrip.status === "Finalizado" ? fmtDateTime(selectedTrip.finishedAt) : "Sin finalizar";
  resultMapCaption.textContent = `Ruta GPS: ${getTripOrigin(selectedTrip)} → ${getTripDestination(selectedTrip)}`;
  moverMarcadorEnRuta(selectedTrip, { container: trackingMap });
  renderPublicHistory(selectedTrip);
}

async function startPublicSimulation() {
  if (!selectedTrip) {
    publicSimulationMessage.textContent = "Consulta un viaje antes de activar el GPS.";
    return;
  }

  if (!navigator.geolocation) {
    publicSimulationMessage.textContent = "Este navegador no permite leer GPS. Prueba en Chrome/Edge con permisos de ubicación activos.";
    return;
  }

  stopGpsTracking(false);
  publicSimulationMessage.textContent = "Solicitando permiso de ubicación GPS...";

  const applyGpsPosition = async position => {
    const baseTrip = ensureTripSimulationFields(selectedTrip);
    const accuracy = Math.round(position.coords.accuracy || 0);
    const rawPoint = {
      lat: Number(position.coords.latitude.toFixed(6)),
      lng: Number(position.coords.longitude.toFixed(6))
    };
    const place = inferGpsPlace(rawPoint);
    const gpsPoint = {
      lat: rawPoint.lat,
      lng: rawPoint.lng,
      label: `GPS real del dispositivo${accuracy ? ` (precisión ${accuracy} m)` : ""}`,
      accuracy,
      capturedAt: new Date(position.timestamp || Date.now()).toISOString()
    };
    gpsPoint.label = `${place || "GPS real del dispositivo"} (${rawPoint.lat}, ${rawPoint.lng})${accuracy ? ` - precision ${accuracy} m` : ""}`;
    const gpsInfo = progressInfoFromGps(gpsPoint, baseTrip);
    const progreso = gpsInfo.progress;
    const estado = gpsInfo.offRoute ? "Fuera de ruta" : statusFromGpsProgress(progreso);
    const observacion = gpsInfo.offRoute
      ? `Ubicacion GPS real fuera de la ruta planeada por ${Math.round(gpsInfo.offRouteKm)} km.`
      : "Ubicacion GPS real actualizada desde el navegador.";
    const statusHistory = agregarHistorialSiCambio(
      baseTrip,
      estado,
      gpsPoint,
      progreso,
      "Ubicación GPS real actualizada desde el navegador."
    );
    const updated = {
      ...baseTrip,
      estado,
      status: estado,
      progreso,
      currentLocation: gpsPoint,
      gpsFueraDeRuta: gpsInfo.offRoute,
      gpsDistanciaRutaKm: Math.round(gpsInfo.offRouteKm || 0),
      gpsRealActivo: true,
      simulacionActiva: false,
      statusHistory,
      lastLocation: gpsPoint.label,
      mapQuery: `${gpsPoint.lat},${gpsPoint.lng}`
    };

    renderTrip(updated);
    if (gpsInfo.offRoute) {
      publicSimulationMessage.textContent = `GPS real activo: ubicacion fuera de la ruta planeada (${Math.round(gpsInfo.offRouteKm)} km).`;
    }
    publicSimulationMessage.textContent = "GPS real activo. La ubicación se actualiza mientras esta página esté abierta.";

    if (gpsInfo.offRoute) {
      publicSimulationMessage.textContent = `GPS real activo: ubicacion fuera de la ruta planeada (${Math.round(gpsInfo.offRouteKm)} km).`;
    }

    try {
      await persistTrip(updated);
    } catch (error) {
      console.warn("No se pudo guardar la ubicación GPS en Firestore:", error);
      publicSimulationMessage.textContent = "GPS activo en pantalla, pero no se pudo guardar en Firebase.";
    }
  };

  gpsWatchId = navigator.geolocation.watchPosition(applyGpsPosition, error => {
    const messages = {
      1: "Permiso de ubicación denegado. Activa el permiso GPS del navegador.",
      2: "No se pudo obtener la ubicación. Revisa GPS, Wi-Fi o datos.",
      3: "La lectura GPS tardó demasiado. Intenta de nuevo."
    };
    publicSimulationMessage.textContent = messages[error.code] || "No se pudo leer la ubicación GPS.";
  }, {
    enableHighAccuracy: true,
    maximumAge: 10000,
    timeout: 20000
  });
}

async function resetPublicSimulation() {
  if (!selectedTrip) {
    publicSimulationMessage.textContent = "Consulta un viaje antes de detener el GPS.";
    return;
  }
  stopGpsTracking(true);
}

async function incidentPublicSimulation() {
  if (!selectedTrip) {
    publicSimulationMessage.textContent = "Consulta un viaje antes de reportar una incidencia.";
    return;
  }
  stopGpsTracking(false);
  detenerSimulacionLocal(selectedTrip);
  const incident = detenerSimulacionPorIncidencia(selectedTrip);
  renderTrip(incident);
  publicSimulationMessage.textContent = "El viaje presenta una incidencia y se encuentra detenido temporalmente.";
  try {
    await persistTrip(incident);
  } catch (error) {
    console.warn("No se pudo guardar la incidencia:", error);
    publicSimulationMessage.textContent = "El viaje presenta una incidencia y se encuentra detenido temporalmente. No se pudo guardar en Firebase.";
  }
}

trackingForm.addEventListener("submit", e => {
  e.preventDefault();
  searchTracking(trackingCode.value);
});

if (trackingMatches) trackingMatches.addEventListener("click", async e => {
  const b = e.target.closest("button[data-track-id]");
  if (!b) return;
  const trip = await findTripById(b.dataset.trackId);
  if (trip) {
    trackingMessage.textContent = "";
    watchTrip(trip);
  }
});

if (publicStartSimulationBtn) publicStartSimulationBtn.addEventListener("click", startPublicSimulation);
if (publicResetSimulationBtn) publicResetSimulationBtn.addEventListener("click", resetPublicSimulation);
if (publicIncidentSimulationBtn) publicIncidentSimulationBtn.addEventListener("click", incidentPublicSimulation);

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
}

if ("IntersectionObserver" in window) {
  document.documentElement.classList.add("reveal-enabled");
  const obs = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) e.target.classList.add("visible");
  }), { threshold: 0.15 });
  document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
} else {
  document.querySelectorAll(".reveal").forEach(el => el.classList.add("visible"));
}
refreshIcons();

const params = new URLSearchParams(location.search);
const initial = params.get("codigo") || params.get("correo");
if (initial) {
  trackingCode.value = initial;
  searchTracking(initial);
}
