import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, addDoc, getDocs, query, where, orderBy, doc, getDoc,
  updateDoc, deleteDoc, serverTimestamp, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  TRIP_STATUSES as SIM_TRIP_STATUSES,
  agregarHistorialSiCambio,
  buildSimulationFirestorePatch,
  crearEntradaHistorial,
  detenerSimulacionLocal,
  detenerSimulacionPorIncidencia,
  ensureTripSimulationFields,
  generarRutaSimulada,
  getTripCode,
  getTripDestination,
  getTripName,
  getTripOrigin,
  iniciarSimulacionViaje,
  normalizeTripCode,
  normalizeTripStatus,
  reiniciarSimulacion,
  statusClass as simulationStatusClass
} from "./trip-simulation.js";
import {
  moverMarcadorEnRuta,
  renderizarMapaRuta
} from "./tracking-map.js";

const moneyFormatter = new Intl.NumberFormat("es-CO", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const TRIP_STATUSES = SIM_TRIP_STATUSES;

const privateGate = document.getElementById("privateGate");
const adminDashboard = document.getElementById("adminDashboard");
const sessionInfo = document.getElementById("sessionInfo");
const tripForm = document.getElementById("tripForm");
const tripFormTitle = document.getElementById("tripFormTitle");
const tripSubmitBtn = document.getElementById("tripSubmitBtn");
const cancelTripEditBtn = document.getElementById("cancelTripEditBtn");
const tripFormMessage = document.getElementById("tripFormMessage");
const tripFilters = document.getElementById("tripFilters");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const tripList = document.getElementById("tripList");
const clearTripsBtn = document.getElementById("clearTripsBtn");
const exportTripsBtn = document.getElementById("exportTripsBtn");
const logoutBtn = document.getElementById("logoutBtn");
const metricTrips = document.getElementById("metricTrips");
const metricActive = document.getElementById("metricActive");
const metricActivities = document.getElementById("metricActivities");
const metricBudget = document.getElementById("metricBudget");
const selectedTripTitle = document.getElementById("selectedTripTitle");
const selectedTripCode = document.getElementById("selectedTripCode");
const selectedTripMeta = document.getElementById("selectedTripMeta");
const editStatus = document.getElementById("editStatus");
const editLastLocation = document.getElementById("editLastLocation");
const editMapQuery = document.getElementById("editMapQuery");
const statusComment = document.getElementById("statusComment");
const statusMessage = document.getElementById("statusMessage");
const adminMap = document.getElementById("adminMap");
const mapCaption = document.getElementById("mapCaption");
const statusHistoryList = document.getElementById("statusHistoryList");
const selectedClosedSummary = document.getElementById("selectedClosedSummary");
const activityList = document.getElementById("activityList");
const activityTemplate = document.getElementById("activityTemplate");
const activitySubmitBtn = document.getElementById("activitySubmitBtn");
const cancelActivityEditBtn = document.getElementById("cancelActivityEditBtn");
const activityMessage = document.getElementById("activityMessage");
const transportBudget = document.getElementById("transportBudget");
const hotelBudget = document.getElementById("hotelBudget");
const foodBudget = document.getElementById("foodBudget");
const activitiesBudget = document.getElementById("activitiesBudget");
const outTransport = document.getElementById("outTransport");
const outHotel = document.getElementById("outHotel");
const outFoodActivities = document.getElementById("outFoodActivities");
const outBudgetTotal = document.getElementById("outBudgetTotal");
const personalNotes = document.getElementById("personalNotes");
const statusForm = document.getElementById("statusForm");
const activityForm = document.getElementById("activityForm");
const budgetForm = document.getElementById("budgetForm");
const notesForm = document.getElementById("notesForm");
const destinationForm = document.getElementById("destinationForm");
const destinationSubmitBtn = document.getElementById("destinationSubmitBtn");
const cancelDestinationEditBtn = document.getElementById("cancelDestinationEditBtn");
const destinationMessage = document.getElementById("destinationMessage");
const recommendationGrid = document.getElementById("recommendationGrid");
const metricContacts = document.getElementById("metricContacts");
const refreshRequestsBtn = document.getElementById("refreshRequestsBtn");
const contactRequestsList = document.getElementById("contactRequestsList");
const subscriptionRequestsList = document.getElementById("subscriptionRequestsList");
const applyTripPresetBtn = document.getElementById("applyTripPresetBtn");
const tripCountry = document.getElementById("tripCountry");
const tripCity = document.getElementById("tripCity");
const startSimulationBtn = document.getElementById("startSimulationBtn");
const resetSimulationBtn = document.getElementById("resetSimulationBtn");
const incidentSimulationBtn = document.getElementById("incidentSimulationBtn");
const simulationProgressPercent = document.getElementById("simulationProgressPercent");
const simulationProgressFill = document.getElementById("simulationProgressFill");
const simulationLocation = document.getElementById("simulationLocation");
const simulationMessage = document.getElementById("simulationMessage");
const openTrackingLink = document.getElementById("openTrackingLink");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let currentProfile = null;
let viajes = [];
let destinos = [];
let contactos = [];
let suscripciones = [];
let selectedId = null;
let editingTripId = null;
let editingActivityId = null;
let editingDestinationId = null;
let unsubscribeTrips = null;
let unsubscribeDestinos = null;
let unsubscribeContactos = null;
let unsubscribeSuscripciones = null;
let adminLeafletMap = null;
const DEFAULT_ORIGIN_AIRPORT = "Aeropuerto Internacional El Dorado, Bogotá";
let adminLeafletMarker = null;
const simulationControllers = new Map();
const geocodeCache = new Map();
const DESTINATION_CATALOG = {
  "Colombia": [
    ["Bogota", "Monserrate, Bogota", "Cultural", 2],
    ["Cartagena", "Ciudad Amurallada, Cartagena", "Descanso", 2],
    ["Medellin", "Comuna 13, Medellin", "Cultural", 2],
    ["Santa Marta", "Parque Tayrona, Santa Marta", "Aventura", 2],
    ["San Andres", "Johnny Cay, San Andres", "Descanso", 2],
    ["Cali", "San Antonio, Cali", "Gastronomica", 2]
  ],
  "Mexico": [
    ["Ciudad de Mexico", "Centro Historico CDMX", "Cultural", 2],
    ["Cancun", "Zona Hotelera Cancun", "Descanso", 2],
    ["Guadalajara", "Centro de Guadalajara", "Gastronomica", 2],
    ["Oaxaca", "Centro Historico Oaxaca", "Gastronomica", 2],
    ["Merida", "Paseo de Montejo, Merida", "Cultural", 2]
  ],
  "Estados Unidos": [
    ["Nueva York", "Times Square, New York", "Cultural", 2],
    ["Miami", "South Beach Miami", "Descanso", 2],
    ["Los Angeles", "Hollywood Boulevard", "Cultural", 2],
    ["Orlando", "Walt Disney World Orlando", "Familiar", 4],
    ["San Francisco", "Golden Gate Bridge", "Aventura", 2]
  ],
  "Espana": [
    ["Madrid", "Puerta del Sol, Madrid", "Cultural", 2],
    ["Barcelona", "Sagrada Familia, Barcelona", "Cultural", 2],
    ["Sevilla", "Real Alcazar de Sevilla", "Cultural", 2],
    ["Valencia", "Ciudad de las Artes y las Ciencias", "Familiar", 2],
    ["Granada", "Alhambra, Granada", "Cultural", 2]
  ],
  "Francia": [
    ["Paris", "Torre Eiffel, Paris", "Cultural", 2],
    ["Niza", "Promenade des Anglais, Nice", "Descanso", 2],
    ["Lyon", "Vieux Lyon", "Gastronomica", 2],
    ["Marsella", "Puerto Viejo de Marsella", "Cultural", 2]
  ],
  "Italia": [
    ["Roma", "Coliseo Romano", "Cultural", 2],
    ["Venecia", "Plaza de San Marcos, Venecia", "Cultural", 2],
    ["Florencia", "Duomo Firenze", "Cultural", 2],
    ["Milan", "Duomo di Milano", "Tecnologia y compras", 2],
    ["Napoles", "Centro Storico Napoli", "Gastronomica", 2]
  ],
  "Japon": [
    ["Tokio", "Shibuya Crossing, Tokyo", "Tecnologia y compras", 1],
    ["Kioto", "Fushimi Inari Taisha, Kyoto", "Cultural", 2],
    ["Osaka", "Dotonbori Osaka", "Gastronomica", 2],
    ["Sapporo", "Odori Park Sapporo", "Aventura", 2]
  ],
  "Brasil": [
    ["Rio de Janeiro", "Cristo Redentor, Rio de Janeiro", "Aventura", 2],
    ["Sao Paulo", "Avenida Paulista, Sao Paulo", "Tecnologia y compras", 2],
    ["Salvador", "Pelourinho Salvador", "Cultural", 2],
    ["Florianopolis", "Praia Mole Florianopolis", "Descanso", 2]
  ],
  "Argentina": [
    ["Buenos Aires", "Obelisco Buenos Aires", "Cultural", 2],
    ["Bariloche", "Cerro Catedral Bariloche", "Aventura", 2],
    ["Mendoza", "Parque General San Martin Mendoza", "Gastronomica", 2],
    ["Ushuaia", "Parque Nacional Tierra del Fuego", "Aventura", 2]
  ],
  "Paises Bajos": [
    ["Amsterdam", "Amsterdam Centraal", "Cultural", 2],
    ["Rotterdam", "Erasmusbrug Rotterdam", "Cultural", 2],
    ["La Haya", "Binnenhof The Hague", "Cultural", 2]
  ]
};

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function clean(text) {
  return String(text || "").trim();
}

function normalizeForSearch(text) {
  return clean(text).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function normalizeStatus(status) {
  return normalizeTripStatus(status);
}

function statusClass(status) {
  return simulationStatusClass(status);
}

function mapUrl(q) {
  return "https://www.google.com/maps?q=" + encodeURIComponent(q || "Europa turismo") + "&output=embed";
}

function mapsLink(q) {
  return "https://maps.google.com/?q=" + encodeURIComponent(q || "");
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function geocodePlace(place) {
  const key = clean(place) || "Europa turismo";
  if (geocodeCache.has(key)) return geocodeCache.get(key);
  try {
    const response = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(key), {
      headers: { "Accept": "application/json" }
    });
    const data = await response.json();
    if (data[0]) {
      const coords = [Number(data[0].lat), Number(data[0].lon)];
      geocodeCache.set(key, coords);
      return coords;
    }
  } catch (error) {
    console.warn("No se pudo geocodificar el lugar:", error);
  }
  return [4.711, -74.0721];
}

async function updateAdminMap(place, label = "") {
  if (!adminMap) return;
  const queryText = clean(place) || "Europa turismo";
  if (!window.L) {
    adminMap.innerHTML = `<iframe title="Mapa del viaje" src="${esc(mapUrl(queryText))}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    return;
  }

  const coords = await geocodePlace(queryText);
  if (!adminLeafletMap) {
    adminLeafletMap = L.map(adminMap, { scrollWheelZoom: false }).setView(coords, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap"
    }).addTo(adminLeafletMap);
  }
  adminLeafletMap.setView(coords, 12);
  if (!adminLeafletMarker) {
    adminLeafletMarker = L.marker(coords).addTo(adminLeafletMap);
  } else {
    adminLeafletMarker.setLatLng(coords);
  }
  adminLeafletMarker.bindPopup(esc(label || queryText)).openPopup();
  setTimeout(() => adminLeafletMap?.invalidateSize(), 120);
}

function id() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2);
}

function budget(t) {
  return Number(t.transport || 0) + Number(t.hotel || 0) + Number(t.food || 0) + Number(t.activitiesCost || 0);
}

function fmtDate(d) {
  if (!d) return "Sin fecha";
  const date = new Date(d + "T00:00:00");
  return isNaN(date) ? d : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function fmtDateTime(value) {
  if (!value) return "Sin fecha";
  const date = value.seconds ? new Date(value.seconds * 1000) : new Date(value);
  return isNaN(date) ? "Sin fecha" : date.toLocaleString("es-CO", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function makeCode(destination) {
  const slug = clean(destination)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 14)
    .toUpperCase() || "VIAJE";
  return `WT-${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function codeExists(code) {
  const normalized = normalizeTripCode(code);
  const [codeSnap, codigoSnap] = await Promise.all([
    getDocs(query(collection(db, "viajes"), where("code", "==", normalized))),
    getDocs(query(collection(db, "viajes"), where("codigoViaje", "==", normalized)))
  ]);
  return !codeSnap.empty || !codigoSnap.empty;
}

async function codeBelongsToOtherTrip(code, tripId = "") {
  const normalized = normalizeTripCode(code);
  if (!normalized) return false;
  const [codeSnap, codigoSnap] = await Promise.all([
    getDocs(query(collection(db, "viajes"), where("code", "==", normalized))),
    getDocs(query(collection(db, "viajes"), where("codigoViaje", "==", normalized)))
  ]);
  return [...codeSnap.docs, ...codigoSnap.docs].some(d => d.id !== tripId);
}

async function makeUniqueCode(destination) {
  for (let i = 0; i < 30; i += 1) {
    const code = makeCode(destination);
    if (!(await codeExists(code))) return code;
  }
  return `WT-${Date.now()}`;
}

function selectedTrip() {
  return viajes.find(v => v.id === selectedId) || null;
}

function setMessage(el, text, type = "success") {
  if (!el) return;
  el.textContent = text || "";
  el.className = type === "error" ? "warning" : "success";
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function countryCityLabel(country, city) {
  return city && country ? `${city}, ${country}` : city || country || "";
}

function addDays(dateValue, days) {
  const d = dateValue ? new Date(dateValue + "T00:00:00") : new Date();
  if (Number.isNaN(d.getTime())) return dateOffset(days);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function routeDefaultsForDestination(destination) {
  const key = normalizeForSearch(destination);
  if (key.includes("medellin")) return ["Facatativá", "Manizales"];
  if (key.includes("cartagena")) return ["Honda", "Sincelejo"];
  if (key.includes("santa marta")) return ["Ibagué", "Barranquilla"];
  if (key.includes("san andres")) return ["Cartagena", "Johnny Cay"];
  if (key.includes("cali")) return ["Girardot", "Ibagué"];
  if (key.includes("barcelona")) return ["Zaragoza", "Lleida"];
  if (key.includes("madrid")) return ["Toledo", "Zaragoza"];
  if (key.includes("paris")) return ["Madrid", "Lyon"];
  if (key.includes("roma")) return ["Lyon", "Milán"];
  if (key.includes("kioto") || key.includes("tokio")) return ["Monte Fuji", "Osaka"];
  if (key.includes("miami") || key.includes("orlando")) return ["Washington DC", "Orlando"];
  if (key.includes("cancun")) return ["Puebla", "Mérida"];
  if (key.includes("bariloche")) return ["Neuquén", "Villa La Angostura"];
  return ["Punto intermedio 1", "Punto intermedio 2"];
}

function defaultDurationByExperience(experience) {
  const key = normalizeForSearch(experience);
  if (key.includes("aventura")) return 7;
  if (key.includes("familiar")) return 8;
  if (key.includes("tecnologia")) return 8;
  if (key.includes("descanso")) return 5;
  if (key.includes("gastronom")) return 6;
  return 5;
}

function estimateTripBudget({ destination, travelers = 1, startDate = "", endDate = "", experience = "Cultural" }) {
  const nights = Math.max(2, Math.round((new Date((endDate || addDays(startDate, 5)) + "T00:00:00") - new Date((startDate || dateOffset(7)) + "T00:00:00")) / 86400000) || 5);
  const intl = !["bogota", "medellin", "cartagena", "santa marta", "san andres", "cali", "barranquilla"].some(city => normalizeForSearch(destination).includes(city));
  const multiplier = intl ? 1.8 : 1;
  const adventure = normalizeForSearch(experience).includes("aventura") ? 1.2 : 1;
  return {
    transport: Math.round(travelers * (intl ? 420 : 180) * multiplier),
    hotel: Math.round(travelers * nights * (intl ? 115 : 70) * multiplier),
    food: Math.round(travelers * nights * (intl ? 48 : 32) * multiplier),
    activitiesCost: Math.round(travelers * (intl ? 210 : 130) * adventure)
  };
}

function setAutoField(field, value, force = false) {
  if (!field || typeof value === "undefined" || value === null) return;
  const current = clean(field.value);
  if (force || !current || field.dataset.autoFilled === "true") {
    field.value = value;
    field.dataset.autoFilled = "true";
  }
}

function applyTripAutomation({ destination, location, experience, travelers, force = false }) {
  const dest = clean(destination || tripForm.destination?.value);
  if (!dest) return;
  const exp = experience || tripForm.experience?.value || "Cultural";
  const people = Number(travelers || tripForm.travelers?.value || 2) || 2;
  const [mid1, mid2] = routeDefaultsForDestination(dest);
  setAutoField(tripForm.tripName, "Viaje a " + dest, force);
  setAutoField(tripForm.destination, dest, force);
  setAutoField(tripForm.origin, DEFAULT_ORIGIN_AIRPORT, false);
  setAutoField(tripForm.intermediatePoint1, mid1, force);
  setAutoField(tripForm.intermediatePoint2, mid2, force);
  setAutoField(tripForm.lastLocation, tripForm.origin?.value || DEFAULT_ORIGIN_AIRPORT, force);
  setAutoField(tripForm.mapQuery, location || dest, force);
  setAutoField(tripForm.travelers, people, force);
  setAutoField(tripForm.experience, exp, force);
  const start = tripForm.startDate?.value || dateOffset(7);
  const duration = defaultDurationByExperience(exp);
  setAutoField(tripForm.startDate, start, force);
  setAutoField(tripForm.endDate, addDays(start, duration), force);
}

function populateCountries() {
  if (!tripCountry || !tripCity || !tripForm?.tripPreset) return;
  tripCountry.innerHTML = '<option value="">Seleccionar pais</option>' +
    Object.keys(DESTINATION_CATALOG).map(country => `<option value="${esc(country)}">${esc(country)}</option>`).join("");
  populateCities("");
}

function populateCities(country) {
  if (!tripCity || !tripForm?.tripPreset) return;
  const cities = DESTINATION_CATALOG[country] || [];
  tripCity.innerHTML = '<option value="">Seleccionar ciudad</option>' +
    cities.map(([city]) => `<option value="${esc(city)}">${esc(city)}</option>`).join("");
  populateTripPlans(country, "");
}

function populateTripPlans(country, selectedCity) {
  if (!tripForm?.tripPreset) return;
  const cities = DESTINATION_CATALOG[country] || [];
  const options = cities
    .filter(([city]) => !selectedCity || city === selectedCity)
    .map(([city, location, experience, travelers]) => {
      const destination = countryCityLabel(country, city);
      return `<option value="${esc([destination, location, experience, travelers].join("|"))}">${esc(city)} - ${esc(experience)}</option>`;
    })
    .join("");
  tripForm.tripPreset.innerHTML = '<option value="">Elegir plan</option>' + options;
}

function applyPreset(raw) {
  if (!raw) return;
  const [destination, location, experience, travelers] = raw.split("|");
  applyTripAutomation({ destination, location, experience, travelers, force: true });
  setMessage(tripFormMessage, "Destino aplicado automáticamente. Solo revisa responsable y guarda.");
}

function statusOptions(selected) {
  const normalized = normalizeStatus(selected);
  return TRIP_STATUSES.map(status => `<option value="${esc(status)}" ${status === normalized ? "selected" : ""}>${esc(status)}</option>`).join("");
}

function historyItems(t) {
  return [...(t?.statusHistory || [])].sort((a, b) => String(b.fecha || b.changedAt || "").localeCompare(String(a.fecha || a.changedAt || "")));
}

function validateDates(startDate, endDate) {
  if (!startDate || !endDate) throw new Error("Completa fecha de salida y fecha de regreso.");
  if (endDate < startDate) throw new Error("La fecha de regreso no puede ser anterior a la fecha de salida.");
}

function buildTripData(formData, assigned, existingTrip = {}) {
  const destination = clean(formData.get("destination"));
  const origin = clean(formData.get("origin")) || getTripOrigin(existingTrip);
  const intermediatePoint1 = clean(formData.get("intermediatePoint1"));
  const intermediatePoint2 = clean(formData.get("intermediatePoint2"));
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");
  const travelers = Number(formData.get("travelers")) || 0;
  const email = clean(formData.get("assignedEmail")).toLowerCase();
  const codigoViaje = normalizeTripCode(formData.get("tripCode")) || getTripCode(existingTrip);
  const nombreViaje = clean(formData.get("tripName")) || getTripName({ ...existingTrip, destino: destination, destination });

  if (!destination) throw new Error("El destino principal es obligatorio.");
  if (!origin) throw new Error("El origen del viaje es obligatorio.");
  validateDates(startDate, endDate);
  if (travelers < 1) throw new Error("El número de viajeros debe ser mayor a cero.");
  const route = generarRutaSimulada(origin, destination, intermediatePoint1, intermediatePoint2);
  const estado = normalizeStatus(formData.get("tripStatus"));
  const progreso = ["Finalizado", "En destino"].includes(estado) ? 100 : (Number(existingTrip.progreso ?? 0) || 0);
  const currentLocation = progreso === 100 ? route[route.length - 1] : (existingTrip.currentLocation || route[0]);

  const simulationFields = ensureTripSimulationFields({
    ...existingTrip,
    codigoViaje,
    code: codigoViaje,
    nombreViaje,
    origen: origin,
    destino: destination,
    destination,
    estado,
    status: estado,
    progreso,
    currentLocation,
    route,
    puntoIntermedio1: intermediatePoint1,
    puntoIntermedio2: intermediatePoint2
  });

  return {
    ...simulationFields,
    destination,
    destino: destination,
    origen: origin,
    nombreViaje,
    codigoViaje,
    code: codigoViaje,
    puntoIntermedio1: intermediatePoint1,
    puntoIntermedio2: intermediatePoint2,
    startDate,
    endDate,
    travelers,
    experience: formData.get("experience") || "Cultural",
    status: simulationFields.estado,
    estado: simulationFields.estado,
    progreso: simulationFields.progreso,
    currentLocation: simulationFields.currentLocation,
    route: simulationFields.route,
    mapQuery: clean(formData.get("mapQuery")) || destination,
    lastLocation: clean(formData.get("lastLocation")) || destination,
    userEmail: email,
    userId: assigned?.uid || assigned?.id || "",
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
}

function showBlocked(message) {
  if (privateGate) {
    privateGate.classList.remove("is-hidden");
    privateGate.innerHTML = `<article class="access-card"><span class="eyebrow">Acceso restringido</span><h2>${message}</h2><p class="muted">Inicia sesión con una cuenta de administrador para gestionar viajes.</p><div class="compact-actions blocked-actions"><a class="btn btn-primary" href="login.html">Ir a login</a><a class="btn btn-secondary" href="index.html">Volver al inicio</a></div></article>`;
  }
  if (adminDashboard) adminDashboard.classList.remove("is-visible");
}

function showDashboard() {
  if (privateGate) privateGate.classList.add("is-hidden");
  if (adminDashboard) adminDashboard.classList.add("is-visible");
}

async function getUserByEmail(email) {
  const e = clean(email).toLowerCase();
  if (!e) return null;
  const snap = await getDocs(query(collection(db, "usuarios"), where("email", "==", e)));
  if (snap.empty) {
    const allUsers = await getDocs(collection(db, "usuarios"));
    const found = allUsers.docs.find(item => clean(item.data().email).toLowerCase() === e);
    return found ? { id: found.id, ...found.data() } : null;
  }
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

function isTravelerProfile(profile) {
  return ["usuario", "viajero", "traveler"].includes(normalizeForSearch(profile?.rol || profile?.role || "usuario"));
}

function currentManagerLabel() {
  return currentProfile?.nombre || currentUser?.displayName || currentUser?.email || "Administrador";
}

function currentManagerEmail() {
  return currentUser?.email || currentProfile?.email || "";
}

async function markTripManaged(tripId, action = "Gestionado desde el panel administrativo") {
  if (!tripId) return;
  await updateDoc(doc(db, "viajes", tripId), {
    managedBy: currentUser?.uid || "",
    managedByName: currentManagerLabel(),
    managedByEmail: currentManagerEmail(),
    managedAt: serverTimestamp(),
    managedAction: action
  });
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

function normalizeTripSnapshot(d) {
  const raw = { id: d.id, ...d.data() };
  const normalized = ensureTripSimulationFields(raw);
  if (shouldBackfillTrip(raw, normalized)) {
    updateDoc(doc(db, "viajes", d.id), {
      ...buildSimulationFirestorePatch(normalized),
      updatedAt: serverTimestamp()
    }).catch(error => console.warn("No se pudo completar datos de simulación del viaje:", error));
  }
  return normalized;
}

async function loadViajes() {
  const snap = await getDocs(query(collection(db, "viajes"), orderBy("createdAt", "desc")));
  viajes = snap.docs.map(normalizeTripSnapshot);
  if (!selectedId && viajes[0]) selectedId = viajes[0].id;
}

async function loadDestinos() {
  const snap = await getDocs(query(collection(db, "destinosRecomendados"), orderBy("createdAt", "desc")));
  destinos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function loadRequests() {
  const [contactsSnap, subscriptionsSnap] = await Promise.all([
    getDocs(query(collection(db, "contactos"), orderBy("createdAt", "desc"))),
    getDocs(query(collection(db, "suscripciones"), orderBy("createdAt", "desc")))
  ]);
  contactos = contactsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  suscripciones = subscriptionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function refresh() {
  await loadViajes();
  await loadDestinos();
  await loadRequests();
  renderMetrics();
  renderTrips();
  renderSelected();
  renderRecommended();
  renderRequests();
}

async function refreshRequests() {
  await loadRequests();
  renderMetrics();
  renderRequests();
}

function renderRealtimeCollections() {
  renderMetrics();
  renderTrips();
  renderSelected();
  renderRecommended();
  renderRequests();
  refreshIcons();
}

function startRealtime() {
  unsubscribeTrips?.();
  unsubscribeDestinos?.();
  unsubscribeContactos?.();
  unsubscribeSuscripciones?.();

  unsubscribeTrips = onSnapshot(query(collection(db, "viajes"), orderBy("createdAt", "desc")), snap => {
    viajes = snap.docs.map(normalizeTripSnapshot);
    if (!selectedId || !viajes.some(t => t.id === selectedId)) selectedId = viajes[0]?.id || null;
    renderRealtimeCollections();
  }, error => console.error("Error en tiempo real de viajes:", error));

  unsubscribeDestinos = onSnapshot(query(collection(db, "destinosRecomendados"), orderBy("createdAt", "desc")), snap => {
    destinos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRecommended();
  }, error => console.error("Error en tiempo real de destinos:", error));

  unsubscribeContactos = onSnapshot(query(collection(db, "contactos"), orderBy("createdAt", "desc")), snap => {
    contactos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMetrics();
    renderRequests();
  }, error => console.error("Error en tiempo real de contactos:", error));

  unsubscribeSuscripciones = onSnapshot(query(collection(db, "suscripciones"), orderBy("createdAt", "desc")), snap => {
    suscripciones = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderRequests();
  }, error => console.error("Error en tiempo real de suscripciones:", error));
}

function filteredTrips() {
  if (!tripFilters) return viajes;
  const d = new FormData(tripFilters);
  const code = normalizeForSearch(d.get("code"));
  const destination = normalizeForSearch(d.get("destination"));
  const status = clean(d.get("status"));
  const assigned = normalizeForSearch(d.get("assigned"));
  const startDate = clean(d.get("startDate"));

  return viajes.filter(t => {
    const matchesCode = !code || normalizeForSearch(getTripCode(t)).includes(code);
    const matchesDestination = !destination || normalizeForSearch(`${getTripDestination(t)} ${getTripName(t)}`).includes(destination);
    const matchesStatus = !status || normalizeStatus(t.status) === normalizeStatus(status);
    const matchesAssigned = !assigned || normalizeForSearch(`${t.userEmail || ""} ${t.userId || ""}`).includes(assigned);
    const matchesStart = !startDate || t.startDate === startDate;
    return matchesCode && matchesDestination && matchesStatus && matchesAssigned && matchesStart;
  });
}

function renderMetrics() {
  metricTrips.textContent = viajes.length;
  metricActive.textContent = viajes.filter(t => ["En preparación", "En ruta", "Cerca del destino", "En destino"].includes(normalizeStatus(t.status))).length;
  metricActivities.textContent = viajes.filter(t => normalizeStatus(t.status) === "Finalizado").length;
  metricBudget.textContent = viajes.filter(t => normalizeStatus(t.status) === "Incidencia").length;
  if (metricContacts) metricContacts.textContent = contactos.filter(c => c.status !== "gestionado" && c.status !== "archivado").length;
}

function renderTripsLegacy() {
  if (!viajes.length) {
    tripList.innerHTML = '<div class="empty-state">Todavía no hay viajes registrados. Crea el primero desde el formulario.</div>';
    return;
  }

  const items = filteredTrips();
  if (!items.length) {
    tripList.innerHTML = '<div class="empty-state">No encontramos viajes con esos filtros. Ajusta la búsqueda o limpia los filtros.</div>';
    return;
  }

  tripList.innerHTML = items.map(t => {
    const status = normalizeStatus(t.status);
    return `<article class="trip-card ${t.id === selectedId ? "selected" : ""} ${status === "Finalizado" ? "is-finalized" : ""}">
      <div class="inline-row">
        <div>
          <strong>${esc(t.destination)}</strong>
          <p class="muted">${fmtDate(t.startDate)} - ${fmtDate(t.endDate)} · ${esc(t.travelers)} viajero(s) · ${esc(t.experience)}</p>
          <p class="muted">Asignado a: ${esc(t.userEmail || "público / sin usuario")}</p>
        </div>
        <span class="status-pill ${statusClass(status)}">${esc(status)}</span>
      </div>
      <div class="inline-row">
        <span class="code-pill">${esc(t.code)}</span>
        <span class="muted">${status === "Finalizado" ? "Cerrado: " + fmtDateTime(t.finishedAt) : "Total privado: " + moneyFormatter.format(budget(t))}</span>
      </div>
      <div class="compact-actions">
        <button class="small-btn" data-action="select" data-id="${t.id}">Seleccionar</button>
        <button class="small-btn" data-action="edit" data-id="${t.id}">Editar viaje</button>
        <button class="small-btn" data-action="copy" data-code="${esc(t.code)}">Copiar código</button>
        <button class="small-btn" data-action="track" data-code="${esc(t.code)}">Abrir rastreo</button>
        <button class="small-btn danger" data-action="delete" data-id="${t.id}">Eliminar</button>
      </div>
    </article>`;
  }).join("");
}

function renderSelectedLegacy() {
  const t = selectedTrip();
  if (!t) {
    selectedTripTitle.textContent = "Selecciona un viaje";
    selectedTripCode.textContent = "Sin código";
    selectedTripMeta.textContent = "Elige un viaje para editarlo.";
    adminMap.src = mapUrl("Europa turismo");
    mapCaption.textContent = "Selecciona un viaje para ver su mapa.";
    activityList.innerHTML = '<div class="empty-state">Sin viaje seleccionado.</div>';
    populateActivityTemplates(null);
    statusHistoryList.innerHTML = '<div class="empty-state">Sin historial disponible.</div>';
    selectedClosedSummary.className = "closed-summary is-hidden";
    return;
  }

  const status = normalizeStatus(t.status);
  selectedTripTitle.textContent = t.destination;
  selectedTripCode.textContent = t.code;
  selectedTripMeta.textContent = `${fmtDate(t.startDate)} - ${fmtDate(t.endDate)} - ${t.travelers} viajero(s) - ${t.experience}`;
  editStatus.innerHTML = statusOptions(status);
  editLastLocation.value = t.lastLocation || "";
  editMapQuery.value = t.mapQuery || t.destination || "";
  transportBudget.value = t.transport || "";
  hotelBudget.value = t.hotel || "";
  foodBudget.value = t.food || "";
  activitiesBudget.value = t.activitiesCost || "";
  personalNotes.value = t.notes || "";
  adminMap.src = mapUrl(t.mapQuery || t.lastLocation || t.destination);
  mapCaption.textContent = "Mapa de " + (t.lastLocation || t.destination);
  renderActivities(t);
  renderBudget(t);
  renderStatusHistory(t);
  renderClosedSummary(t);
}

function renderStatusHistory(t) {
  const items = historyItems(t);
  if (!items.length) {
    statusHistoryList.innerHTML = '<div class="empty-state">Aún no hay cambios de estado registrados para este viaje.</div>';
    return;
  }

  statusHistoryList.innerHTML = items.map(h => `
    <article class="history-entry">
      <strong>${esc(h.estado || h.newStatus || "Estado actualizado")} · ${Number(h.progreso || 0)}%</strong>
      <p class="muted">${fmtDateTime(h.fecha || h.changedAt)}${h.ubicacion || h.location ? " · " + esc(h.ubicacion || h.location) : ""}</p>
      <p class="muted">${esc(h.observacion || h.comment || "Cambio registrado desde el panel administrativo.")}</p>
    </article>
  `).join("");
}

function renderClosedSummary(t) {
  if (normalizeStatus(t.status) !== "Finalizado") {
    selectedClosedSummary.className = "closed-summary is-hidden";
    selectedClosedSummary.innerHTML = "";
    return;
  }

  selectedClosedSummary.className = "closed-summary is-visible";
  selectedClosedSummary.innerHTML = `
    <h3>Viaje finalizado</h3>
    <p class="muted">Cierre registrado: ${fmtDateTime(t.finishedAt)}. Duración planificada: ${fmtDate(t.startDate)} - ${fmtDate(t.endDate)}. Actividades: ${(t.itinerary || []).length}. Presupuesto privado: ${moneyFormatter.format(budget(t))}.</p>
  `;
}

function renderActivities(t) {
  const items = [...(t.itinerary || [])].sort((a, b) => String((a.date || "") + (a.time || "")).localeCompare(String((b.date || "") + (b.time || ""))));
  if (!items.length) {
    activityList.innerHTML = '<div class="empty-state">Este viaje aún no tiene actividades en el itinerario.</div>';
    return;
  }

  activityList.innerHTML = items.map(a => `
    <article class="activity-item">
      <div class="activity-time">${esc(a.time || "--:--")}</div>
      <div>
        <strong>${esc(a.place)}</strong>
        <p class="muted">${fmtDate(a.date)} · <span class="category-pill">${esc(a.category)}</span></p>
        <p class="muted">${esc(a.description || "Sin descripción.")}</p>
        ${a.place ? `<a class="small-btn" href="${esc(mapsLink(a.place))}" target="_blank" rel="noopener noreferrer">Abrir en Google Maps</a>` : ""}
      </div>
      <div class="activity-actions">
        <button class="small-btn" data-action="edit-activity" data-id="${esc(a.id)}">Editar</button>
        <button class="small-btn danger" data-action="delete-activity" data-id="${esc(a.id)}">Eliminar</button>
      </div>
    </article>
  `).join("");
}

function activityTemplatesForTrip(t) {
  const trip = ensureTripSimulationFields(t || {});
  const start = trip.startDate || dateOffset(7);
  const route = trip.route || [];
  const origin = route[0]?.label || getTripOrigin(trip);
  const mid = route[Math.floor(route.length / 2)]?.label || getTripDestination(trip);
  const destination = getTripDestination(trip);
  return [
    {
      label: "Salida / check-in de ruta",
      date: start,
      time: "09:00",
      place: origin,
      category: "Transporte",
      description: "Inicio del viaje, verificación de documentos y salida programada."
    },
    {
      label: "Actividad principal en destino",
      date: addDays(start, 1),
      time: "10:00",
      place: destination,
      category: normalizeForSearch(trip.experience).includes("aventura") ? "Aventura" : "Cultura",
      description: `Actividad recomendada para disfrutar ${destination}.`
    },
    {
      label: "Parada intermedia de ruta",
      date: addDays(start, 2),
      time: "13:30",
      place: mid,
      category: "Fotografia",
      description: "Punto de descanso, fotos y actualización de ubicación simulada."
    },
    {
      label: "Cierre del viaje",
      date: trip.endDate || addDays(start, 5),
      time: "16:00",
      place: destination,
      category: "Descanso",
      description: "Cierre del itinerario y preparación de regreso."
    }
  ];
}

function populateActivityTemplates(t) {
  if (!activityTemplate) return;
  const options = activityTemplatesForTrip(t).map(item => `<option value="${esc(JSON.stringify(item))}">${esc(item.label)}</option>`).join("");
  activityTemplate.innerHTML = '<option value="">Elegir sugerencia del viaje</option>' + options;
}

function applyActivityTemplate(raw) {
  if (!raw || !activityForm) return;
  try {
    const item = JSON.parse(raw);
    activityForm.activityDate.value = item.date || "";
    activityForm.activityTime.value = item.time || "";
    activityForm.activityCategory.value = item.category || "Cultura";
    activityForm.activityPlace.value = item.place || "";
    activityForm.activityDescription.value = item.description || "";
    setMessage(activityMessage, "Actividad completada automáticamente. Puedes ajustar cualquier dato.");
  } catch (error) {
    console.warn("No se pudo aplicar la plantilla de actividad:", error);
  }
}

function renderBudget(t) {
  outTransport.textContent = moneyFormatter.format(Number(t.transport || 0));
  outHotel.textContent = moneyFormatter.format(Number(t.hotel || 0));
  outFoodActivities.textContent = moneyFormatter.format(Number(t.food || 0) + Number(t.activitiesCost || 0));
  outBudgetTotal.textContent = moneyFormatter.format(budget(t));
}

function renderRecommended() {
  if (!destinos.length) {
    recommendationGrid.innerHTML = '<div class="empty-state">No hay destinos recomendados todavía.</div>';
    return;
  }

  recommendationGrid.innerHTML = destinos.map(i => `
    <article class="destination-card">
      <img src="${esc(i.image || "assets/fondo.jpg")}" alt="${esc(i.name)}" onerror="this.src='assets/fondo.jpg'">
      <div class="inner">
        <div class="inline-row"><strong>${esc(i.name)}</strong><span>⭐ ${esc(i.rating || "4.8")}</span></div>
        <p class="muted">${esc(i.description || "Sin descripción.")}</p>
        <div class="compact-actions compact-actions-spaced">
          <a class="small-btn" href="${esc(i.mapLink || mapsLink(i.name || ""))}" target="_blank" rel="noopener noreferrer">Ver mapa</a>
          <button class="small-btn" data-action="edit-rec" data-id="${esc(i.id)}">Editar</button>
          <button class="small-btn danger" data-action="delete-rec" data-id="${esc(i.id)}">Eliminar</button>
        </div>
      </div>
    </article>
  `).join("");
}

function defaultImageForDestination(name) {
  const key = normalizeForSearch(name);
  if (key.includes("paris")) return "assets/paris.jpg";
  if (key.includes("amsterdam")) return "assets/amsterdam.jpg";
  if (key.includes("tokio") || key.includes("japon")) return "assets/tokyo.jpg";
  if (key.includes("playa") || key.includes("cartagena") || key.includes("cancun") || key.includes("san andres")) return "assets/playa.jpg";
  if (key.includes("montana") || key.includes("bariloche") || key.includes("medellin")) return "assets/montana.jpg";
  return "assets/fondo.jpg";
}

function autoFillRecommendationForm() {
  if (!destinationForm) return;
  const name = clean(destinationForm.recName?.value);
  if (!name) return;
  if (!destinationForm.recRating.value) destinationForm.recRating.value = "4.8";
  if (!clean(destinationForm.recImage.value)) destinationForm.recImage.value = defaultImageForDestination(name);
  if (!clean(destinationForm.recMapLink.value)) destinationForm.recMapLink.value = mapsLink(name);
  if (!clean(destinationForm.recDescription.value)) {
    destinationForm.recDescription.value = `${name} es una recomendación WayTure lista para conectar con rutas, presupuesto e itinerario.`;
  }
}

function renderRequests() {
  if (contactRequestsList) {
    contactRequestsList.innerHTML = contactos.length ? contactos.map(c => `
      <article class="request-card">
        <div class="inline-row"><div><strong>${esc(c.name || "Sin nombre")}</strong><p class="muted">${esc(c.email || "Sin correo")}</p></div><span class="status-pill ${c.status === "gestionado" ? "finalizado" : c.status === "en gestion" ? "curso" : "planear"}">${esc(c.status || "pendiente")}</span></div>
        <div class="request-meta"><span>Destino: ${esc(c.destination || "Sin destino")}</span><span>Recibido: ${fmtDateTime(c.createdAt)}</span></div>
        <p class="muted">${esc(c.message || "Sin mensaje.")}</p>
        <label for="note-contact-${esc(c.id)}">Nota administrativa</label>
        <textarea class="admin-note-input" id="note-contact-${esc(c.id)}" data-note-contact="${esc(c.id)}" placeholder="Seguimiento, respuesta pendiente, próxima acción...">${esc(c.adminNote || "")}</textarea>
        <div class="compact-actions">
          <a class="small-btn" href="mailto:${esc(c.email || "")}">Responder por correo</a>
          <button class="small-btn" data-action="contact-status" data-status="en gestion" data-id="${esc(c.id)}" type="button">En gestión</button>
          <button class="small-btn" data-action="contact-status" data-status="gestionado" data-id="${esc(c.id)}" type="button">Gestionado</button>
          <button class="small-btn" data-action="save-contact-note" data-id="${esc(c.id)}" type="button">Guardar nota</button>
          <button class="small-btn danger" data-action="delete-contact" data-id="${esc(c.id)}" type="button">Eliminar</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">No hay solicitudes de contacto guardadas.</div>';
  }

  if (subscriptionRequestsList) {
    subscriptionRequestsList.innerHTML = suscripciones.length ? suscripciones.map(s => `
      <article class="request-card">
        <div class="inline-row"><div><strong>${esc(s.email || "Sin correo")}</strong><p class="muted">Origen: ${esc(s.source || "Formulario comunidad")}</p></div><span class="status-pill ${s.status === "archivada" ? "finalizado" : "curso"}">${esc(s.status || "activa")}</span></div>
        <div class="request-meta"><span>Recibido: ${fmtDateTime(s.createdAt)}</span></div>
        <div class="compact-actions">
          <a class="small-btn" href="mailto:${esc(s.email || "")}">Escribir</a>
          <button class="small-btn" data-action="subscription-status" data-status="activa" data-id="${esc(s.id)}" type="button">Activa</button>
          <button class="small-btn" data-action="subscription-status" data-status="archivada" data-id="${esc(s.id)}" type="button">Archivar</button>
          <button class="small-btn danger" data-action="delete-subscription" data-id="${esc(s.id)}" type="button">Eliminar</button>
        </div>
      </article>
    `).join("") : '<div class="empty-state">No hay suscripciones guardadas.</div>';
  }
}

function resetTripEdit() {
  editingTripId = null;
  tripForm.reset();
  if (tripForm.origin) tripForm.origin.value = DEFAULT_ORIGIN_AIRPORT;
  tripForm.tripStatus.innerHTML = statusOptions("Planificado");
  tripFormTitle.textContent = "Crear nuevo viaje";
  tripSubmitBtn.textContent = "Registrar viaje";
  cancelTripEditBtn.classList.add("is-hidden");
  setMessage(tripFormMessage, "");
}

function fillTripForm(t) {
  const trip = ensureTripSimulationFields(t);
  editingTripId = t.id;
  tripForm.tripCode.value = getTripCode(trip);
  tripForm.tripName.value = getTripName(trip);
  tripForm.origin.value = getTripOrigin(trip);
  tripForm.destination.value = getTripDestination(trip);
  tripForm.intermediatePoint1.value = trip.puntoIntermedio1 || trip.route?.[2]?.label || "";
  tripForm.intermediatePoint2.value = trip.puntoIntermedio2 || trip.route?.[3]?.label || "";
  tripForm.assignedEmail.value = trip.userEmail || "";
  tripForm.startDate.value = trip.startDate || "";
  tripForm.endDate.value = trip.endDate || "";
  tripForm.travelers.value = trip.travelers || 1;
  tripForm.experience.value = trip.experience || "Cultural";
  tripForm.tripStatus.innerHTML = statusOptions(trip.status);
  tripForm.lastLocation.value = trip.currentLocation?.label || trip.lastLocation || "";
  tripForm.mapQuery.value = trip.mapQuery || trip.currentLocation?.label || "";
  tripFormTitle.textContent = "Editar viaje";
  tripSubmitBtn.textContent = "Guardar cambios";
  cancelTripEditBtn.classList.remove("is-hidden");
  setMessage(tripFormMessage, "Editando " + (getTripCode(trip) || "viaje seleccionado") + ".");
  tripForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetActivityEdit() {
  editingActivityId = null;
  activityForm.reset();
  activitySubmitBtn.textContent = "Agregar actividad";
  cancelActivityEditBtn.classList.add("is-hidden");
  setMessage(activityMessage, "");
}

function fillActivityForm(activity) {
  editingActivityId = activity.id;
  activityForm.activityDate.value = activity.date || "";
  activityForm.activityTime.value = activity.time || "";
  activityForm.activityCategory.value = activity.category || "Cultura";
  activityForm.activityPlace.value = activity.place || "";
  activityForm.activityDescription.value = activity.description || "";
  activitySubmitBtn.textContent = "Guardar actividad";
  cancelActivityEditBtn.classList.remove("is-hidden");
  setMessage(activityMessage, "Editando actividad del itinerario.");
}

function resetDestinationEdit() {
  editingDestinationId = null;
  destinationForm.reset();
  destinationSubmitBtn.textContent = "Agregar destino recomendado";
  cancelDestinationEditBtn.classList.add("is-hidden");
  setMessage(destinationMessage, "");
}

function fillDestinationForm(destination) {
  editingDestinationId = destination.id;
  destinationForm.recName.value = destination.name || "";
  destinationForm.recRating.value = destination.rating || "";
  destinationForm.recImage.value = destination.image || "";
  destinationForm.recMapLink.value = destination.mapLink || "";
  destinationForm.recDescription.value = destination.description || "";
  destinationSubmitBtn.textContent = "Guardar destino recomendado";
  cancelDestinationEditBtn.classList.remove("is-hidden");
  setMessage(destinationMessage, "Editando destino recomendado.");
}

function renderTrips() {
  if (!viajes.length) {
    tripList.innerHTML = '<div class="empty-state">Todavia no hay viajes registrados. Crea el primero desde el formulario.</div>';
    return;
  }

  const items = filteredTrips();
  if (!items.length) {
    tripList.innerHTML = '<div class="empty-state">No encontramos viajes con esos filtros. Ajusta la busqueda o limpia los filtros.</div>';
    return;
  }

  tripList.innerHTML = `<div class="trip-table-wrap"><table class="trip-table">
    <thead><tr><th>Codigo</th><th>Viaje / ruta</th><th>Estado</th><th>Progreso</th><th>Ubicacion</th><th>Asignado</th><th>Acciones</th></tr></thead>
    <tbody>${items.map(t => {
      const status = normalizeStatus(t.status);
      const code = getTripCode(t);
      const destination = getTripDestination(t);
      const location = t.currentLocation?.label || t.lastLocation || destination;
      return `<tr class="${t.id === selectedId ? "selected" : ""} ${status === "Finalizado" ? "is-finalized" : ""}" data-row-id="${esc(t.id)}" tabindex="0">
        <td><span class="code-pill">${esc(code)}</span></td>
        <td><strong>${esc(getTripName(t))}</strong><br><span class="muted">${esc(getTripOrigin(t))} → ${esc(destination)}</span></td>
        <td><span class="status-pill ${statusClass(status)}">${esc(status)}</span></td>
        <td><strong>${Number(t.progreso || 0)}%</strong><br><span class="muted">${t.simulacionActiva ? "simulando" : "detenido"}</span></td>
        <td>${esc(location)}<br><span class="muted">${fmtDate(t.startDate)} - ${fmtDate(t.endDate)}</span></td>
        <td>${esc(t.userEmail || "publico / sin usuario")}<br><span class="muted">Gestor: ${esc(t.managedByName || t.assignedByEmail || "Sin asignar")}</span></td>
        <td><div class="table-actions">
          <button class="small-btn icon-btn" data-action="select" data-id="${t.id}" title="Ver detalle" aria-label="Ver detalle"><i data-lucide="eye"></i></button>
          <button class="small-btn icon-btn" data-action="edit" data-id="${t.id}" title="Editar viaje" aria-label="Editar viaje"><i data-lucide="pencil"></i></button>
          <button class="small-btn icon-btn" data-action="start-simulation" data-id="${t.id}" title="Iniciar simulacion" aria-label="Iniciar simulacion"><i data-lucide="play"></i></button>
          <button class="small-btn icon-btn" data-action="reset-simulation" data-id="${t.id}" title="Reiniciar simulacion" aria-label="Reiniciar simulacion"><i data-lucide="rotate-ccw"></i></button>
          <button class="small-btn icon-btn danger" data-action="incident" data-id="${t.id}" title="Simular incidencia" aria-label="Simular incidencia"><i data-lucide="triangle-alert"></i></button>
          <button class="small-btn icon-btn" data-action="copy" data-code="${esc(code)}" title="Copiar codigo" aria-label="Copiar codigo"><i data-lucide="copy"></i></button>
          <button class="small-btn icon-btn" data-action="track" data-code="${esc(code)}" title="Abrir rastreo" aria-label="Abrir rastreo"><i data-lucide="route"></i></button>
          <button class="small-btn icon-btn danger" data-action="delete" data-id="${t.id}" title="Eliminar" aria-label="Eliminar"><i data-lucide="trash-2"></i></button>
        </div></td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
  refreshIcons();
}

function renderSimulationPanel(t) {
  if (!simulationProgressPercent || !simulationProgressFill || !simulationLocation) return;
  if (!t) {
    simulationProgressPercent.textContent = "0%";
    simulationProgressFill.style.width = "0%";
    simulationLocation.textContent = "Selecciona un viaje para ver la ubicación simulada.";
    if (openTrackingLink) openTrackingLink.href = "rastreo-viaje.html";
    return;
  }
  const trip = ensureTripSimulationFields(t);
  const progress = Math.max(0, Math.min(100, Number(trip.progreso || 0)));
  simulationProgressPercent.textContent = `${progress}%`;
  simulationProgressFill.style.width = `${progress}%`;
  simulationLocation.textContent = `${trip.currentLocation?.label || "Ubicación GPS simulada"} · ${trip.estado}`;
  if (openTrackingLink) openTrackingLink.href = "rastreo-viaje.html?codigo=" + encodeURIComponent(getTripCode(trip));
}

function renderSelected() {
  const t = selectedTrip();
  if (!t) {
    selectedTripTitle.textContent = "Selecciona un viaje";
    selectedTripCode.textContent = "Sin codigo";
    selectedTripMeta.textContent = "Elige un viaje para editarlo.";
    renderizarMapaRuta(ensureTripSimulationFields({
      id: "admin-preview",
      codigoViaje: "WT-DEMO",
      nombreViaje: "Ruta demo WayTure",
      origen: DEFAULT_ORIGIN_AIRPORT,
      destino: "Medellín"
    }), { container: adminMap, fit: true });
    mapCaption.textContent = "Selecciona un viaje para ver su mapa.";
    activityList.innerHTML = '<div class="empty-state">Sin viaje seleccionado.</div>';
    statusHistoryList.innerHTML = '<div class="empty-state">Sin historial disponible.</div>';
    selectedClosedSummary.className = "closed-summary is-hidden";
    renderSimulationPanel(null);
    return;
  }

  const trip = ensureTripSimulationFields(t);
  const status = normalizeStatus(trip.status);
  selectedTripTitle.textContent = getTripName(trip);
  selectedTripCode.textContent = getTripCode(trip);
  selectedTripMeta.textContent = `${getTripOrigin(trip)} → ${getTripDestination(trip)} - ${trip.progreso}% - ${trip.travelers || 1} viajero(s) · Gestionado por ${trip.managedByName || trip.assignedByEmail || "Sin asignar"}`;
  editStatus.innerHTML = statusOptions(status);
  editLastLocation.value = trip.currentLocation?.label || trip.lastLocation || "";
  editMapQuery.value = trip.mapQuery || trip.currentLocation?.label || getTripDestination(trip);
  const suggestedBudget = estimateTripBudget({
    destination: getTripDestination(trip),
    travelers: trip.travelers || 1,
    startDate: trip.startDate,
    endDate: trip.endDate,
    experience: trip.experience
  });
  transportBudget.value = trip.transport || suggestedBudget.transport;
  hotelBudget.value = trip.hotel || suggestedBudget.hotel;
  foodBudget.value = trip.food || suggestedBudget.food;
  activitiesBudget.value = trip.activitiesCost || suggestedBudget.activitiesCost;
  personalNotes.value = trip.notes || "";
  renderizarMapaRuta(trip, { container: adminMap, fit: true });
  mapCaption.textContent = `Ruta simulada: ${getTripOrigin(trip)} → ${getTripDestination(trip)} · Gestor: ${trip.managedByName || trip.assignedByEmail || "Sin asignar"}`;
  renderSimulationPanel(trip);
  populateActivityTemplates(trip);
  renderActivities(trip);
  renderBudget(trip);
  renderStatusHistory(trip);
  renderClosedSummary(trip);
}

async function persistSimulationTrip(trip) {
  if (!trip?.id) return;
  await updateDoc(doc(db, "viajes", trip.id), {
    ...buildSimulationFirestorePatch(trip),
    updatedAt: serverTimestamp()
  });
}

function updateTripCache(trip) {
  const normalized = ensureTripSimulationFields(trip);
  viajes = viajes.map(item => item.id === normalized.id ? normalized : item);
  if (selectedId === normalized.id) {
    renderSimulationPanel(normalized);
    moverMarcadorEnRuta(normalized, { container: adminMap });
    renderStatusHistory(normalized);
    renderSelected();
  }
  renderTrips();
}

async function startTripSimulation(tripId = selectedId) {
  const existing = viajes.find(t => t.id === tripId);
  if (!existing) {
    setMessage(simulationMessage, "Selecciona un viaje para iniciar la simulación.", "error");
    return;
  }
  const trip = ensureTripSimulationFields(existing);
  simulationControllers.get(trip.id)?.stop?.();
  await persistSimulationTrip({ ...trip, simulacionActiva: true });
  const controller = iniciarSimulacionViaje({ ...trip, simulacionActiva: true }, {
    intervalMs: 1500,
    onTick: updated => {
      updateTripCache({ ...updated, id: trip.id });
      setMessage(simulationMessage, updated.estado === "Finalizado" ? "Simulación finalizada." : "Simulación GPS en curso.");
    },
    onPersist: updated => persistSimulationTrip({ ...updated, id: trip.id }),
    onDone: () => setMessage(simulationMessage, "Viaje finalizado automáticamente.")
  });
  simulationControllers.set(trip.id, controller);
}

async function resetTripSimulation(tripId = selectedId) {
  const existing = viajes.find(t => t.id === tripId);
  if (!existing) {
    setMessage(simulationMessage, "Selecciona un viaje para reiniciar la simulación.", "error");
    return;
  }
  simulationControllers.get(existing.id)?.stop?.();
  const reset = reiniciarSimulacion(existing);
  await persistSimulationTrip(reset);
  setMessage(simulationMessage, "Simulación reiniciada desde el origen.");
  await refresh();
}

async function incidentTripSimulation(tripId = selectedId) {
  const existing = viajes.find(t => t.id === tripId);
  if (!existing) {
    setMessage(simulationMessage, "Selecciona un viaje para simular una incidencia.", "error");
    return;
  }
  simulationControllers.get(existing.id)?.stop?.();
  const incident = detenerSimulacionPorIncidencia(existing);
  await persistSimulationTrip(incident);
  setMessage(simulationMessage, "El viaje presenta una incidencia y se encuentra detenido temporalmente.", "error");
  await refresh();
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    showBlocked("No has iniciado sesión.");
    setTimeout(() => location.href = "login.html", 800);
    return;
  }

  currentUser = user;
  const profileSnap = await getDoc(doc(db, "usuarios", user.uid));
  currentProfile = profileSnap.exists() ? profileSnap.data() : { rol: "usuario", nombre: user.displayName || "usuario", email: user.email };

  if (currentProfile.rol !== "admin") {
    showBlocked("No tienes permisos de administrador.");
    setTimeout(() => location.href = "panel-usuario.html#mis-viajes", 1200);
    return;
  }

  showDashboard();
  sessionInfo.textContent = `Administrador: ${currentProfile.nombre || user.displayName || user.email} - ${user.email}`;
  tripForm.tripStatus.innerHTML = statusOptions("Planificado");
  editStatus.innerHTML = statusOptions("Planificado");
  if (tripForm.origin && !tripForm.origin.value) tripForm.origin.value = DEFAULT_ORIGIN_AIRPORT;
  populateCountries();
  refreshIcons();
  startRealtime();
  await refresh();
});

tripForm.addEventListener("submit", async e => {
  e.preventDefault();
  const d = new FormData(tripForm);
  const email = clean(d.get("assignedEmail")).toLowerCase();

  try {
    setMessage(tripFormMessage, editingTripId ? "Guardando cambios..." : "Creando viaje...");
    const assigned = email ? await getUserByEmail(email) : null;
    if (!email) throw new Error("Debes asignar el viaje al correo de un usuario viajero.");
    if (!assigned) throw new Error("No existe un usuario viajero registrado con ese correo.");
    if (!isTravelerProfile(assigned)) throw new Error("Ese correo pertenece a una cuenta administrativa. Asigna el viaje a un usuario viajero.");
    const existing = editingTripId ? viajes.find(t => t.id === editingTripId) : null;
    let tripData = buildTripData(d, assigned, existing || {});
    if (await codeBelongsToOtherTrip(getTripCode(tripData), editingTripId || "")) {
      throw new Error("Ese código de viaje ya existe. Usa otro código o deja el campo vacío.");
    }
    if (!editingTripId && !clean(d.get("tripCode"))) {
      const generatedCode = await makeUniqueCode(tripData.destination);
      tripData = ensureTripSimulationFields({ ...tripData, codigoViaje: generatedCode, code: generatedCode });
    }

    if (editingTripId) {
      if (!existing) throw new Error("No se encontró el viaje que intentas editar.");
      const previousStatus = normalizeStatus(existing.status);
      const nextStatus = normalizeStatus(tripData.status);
      let statusHistory = [...(tripData.statusHistory || existing.statusHistory || [])];
      statusHistory = previousStatus !== nextStatus
        ? agregarHistorialSiCambio({ ...tripData, statusHistory, estado: previousStatus, status: previousStatus }, nextStatus, tripData.currentLocation, tripData.progreso, "Cambio guardado desde edición completa del viaje.")
        : statusHistory;

      const updateData = {
        ...tripData,
        statusHistory,
        ...buildSimulationFirestorePatch({ ...tripData, statusHistory }),
        managedBy: currentUser.uid,
        managedByName: currentManagerLabel(),
        managedByEmail: currentManagerEmail(),
        managedAt: serverTimestamp(),
        managedAction: "Edicion del viaje"
      };
      if (nextStatus === "Finalizado" && previousStatus !== "Finalizado") updateData.finishedAt = new Date().toISOString();
      await updateDoc(doc(db, "viajes", editingTripId), updateData);
      selectedId = editingTripId;
      resetTripEdit();
      setMessage(tripFormMessage, "Viaje actualizado correctamente.");
    } else {
      const code = getTripCode(tripData);
      const statusHistory = [crearEntradaHistorial(tripData.status, tripData.progreso, tripData.currentLocation, "Viaje creado desde el panel administrativo.")];
      const suggestedBudget = estimateTripBudget({
        destination: tripData.destination,
        travelers: tripData.travelers,
        startDate: tripData.startDate,
        endDate: tripData.endDate,
        experience: tripData.experience
      });
      const createData = {
        ...tripData,
        ...buildSimulationFirestorePatch({ ...tripData, statusHistory }),
        code,
        codigoViaje: code,
        statusHistory,
        finishedAt: normalizeStatus(tripData.status) === "Finalizado" ? new Date().toISOString() : "",
        transport: suggestedBudget.transport,
        hotel: suggestedBudget.hotel,
        food: suggestedBudget.food,
        activitiesCost: suggestedBudget.activitiesCost,
        notes: "",
        itinerary: [],
        createdBy: currentUser.uid,
        createdByRole: "admin",
        assignedBy: currentUser.uid,
        assignedByEmail: currentUser.email || "",
        assignedAt: serverTimestamp(),
        managedBy: currentUser.uid,
        managedByName: currentManagerLabel(),
        managedByEmail: currentManagerEmail(),
        managedAt: serverTimestamp(),
        managedAction: "Viaje creado",
        createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, "viajes"), createData);
      selectedId = ref.id;
      tripForm.reset();
      if (tripForm.origin) tripForm.origin.value = DEFAULT_ORIGIN_AIRPORT;
      tripForm.tripStatus.innerHTML = statusOptions("Planificado");
      setMessage(tripFormMessage, "Viaje guardado en Firebase. Código público: " + code + (email && !assigned ? " (correo no registrado; queda solo como referencia)" : ""));
    }

    await refresh();
  } catch (error) {
    console.error("Error guardando viaje:", error);
    setMessage(tripFormMessage, "No se pudo guardar el viaje: " + error.message, "error");
  }
});

tripList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) {
    const row = e.target.closest("tr[data-row-id]");
    if (row) {
      selectedId = row.dataset.rowId;
      renderTrips();
      renderSelected();
      document.getElementById("detalle-viaje")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return;
  }

  try {
    if (b.dataset.action === "select") selectedId = b.dataset.id;
    if (b.dataset.action === "edit") {
      selectedId = b.dataset.id;
      const t = selectedTrip();
      if (t) fillTripForm(t);
    }
    if (["select", "edit", "start-simulation", "reset-simulation", "incident"].includes(b.dataset.action)) {
      await markTripManaged(b.dataset.id, {
        select: "Seleccionado para gestion",
        edit: "Edicion del viaje",
        "start-simulation": "Simulacion iniciada",
        "reset-simulation": "Simulacion reiniciada",
        incident: "Incidencia simulada"
      }[b.dataset.action]);
    }
    if (b.dataset.action === "copy") {
      navigator.clipboard && navigator.clipboard.writeText(b.dataset.code);
      b.textContent = "Copiado";
    }
    if (b.dataset.action === "track") location.href = "rastreo-viaje.html?codigo=" + encodeURIComponent(b.dataset.code);
    if (b.dataset.action === "start-simulation") {
      selectedId = b.dataset.id;
      await startTripSimulation(b.dataset.id);
      return;
    }
    if (b.dataset.action === "reset-simulation") {
      selectedId = b.dataset.id;
      await resetTripSimulation(b.dataset.id);
      return;
    }
    if (b.dataset.action === "incident") {
      selectedId = b.dataset.id;
      await incidentTripSimulation(b.dataset.id);
      return;
    }
    if (b.dataset.action === "delete") {
      if (confirm("¿Eliminar este viaje de Firebase?")) {
        detenerSimulacionLocal(viajes.find(t => t.id === b.dataset.id) || b.dataset.id);
        await deleteDoc(doc(db, "viajes", b.dataset.id));
        if (selectedId === b.dataset.id) selectedId = null;
        if (editingTripId === b.dataset.id) resetTripEdit();
      }
    }
    await refresh();
  } catch (error) {
    console.error("Error en lista de viajes:", error);
    alert("No se pudo completar la acción: " + error.message);
  }
});

tripList.addEventListener("keydown", e => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("tr[data-row-id]")) {
    e.preventDefault();
    selectedId = e.target.dataset.rowId;
    renderTrips();
    renderSelected();
  }
});

clearTripsBtn.addEventListener("click", async () => {
  if (!confirm("¿Borrar TODOS los viajes de Firebase?")) return;
  for (const t of viajes) await deleteDoc(doc(db, "viajes", t.id));
  selectedId = null;
  resetTripEdit();
  await refresh();
});

exportTripsBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({ viajes, destinos, contactos, suscripciones }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "wayture-firebase-datos.json";
  a.click();
  URL.revokeObjectURL(url);
});

statusForm.addEventListener("submit", async e => {
  e.preventDefault();
  const t = selectedTrip();
  if (!t) return alert("Selecciona un viaje primero.");

  const d = new FormData(statusForm);
  const previousStatus = normalizeStatus(t.status);
  const nextStatus = normalizeStatus(d.get("editStatus"));
  const lastLocation = clean(d.get("editLastLocation")) || t.lastLocation || t.destination;
  const mapQuery = clean(d.get("editMapQuery")) || lastLocation;
  const comment = clean(d.get("statusComment"));
  const nextProgress = ["Finalizado", "En destino"].includes(nextStatus) ? 100 : Number(t.progreso || 0);
  const currentLocation = nextProgress === 100 ? (t.route?.[t.route.length - 1] || t.currentLocation) : {
    ...(t.currentLocation || {}),
    label: lastLocation,
    lat: Number(t.currentLocation?.lat) || t.route?.[0]?.lat || 4.711,
    lng: Number(t.currentLocation?.lng) || t.route?.[0]?.lng || -74.0721
  };
  const displayLocation = currentLocation?.label || lastLocation;
  let statusHistory = [...(t.statusHistory || [])];

  if (previousStatus !== nextStatus) {
    statusHistory = agregarHistorialSiCambio(
      { ...t, estado: previousStatus, status: previousStatus, statusHistory },
      nextStatus,
      currentLocation,
      nextProgress,
      comment || "Cambio registrado desde el panel administrativo."
    );
  }

  const updateData = {
    ...buildSimulationFirestorePatch({
      ...t,
      estado: nextStatus,
      status: nextStatus,
      currentLocation,
      progreso: nextProgress,
      statusHistory
    }),
    status: nextStatus,
    estado: nextStatus,
    progreso: nextProgress,
    lastLocation: displayLocation,
    mapQuery: nextProgress === 100 ? `${currentLocation.lat},${currentLocation.lng}` : mapQuery,
    currentLocation,
    statusHistory,
    managedBy: currentUser.uid,
    managedByName: currentManagerLabel(),
    managedByEmail: currentManagerEmail(),
    managedAt: serverTimestamp(),
    managedAction: "Cambio de estado",
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  };
  if (nextStatus === "Finalizado" && previousStatus !== "Finalizado") updateData.finishedAt = new Date().toISOString();
  if (nextStatus === "Incidencia") {
    detenerSimulacionLocal(t);
    updateData.simulacionActiva = false;
  }

  try {
    await updateDoc(doc(db, "viajes", selectedId), updateData);
    statusComment.value = "";
    setMessage(statusMessage, previousStatus === nextStatus ? "Ubicación y mapa actualizados." : "Estado actualizado e historial registrado.");
    await refresh();
  } catch (error) {
    console.error("Error actualizando estado:", error);
    setMessage(statusMessage, "No se pudo actualizar el estado: " + error.message, "error");
  }
});

activityForm.addEventListener("submit", async e => {
  e.preventDefault();
  const t = selectedTrip();
  if (!t) return alert("Selecciona un viaje primero.");

  const d = new FormData(activityForm);
  const activity = {
    id: editingActivityId || id(),
    date: d.get("activityDate") || t.startDate || "",
    time: d.get("activityTime"),
    place: clean(d.get("activityPlace")),
    category: d.get("activityCategory"),
    description: clean(d.get("activityDescription"))
  };

  if (!activity.time || !activity.place) {
    setMessage(activityMessage, "La hora y el lugar de la actividad son obligatorios.", "error");
    return;
  }

  const itinerary = editingActivityId
    ? (t.itinerary || []).map(a => a.id === editingActivityId ? activity : a)
    : [...(t.itinerary || []), activity];

  try {
    await updateDoc(doc(db, "viajes", selectedId), {
      itinerary,
      managedBy: currentUser.uid,
      managedByName: currentManagerLabel(),
      managedByEmail: currentManagerEmail(),
      managedAt: serverTimestamp(),
      managedAction: "Edicion de itinerario",
      lastUpdate: new Date().toISOString(),
      updatedAt: serverTimestamp()
    });
    const savedMessage = editingActivityId ? "Actividad actualizada." : "Actividad agregada al itinerario.";
    resetActivityEdit();
    setMessage(activityMessage, savedMessage);
    await refresh();
  } catch (error) {
    console.error("Error guardando actividad:", error);
    setMessage(activityMessage, "No se pudo guardar la actividad: " + error.message, "error");
  }
});

activityList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  const t = selectedTrip();
  if (!b || !t) return;

  if (b.dataset.action === "edit-activity") {
    const activity = (t.itinerary || []).find(a => a.id === b.dataset.id);
    if (activity) fillActivityForm(activity);
    return;
  }

  if (b.dataset.action === "delete-activity") {
    const itinerary = (t.itinerary || []).filter(a => a.id !== b.dataset.id);
    await updateDoc(doc(db, "viajes", selectedId), {
      itinerary,
      managedBy: currentUser.uid,
      managedByName: currentManagerLabel(),
      managedByEmail: currentManagerEmail(),
      managedAt: serverTimestamp(),
      managedAction: "Eliminacion de actividad",
      updatedAt: serverTimestamp()
    });
    if (editingActivityId === b.dataset.id) resetActivityEdit();
    await refresh();
  }
});

budgetForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!selectedId) return alert("Selecciona un viaje primero.");
  const d = new FormData(budgetForm);
  await updateDoc(doc(db, "viajes", selectedId), {
    transport: Number(d.get("transportBudget")) || 0,
    hotel: Number(d.get("hotelBudget")) || 0,
    food: Number(d.get("foodBudget")) || 0,
    activitiesCost: Number(d.get("activitiesBudget")) || 0,
    managedBy: currentUser.uid,
    managedByName: currentManagerLabel(),
    managedByEmail: currentManagerEmail(),
    managedAt: serverTimestamp(),
    managedAction: "Edicion de presupuesto",
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  });
  await refresh();
});

notesForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (!selectedId) return alert("Selecciona un viaje primero.");
  await updateDoc(doc(db, "viajes", selectedId), {
    notes: clean(new FormData(notesForm).get("personalNotes")),
    managedBy: currentUser.uid,
    managedByName: currentManagerLabel(),
    managedByEmail: currentManagerEmail(),
    managedAt: serverTimestamp(),
    managedAction: "Edicion de notas",
    lastUpdate: new Date().toISOString(),
    updatedAt: serverTimestamp()
  });
  await refresh();
});

destinationForm.addEventListener("submit", async e => {
  e.preventDefault();
  const d = new FormData(destinationForm);
  const name = clean(d.get("recName"));
  const rating = Number(d.get("recRating"));

  if (!name) {
    setMessage(destinationMessage, "El nombre del destino es obligatorio.", "error");
    return;
  }
  if (Number.isNaN(rating) || rating < 0 || rating > 5) {
    setMessage(destinationMessage, "La valoración debe ser un número entre 0 y 5.", "error");
    return;
  }

  const data = {
    name,
    image: clean(d.get("recImage")) || "assets/fondo.jpg",
    rating,
    description: clean(d.get("recDescription")),
    mapLink: clean(d.get("recMapLink")) || mapsLink(name),
    updatedAt: serverTimestamp()
  };

  try {
    if (editingDestinationId) {
      await updateDoc(doc(db, "destinosRecomendados", editingDestinationId), {
        ...data,
        managedBy: currentUser.uid,
        managedByName: currentManagerLabel(),
        managedByEmail: currentManagerEmail()
      });
      resetDestinationEdit();
      setMessage(destinationMessage, "Destino recomendado actualizado.");
    } else {
      await addDoc(collection(db, "destinosRecomendados"), { ...data, createdAt: serverTimestamp(), createdBy: currentUser.uid, managedBy: currentUser.uid, managedByName: currentManagerLabel(), managedByEmail: currentManagerEmail() });
      resetDestinationEdit();
      setMessage(destinationMessage, "Destino recomendado agregado.");
    }
    await refresh();
  } catch (error) {
    console.error("Error guardando destino recomendado:", error);
    setMessage(destinationMessage, "No se pudo guardar el destino: " + error.message, "error");
  }
});

recommendationGrid.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;

  if (b.dataset.action === "edit-rec") {
    const destination = destinos.find(i => i.id === b.dataset.id);
    if (destination) fillDestinationForm(destination);
    return;
  }

  if (b.dataset.action === "delete-rec") {
    await deleteDoc(doc(db, "destinosRecomendados", b.dataset.id));
    if (editingDestinationId === b.dataset.id) resetDestinationEdit();
    await refresh();
  }
});

if (tripFilters) {
  tripFilters.addEventListener("input", renderTrips);
  tripFilters.addEventListener("change", renderTrips);
}
if (tripForm?.destination) {
  tripForm.destination.addEventListener("input", () => {
    const destination = clean(tripForm.destination.value);
    if (!destination) return;
    applyTripAutomation({ destination, force: false });
  });
}
function applySelectedCityToTripForm() {
  const city = tripCity?.value || "";
  if (!city || !tripCountry?.value) return;
  const destination = countryCityLabel(tripCountry.value, city);
  const found = (DESTINATION_CATALOG[tripCountry.value] || []).find(([name]) => name === city);
  applyTripAutomation({
    destination,
    location: found?.[1],
    experience: found?.[2] || "Cultural",
    travelers: found?.[3] || 2,
    force: true
  });
}
if (tripCountry) tripCountry.addEventListener("change", () => {
  populateCities(tripCountry.value);
  const firstCity = tripCity.options[1]?.value || "";
  if (firstCity) {
    tripCity.value = firstCity;
    populateTripPlans(tripCountry.value, firstCity);
    applySelectedCityToTripForm();
  }
});
if (tripCity) tripCity.addEventListener("change", () => {
  populateTripPlans(tripCountry.value, tripCity.value);
  applySelectedCityToTripForm();
});
if (tripForm?.tripPreset) tripForm.tripPreset.addEventListener("change", () => {
  applyPreset(tripForm.tripPreset?.value || "");
});
if (applyTripPresetBtn) applyTripPresetBtn.addEventListener("click", () => {
  applyPreset(tripForm.tripPreset?.value || "");
});
if (clearFiltersBtn) clearFiltersBtn.addEventListener("click", () => {
  tripFilters.reset();
  renderTrips();
});
if (cancelTripEditBtn) cancelTripEditBtn.addEventListener("click", resetTripEdit);
if (cancelActivityEditBtn) cancelActivityEditBtn.addEventListener("click", resetActivityEdit);
if (cancelDestinationEditBtn) cancelDestinationEditBtn.addEventListener("click", resetDestinationEdit);
if (refreshRequestsBtn) refreshRequestsBtn.addEventListener("click", refreshRequests);
if (activityTemplate) activityTemplate.addEventListener("change", () => applyActivityTemplate(activityTemplate.value));
if (destinationForm?.recName) destinationForm.recName.addEventListener("change", autoFillRecommendationForm);
if (startSimulationBtn) startSimulationBtn.addEventListener("click", () => startTripSimulation());
if (resetSimulationBtn) resetSimulationBtn.addEventListener("click", () => resetTripSimulation());
if (incidentSimulationBtn) incidentSimulationBtn.addEventListener("click", () => incidentTripSimulation());

if (contactRequestsList) contactRequestsList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "contact-status") {
    await updateDoc(doc(db, "contactos", b.dataset.id), { status: b.dataset.status, updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "save-contact-note") {
    const note = document.querySelector(`[data-note-contact="${b.dataset.id}"]`);
    await updateDoc(doc(db, "contactos", b.dataset.id), { adminNote: clean(note?.value), updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "delete-contact") {
    if (confirm("¿Eliminar esta solicitud de contacto?")) await deleteDoc(doc(db, "contactos", b.dataset.id));
  }
  await refreshRequests();
});

if (subscriptionRequestsList) subscriptionRequestsList.addEventListener("click", async e => {
  const b = e.target.closest("button[data-action]");
  if (!b) return;
  if (b.dataset.action === "subscription-status") {
    await updateDoc(doc(db, "suscripciones", b.dataset.id), { status: b.dataset.status, updatedAt: serverTimestamp(), managedBy: currentUser.uid });
  }
  if (b.dataset.action === "delete-subscription") {
    if (confirm("¿Eliminar esta suscripción?")) await deleteDoc(doc(db, "suscripciones", b.dataset.id));
  }
  await refreshRequests();
});

logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

document.querySelectorAll(".tab-btn").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab-btn").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
}));

document.querySelectorAll(".request-tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".request-tab").forEach(x => x.classList.remove("active"));
  document.querySelectorAll(".request-panel").forEach(x => x.classList.remove("active"));
  btn.classList.add("active");
  document.getElementById("request-" + btn.dataset.requestTab).classList.add("active");
}));

if (menuToggle && mainNav) menuToggle.addEventListener("click", () => {
  const open = mainNav.classList.toggle("is-open");
  menuToggle.setAttribute("aria-expanded", String(open));
});

const obs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) e.target.classList.add("visible");
}), { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => obs.observe(el));
refreshIcons();
