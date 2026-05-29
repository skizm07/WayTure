import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  buildSimulationFirestorePatch,
  crearEntradaHistorial,
  ensureTripSimulationFields,
  generarRutaSimulada,
  getTripCode,
  getTripDestination,
  getTripName,
  getTripOrigin,
  normalizeTripCode,
  normalizeTripStatus
} from "./trip-simulation.js";

const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const userPanelContent = document.getElementById("userPanelContent");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let currentProfile = null;
let myTripsCache = [];
let editingTripId = null;
let unsubscribeMyTrips = null;
const DEFAULT_ORIGIN_AIRPORT = "Aeropuerto Internacional El Dorado, Bogotá";
const DESTINATION_CATALOG = {
  "Colombia": [["Bogota", "Monserrate, Bogota", "Cultural", 2], ["Cartagena", "Ciudad Amurallada, Cartagena", "Descanso", 2], ["Medellin", "Comuna 13, Medellin", "Cultural", 2], ["Santa Marta", "Parque Tayrona, Santa Marta", "Aventura", 2], ["San Andres", "Johnny Cay, San Andres", "Descanso", 2], ["Cali", "San Antonio, Cali", "Gastronomico", 2]],
  "Mexico": [["Ciudad de Mexico", "Centro Historico CDMX", "Cultural", 2], ["Cancun", "Zona Hotelera Cancun", "Descanso", 2], ["Guadalajara", "Centro de Guadalajara", "Gastronomico", 2], ["Oaxaca", "Centro Historico Oaxaca", "Gastronomico", 2], ["Merida", "Paseo de Montejo, Merida", "Cultural", 2]],
  "Estados Unidos": [["Nueva York", "Times Square, New York", "Cultural", 2], ["Miami", "South Beach Miami", "Descanso", 2], ["Los Angeles", "Hollywood Boulevard", "Cultural", 2], ["Orlando", "Walt Disney World Orlando", "Familiar", 4], ["San Francisco", "Golden Gate Bridge", "Aventura", 2]],
  "Espana": [["Madrid", "Puerta del Sol, Madrid", "Cultural", 2], ["Barcelona", "Sagrada Familia, Barcelona", "Cultural", 2], ["Sevilla", "Real Alcazar de Sevilla", "Cultural", 2], ["Valencia", "Ciudad de las Artes y las Ciencias", "Familiar", 2], ["Granada", "Alhambra, Granada", "Cultural", 2]],
  "Francia": [["Paris", "Torre Eiffel, Paris", "Cultural", 2], ["Niza", "Promenade des Anglais, Nice", "Descanso", 2], ["Lyon", "Vieux Lyon", "Gastronomico", 2], ["Marsella", "Puerto Viejo de Marsella", "Cultural", 2]],
  "Italia": [["Roma", "Coliseo Romano", "Cultural", 2], ["Venecia", "Plaza de San Marcos, Venecia", "Cultural", 2], ["Florencia", "Duomo Firenze", "Cultural", 2], ["Milan", "Duomo di Milano", "Tecnologia y compras", 2], ["Napoles", "Centro Storico Napoli", "Gastronomico", 2]],
  "Japon": [["Tokio", "Shibuya Crossing, Tokyo", "Tecnologia y compras", 1], ["Kioto", "Fushimi Inari Taisha, Kyoto", "Cultural", 2], ["Osaka", "Dotonbori Osaka", "Gastronomico", 2], ["Sapporo", "Odori Park Sapporo", "Aventura", 2]],
  "Brasil": [["Rio de Janeiro", "Cristo Redentor, Rio de Janeiro", "Aventura", 2], ["Sao Paulo", "Avenida Paulista, Sao Paulo", "Tecnologia y compras", 2], ["Salvador", "Pelourinho Salvador", "Cultural", 2], ["Florianopolis", "Praia Mole Florianopolis", "Descanso", 2]],
  "Argentina": [["Buenos Aires", "Obelisco Buenos Aires", "Cultural", 2], ["Bariloche", "Cerro Catedral Bariloche", "Aventura", 2], ["Mendoza", "Parque General San Martin Mendoza", "Gastronomico", 2], ["Ushuaia", "Parque Nacional Tierra del Fuego", "Aventura", 2]],
  "Paises Bajos": [["Amsterdam", "Amsterdam Centraal", "Cultural", 2], ["Rotterdam", "Erasmusbrug Rotterdam", "Cultural", 2], ["La Haya", "Binnenhof The Hague", "Cultural", 2]]
};

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  }[c]));
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

function budget(t) {
  return Number(t.transport || 0) + Number(t.hotel || 0) + Number(t.food || 0) + Number(t.activitiesCost || 0);
}

function fmtDate(d) {
  if (!d) return "Sin fecha";
  const date = new Date(d + "T00:00:00");
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function makeCode(destination) {
  const base = clean(destination)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase()
    .slice(0, 14) || "VIAJE";
  return `WT-${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

async function codeExists(code) {
  const normalized = normalizeTripCode(code);
  const [codeSnap, codigoSnap] = await Promise.all([
    getDocs(query(collection(db, "viajes"), where("code", "==", normalized))),
    getDocs(query(collection(db, "viajes"), where("codigoViaje", "==", normalized)))
  ]);
  return !codeSnap.empty || !codigoSnap.empty;
}

async function makeUniqueCode(destination) {
  for (let i = 0; i < 30; i += 1) {
    const code = makeCode(destination);
    if (!(await codeExists(code))) return code;
  }
  return `WT-${Date.now()}`;
}

function initials(nombre) {
  return String(nombre || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "U";
}

function syncUserMenu(nombre) {
  document.querySelectorAll("[data-user-name]").forEach(box => { box.textContent = nombre; });
  document.querySelectorAll("[data-user-initials]").forEach(box => { box.textContent = initials(nombre); });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function countryCityLabel(country, city) {
  return city && country ? `${city}, ${country}` : city || country || "";
}

function populateUserCountries(form) {
  const country = form.querySelector("#userTripCountry");
  const city = form.querySelector("#userTripCity");
  const preset = form.querySelector("#userTripPreset");
  if (!country || !city || !preset) return;
  country.innerHTML = '<option value="">Seleccionar pais</option>' +
    Object.keys(DESTINATION_CATALOG).map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
  populateUserCities(form, "");
}

function populateUserCities(form, countryName) {
  const city = form.querySelector("#userTripCity");
  const preset = form.querySelector("#userTripPreset");
  if (!city || !preset) return;
  const cities = DESTINATION_CATALOG[countryName] || [];
  city.innerHTML = '<option value="">Seleccionar ciudad</option>' +
    cities.map(([name]) => `<option value="${esc(name)}">${esc(name)}</option>`).join("");
  populateUserPlans(form, countryName, "");
}

function populateUserPlans(form, countryName, selectedCity) {
  const preset = form.querySelector("#userTripPreset");
  if (!preset) return;
  const cities = DESTINATION_CATALOG[countryName] || [];
  preset.innerHTML = '<option value="">Elegir plan</option>' + cities
    .filter(([city]) => !selectedCity || city === selectedCity)
    .map(([city, location, experience, travelers]) => {
      const destination = countryCityLabel(countryName, city);
      return `<option value="${esc([destination, location, experience, travelers].join("|"))}">${esc(city)} - ${esc(experience)}</option>`;
    })
    .join("");
}

function userTripControls(form) {
  return {
    origin: form.querySelector("#userOrigin"),
    destination: form.querySelector("#userDestination"),
    intermediatePoint1: form.querySelector("#userIntermediatePoint1"),
    intermediatePoint2: form.querySelector("#userIntermediatePoint2"),
    lastLocation: form.querySelector("#userLastLocation"),
    mapQuery: form.querySelector("#userMapQuery"),
    experience: form.querySelector("#userExperience"),
    travelers: form.querySelector("#userTravelers"),
    startDate: form.querySelector("#userStartDate"),
    endDate: form.querySelector("#userEndDate")
  };
}

function applyUserPreset(form, raw) {
  if (!raw) return;
  const controls = userTripControls(form);
  const [dest, location, experience, travelers] = raw.split("|");
  if (controls.origin && !clean(controls.origin.value)) controls.origin.value = DEFAULT_ORIGIN_AIRPORT;
  const [mid1, mid2] = routeDefaultsForDestination(dest);
  controls.destination.value = dest || "";
  if (controls.intermediatePoint1) controls.intermediatePoint1.value = mid1;
  if (controls.intermediatePoint2) controls.intermediatePoint2.value = mid2;
  controls.lastLocation.value = location || dest || "";
  controls.mapQuery.value = location || dest || "";
  controls.experience.value = experience || "Cultural";
  controls.travelers.value = travelers || 1;
  if (!controls.startDate.value) controls.startDate.value = dateOffset(7);
  controls.endDate.value = addDays(controls.startDate.value, defaultDurationByExperience(controls.experience.value));
  applyUserBudgetEstimate(form);
  form.querySelector("#userTripFormMessage").textContent = "Destino aplicado automáticamente. Puedes guardar o ajustar detalles.";
}

function applyUserBudgetEstimate(form) {
  const controls = userTripControls(form);
  const estimate = estimateTripBudget({
    destination: controls.destination?.value,
    travelers: Number(controls.travelers?.value || 1),
    startDate: controls.startDate?.value,
    endDate: controls.endDate?.value,
    experience: controls.experience?.value
  });
  const set = (name, value) => {
    const input = form.querySelector(`[name="${name}"]`);
    if (input && (!Number(input.value) || input.dataset.autoFilled === "true")) {
      input.value = value;
      input.dataset.autoFilled = "true";
    }
  };
  set("transport", estimate.transport);
  set("hotel", estimate.hotel);
  set("food", estimate.food);
  set("activitiesCost", estimate.activitiesCost);
}

function validateDates(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("La fecha de regreso no puede ser anterior a la fecha de salida.");
  }
}

async function fetchMyTrips(user) {
  const byUid = query(collection(db, "viajes"), where("userId", "==", user.uid));
  const uidSnap = await getDocs(byUid);
  const map = new Map();
  uidSnap.docs.forEach(d => map.set(d.id, ensureTripSimulationFields({ id: d.id, ...d.data() })));

  if (user.email) {
    const byEmail = query(collection(db, "viajes"), where("userEmail", "==", user.email.toLowerCase()));
    const emailSnap = await getDocs(byEmail);
    emailSnap.docs.forEach(d => map.set(d.id, ensureTripSimulationFields({ id: d.id, ...d.data() })));
  }

  return Array.from(map.values()).sort((a, b) => String(b.createdAt?.seconds || b.lastUpdate || "").localeCompare(String(a.createdAt?.seconds || a.lastUpdate || "")));
}

function subscribeToMyTrips(user) {
  unsubscribeMyTrips?.();
  const uidMap = new Map();
  const emailMap = new Map();
  const pushSnapshot = () => {
    const merged = new Map([...uidMap.entries(), ...emailMap.entries()]);
    myTripsCache = Array.from(merged.values()).sort((a, b) => String(b.createdAt?.seconds || b.lastUpdate || "").localeCompare(String(a.createdAt?.seconds || a.lastUpdate || "")));
    renderPanel();
  };

  const applySnapshot = (targetMap, snap) => {
    targetMap.clear();
    snap.docs.forEach(d => targetMap.set(d.id, ensureTripSimulationFields({ id: d.id, ...d.data() })));
    pushSnapshot();
  };

  const subscriptions = [
    onSnapshot(query(collection(db, "viajes"), where("userId", "==", user.uid)), snap => applySnapshot(uidMap, snap), error => console.error("No se pudo escuchar viajes por uid:", error))
  ];

  if (user.email) {
    subscriptions.push(
      onSnapshot(query(collection(db, "viajes"), where("userEmail", "==", user.email.toLowerCase())), snap => applySnapshot(emailMap, snap), error => console.error("No se pudo escuchar viajes por correo:", error))
    );
  }

  unsubscribeMyTrips = () => subscriptions.forEach(unsub => unsub?.());
}

function tripFormTemplate(t = {}) {
  const isEdit = Boolean(t.id);
  return `
    <form id="userTripForm" class="stack history-card user-trip-form-card">
      <strong>${isEdit ? "Editar viaje" : "Crear viaje"}</strong>
      <p class="muted">${isEdit ? "Actualiza los datos básicos de este viaje asignado." : "Este viaje quedará asignado a tu correo."}</p>
      <div class="user-form-grid">
        <div><label for="userOrigin">Origen</label><input id="userOrigin" name="origin" type="text" required value="${esc(getTripOrigin(t))}" placeholder="Ej. Aeropuerto Internacional El Dorado"></div>
        <div><label for="userDestination">Destino final</label><input id="userDestination" name="destination" type="text" required value="${esc(getTripDestination(t) === "Destino" ? "" : getTripDestination(t))}" placeholder="Ej. Cartagena, Colombia"></div>
      </div>
      <div class="user-form-grid">
        <div><label for="userStartDate">Fecha de salida</label><input id="userStartDate" name="startDate" type="date" value="${esc(t.startDate || "")}"></div>
        <div><label for="userEndDate">Fecha de regreso</label><input id="userEndDate" name="endDate" type="date" value="${esc(t.endDate || "")}"></div>
      </div>
      <details class="form-section compact-details">
        <summary>Opciones avanzadas y presupuesto</summary>
        <div class="user-form-grid">
          <div><label for="userIntermediatePoint1">Punto intermedio 1</label><input id="userIntermediatePoint1" name="intermediatePoint1" type="text" value="${esc(t.puntoIntermedio1 || t.route?.[2]?.label || "")}" placeholder="Se sugiere automáticamente"></div>
          <div><label for="userIntermediatePoint2">Punto intermedio 2</label><input id="userIntermediatePoint2" name="intermediatePoint2" type="text" value="${esc(t.puntoIntermedio2 || t.route?.[3]?.label || "")}" placeholder="Se sugiere automáticamente"></div>
        </div>
        <div class="user-form-grid">
          <div><label for="userTravelers">Viajeros</label><input id="userTravelers" name="travelers" type="number" min="1" value="${esc(t.travelers || 1)}"></div>
          <div>
            <label for="userExperience">Tipo de experiencia</label>
            <select id="userExperience" name="experience">
              ${["Cultural", "Aventura", "Romantico", "Gastronomico", "Descanso", "Negocios", "Familiar"].map(x => `<option ${t.experience === x ? "selected" : ""}>${x}</option>`).join("")}
            </select>
          </div>
        </div>
        <div><label for="userLastLocation">Última ubicación / lugar principal</label><input id="userLastLocation" name="lastLocation" type="text" value="${esc(t.lastLocation || "")}" placeholder="Ej. Centro histórico, Cartagena"></div>
        <div><label for="userMapQuery">Búsqueda para el mapa</label><input id="userMapQuery" name="mapQuery" type="text" value="${esc(t.mapQuery || "")}" placeholder="Ej. Cartagena Colombia"></div>
        <div class="user-budget-grid">
          <div><label>Transporte</label><input name="transport" type="number" min="0" value="${esc(t.transport || 0)}"></div>
          <div><label>Hospedaje</label><input name="hotel" type="number" min="0" value="${esc(t.hotel || 0)}"></div>
          <div><label>Comida</label><input name="food" type="number" min="0" value="${esc(t.food || 0)}"></div>
          <div><label>Actividades</label><input name="activitiesCost" type="number" min="0" value="${esc(t.activitiesCost || 0)}"></div>
        </div>
      </details>
      <p class="private-note">Presupuesto privado: ${moneyFormatter.format(budget(t))}</p>
      <div><label for="userNotes">Notas personales privadas</label><textarea id="userNotes" name="notes" placeholder="Ideas, restaurantes, lugares pendientes...">${esc(t.notes || "")}</textarea></div>
      <div class="compact-actions">
        <button class="btn btn-primary" type="submit">${isEdit ? "Guardar cambios" : "Crear viaje"}</button>
        ${isEdit ? '<button class="btn btn-secondary" type="button" id="cancelUserEdit">Cancelar edición</button>' : ""}
      </div>
      <p class="success" id="userTripFormMessage"></p>
    </form>
  `;
}

function profileFormTemplate() {
  const nombre = currentProfile?.nombre || currentUser?.displayName || "";
  const alias = currentProfile?.alias || "";
  const email = currentUser?.email || currentProfile?.email || "";
  return `
    <form id="profileForm" class="stack history-card account-form-card">
      <strong>Datos de cuenta</strong>
      <p class="muted">Actualiza tus datos básicos de perfil.</p>
      <div class="user-form-grid">
        <div><label for="profileName">Nombre</label><input id="profileName" name="nombre" type="text" value="${esc(nombre)}" required></div>
        <div><label for="profileAlias">Alias</label><input id="profileAlias" name="alias" type="text" value="${esc(alias)}" placeholder="Ej. Viajero frecuente"></div>
      </div>
      <div><label for="profileEmail">Correo de inicio de sesión</label><input id="profileEmail" type="email" value="${esc(email)}" readonly></div>
      <div class="compact-actions">
        <button class="btn btn-primary" type="submit">Guardar cuenta</button>
        <button class="btn btn-secondary" type="button" id="resetPasswordBtn">Cambiar contraseña</button>
      </div>
      <p class="success" id="profileMessage"></p>
    </form>
  `;
}

function renderPanelLegacy() {
  const userName = currentProfile?.nombre || currentUser?.displayName || currentUser?.email || "usuario";
  const editingTrip = editingTripId ? myTripsCache.find(t => t.id === editingTripId) : null;
  const tripsMarkup = myTripsCache.length ? myTripsCache.map(t => `
    <article class="history-card">
      <strong>${esc(t.code)} · ${esc(t.destination || "Destino")}</strong>
      <p class="muted">Estado: ${esc(normalizeStatus(t.status))}<br>Salida: ${fmtDate(t.startDate)} · Regreso: ${fmtDate(t.endDate)}<br>Última ubicación: ${esc(t.lastLocation || t.destination || "Sin ubicación")}</p>
      <div class="compact-actions compact-actions-spaced">
        <a class="small-btn" href="rastreo-viaje.html?codigo=${encodeURIComponent(t.code || "")}">Ver detalle/rastreo</a>
        <button class="small-btn" data-action="edit-my-trip" data-id="${esc(t.id)}">Editar datos básicos</button>
      </div>
    </article>
  `).join("") : '<div class="empty-state">No tienes viajes asignados por ahora.</div>';

  userPanelContent.innerHTML = `
    <article class="card user-panel-card full-width" id="mis-viajes">
      <span class="eyebrow">Mis viajes asignados</span>
      <h2>Viajes de ${esc(userName)}</h2>
      <div class="history-list">${tripsMarkup}</div>
    </article>
    <article class="card user-panel-card" id="crear-viaje">
      <span class="eyebrow">Crear viaje</span>
      <h2>${editingTrip ? "Editar viaje asignado" : "Nuevo viaje"}</h2>
      ${tripFormTemplate(editingTrip || {})}
    </article>
    <article class="card user-panel-card" id="datos-cuenta">
      <span class="eyebrow">Mi perfil</span>
      <h2>Datos de cuenta</h2>
      ${profileFormTemplate()}
    </article>
  `;

  userPanelContent.querySelector("#userTripForm").addEventListener("submit", handleUserTripSubmit);
  userPanelContent.querySelector("#profileForm").addEventListener("submit", handleProfileSubmit);
  userPanelContent.querySelector("#resetPasswordBtn").addEventListener("click", handlePasswordReset);

  const cancelBtn = userPanelContent.querySelector("#cancelUserEdit");
  if (cancelBtn) cancelBtn.addEventListener("click", () => {
    editingTripId = null;
    renderPanel();
  });

  userPanelContent.querySelectorAll("button[data-action='edit-my-trip']").forEach(btn => {
    btn.addEventListener("click", () => {
      editingTripId = btn.dataset.id;
      renderPanel();
      document.getElementById("crear-viaje")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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
  if (key.includes("paris")) return ["Madrid", "Lyon"];
  if (key.includes("kioto") || key.includes("tokio")) return ["Monte Fuji", "Osaka"];
  if (key.includes("miami") || key.includes("orlando")) return ["Washington DC", "Orlando"];
  if (key.includes("cancun")) return ["Puebla", "Mérida"];
  if (key.includes("bariloche")) return ["Neuquén", "Villa La Angostura"];
  return ["Punto intermedio 1", "Punto intermedio 2"];
}

function defaultDurationByExperience(experience) {
  const key = normalizeForSearch(experience);
  if (key.includes("aventura") || key.includes("familiar") || key.includes("tecnologia")) return 7;
  if (key.includes("descanso")) return 5;
  return 6;
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

function renderPanel() {
  const userName = currentProfile?.nombre || currentUser?.displayName || currentUser?.email || "usuario";
  const editingTrip = editingTripId ? myTripsCache.find(t => t.id === editingTripId) : null;
  const activeTrips = myTripsCache.filter(t => normalizeStatus(t.status) !== "Finalizado").length;
  const totalBudget = myTripsCache.reduce((sum, t) => sum + budget(t), 0);
  const tripsMarkup = myTripsCache.length ? `<div class="trip-table-wrap user-trip-table-wrap"><table class="trip-table">
    <thead><tr><th>Codigo</th><th>Destino</th><th>Estado</th><th>Fechas</th><th>Ubicacion</th><th>Gestor</th><th>Acciones</th></tr></thead>
    <tbody>${myTripsCache.map(t => `<tr>
      <td><span class="code-pill">${esc(getTripCode(t) || "Sin codigo")}</span></td>
      <td><strong>${esc(getTripName(t))}</strong><br><span class="muted">${esc(getTripOrigin(t))} → ${esc(getTripDestination(t))}</span></td>
      <td>${esc(normalizeStatus(t.status))}</td>
      <td>${fmtDate(t.startDate)}<br><span class="muted">${fmtDate(t.endDate)}</span></td>
      <td>${esc(t.currentLocation?.label || t.lastLocation || getTripDestination(t) || "Sin ubicacion")}</td>
      <td>${esc(t.managedByName || t.assignedByEmail || "Sin asignar")}</td>
      <td><div class="table-actions"><a class="small-btn icon-btn" href="rastreo-viaje.html?codigo=${encodeURIComponent(getTripCode(t) || "")}" title="Abrir rastreo" aria-label="Abrir rastreo"><i data-lucide="route"></i></a></div></td>
    </tr>`).join("")}</tbody></table></div>` : '<div class="empty-state">No tienes viajes asignados por ahora.</div>';

  userPanelContent.innerHTML = `
    <div class="user-dashboard-layout full-width">
      <aside class="card user-panel-card user-side-panel">
        <span class="eyebrow">Mi dashboard</span>
        <h2>${esc(userName)}</h2>
        <nav class="side-nav">
          <a href="#mis-viajes">Mis viajes</a>
          <a href="datos-cuenta.html">Datos de cuenta</a>
          <a href="rastreo-viaje.html">Rastreo publico</a>
        </nav>
      </aside>
      <main class="user-dashboard-main">
        <div class="metrics-grid user-metrics">
          <article class="metric-card"><strong>${myTripsCache.length}</strong><span>viajes</span></article>
          <article class="metric-card"><strong>${activeTrips}</strong><span>activos</span></article>
          <article class="metric-card"><strong>${moneyFormatter.format(totalBudget)}</strong><span>presupuesto privado</span></article>
        </div>
        <article class="card user-panel-card full-width" id="mis-viajes">
          <div class="inline-row"><div><span class="eyebrow">Mis viajes asignados</span><h2>Viajes de ${esc(userName)}</h2></div><a class="small-btn" href="datos-cuenta.html">Datos de cuenta</a></div>
          ${tripsMarkup}
        </article>
      </main>
    </div>
  `;

  refreshIcons();
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const msg = form.querySelector("#profileMessage");
  const data = new FormData(form);
  const nombre = clean(data.get("nombre"));
  const alias = clean(data.get("alias"));
  const rol = currentProfile?.rol || "usuario";

  try {
    msg.textContent = "Guardando datos de cuenta...";
    await updateProfile(currentUser, { displayName: nombre });
    await setDoc(doc(db, "usuarios", currentUser.uid), {
      uid: currentUser.uid,
      nombre,
      alias,
      email: currentUser.email || "",
      rol,
      actualizadoEn: serverTimestamp()
    }, { merge: true });
    currentProfile = { ...currentProfile, uid: currentUser.uid, nombre, alias, email: currentUser.email || "", rol };
    localStorage.setItem("wayture_logged_user", nombre);
    localStorage.setItem("wayture_user_role", rol);
    syncUserMenu(nombre);
    msg.textContent = "Datos de cuenta actualizados.";
  } catch (error) {
    console.error("No se pudo actualizar el perfil:", error);
    msg.textContent = "No se pudo actualizar la cuenta: " + error.message;
  }
}

async function handlePasswordReset() {
  const msg = document.getElementById("profileMessage");
  if (!currentUser?.email) {
    msg.textContent = "Tu cuenta no tiene un correo disponible para recuperar contraseña.";
    return;
  }
  try {
    msg.textContent = "Enviando enlace de cambio de contraseña...";
    await sendPasswordResetEmail(auth, currentUser.email);
    msg.textContent = "Te enviamos un enlace al correo para cambiar la contraseña.";
  } catch (error) {
    console.error("No se pudo enviar el enlace de contraseña:", error);
    msg.textContent = "No se pudo enviar el enlace: " + error.message;
  }
}

async function refreshMyTrips() {
  myTripsCache = await fetchMyTrips(currentUser);
  renderPanel();
}

async function handleUserTripSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const msg = form.querySelector("#userTripFormMessage");
  const d = new FormData(form);
  const destination = clean(d.get("destination"));
  const origin = clean(d.get("origin")) || DEFAULT_ORIGIN_AIRPORT;
  const intermediatePoint1 = clean(d.get("intermediatePoint1"));
  const intermediatePoint2 = clean(d.get("intermediatePoint2"));
  const startDate = d.get("startDate") || "";
  const endDate = d.get("endDate") || "";
  const existing = editingTripId ? myTripsCache.find(t => t.id === editingTripId) : null;

  if (!destination) {
    msg.textContent = "El destino es obligatorio.";
    return;
  }

  try {
    validateDates(startDate, endDate);
    const route = generarRutaSimulada(origin, destination, intermediatePoint1, intermediatePoint2);
    const baseSimulation = ensureTripSimulationFields({
      ...(existing || {}),
      origen: origin,
      destino: destination,
      destination,
      nombreViaje: existing?.nombreViaje || `Viaje a ${destination}`,
      estado: existing?.estado || existing?.status || "Planificado",
      status: existing?.status || existing?.estado || "Planificado",
      progreso: Number(existing?.progreso || 0),
      currentLocation: existing?.currentLocation || route[0],
      route,
      puntoIntermedio1: intermediatePoint1,
      puntoIntermedio2: intermediatePoint2
    });
    const suggestedBudget = estimateTripBudget({
      destination,
      travelers: Number(d.get("travelers")) || 1,
      startDate,
      endDate,
      experience: d.get("experience") || "Cultural"
    });
    const baseData = {
      ...baseSimulation,
      ...buildSimulationFirestorePatch(baseSimulation),
      destination,
      destino: destination,
      origen: origin,
      puntoIntermedio1: intermediatePoint1,
      puntoIntermedio2: intermediatePoint2,
      startDate,
      endDate,
      travelers: Number(d.get("travelers")) || 1,
      experience: d.get("experience") || "Cultural",
      lastLocation: clean(d.get("lastLocation")) || destination,
      mapQuery: clean(d.get("mapQuery")) || clean(d.get("lastLocation")) || destination,
      notes: clean(d.get("notes")),
      transport: Number(d.get("transport")) || suggestedBudget.transport,
      hotel: Number(d.get("hotel")) || suggestedBudget.hotel,
      food: Number(d.get("food")) || suggestedBudget.food,
      activitiesCost: Number(d.get("activitiesCost")) || suggestedBudget.activitiesCost,
      userId: currentUser.uid,
      userEmail: String(currentUser.email || "").toLowerCase(),
      updatedAt: serverTimestamp(),
      lastUpdate: new Date().toISOString()
    };

    msg.textContent = editingTripId ? "Guardando cambios..." : "Creando viaje...";

    if (editingTripId && existing) {
      await updateDoc(doc(db, "viajes", editingTripId), baseData);
      msg.textContent = "Datos básicos actualizados.";
      editingTripId = null;
    } else {
      const code = await makeUniqueCode(destination);
      const createdTrip = ensureTripSimulationFields({ ...baseData, codigoViaje: code, code, estado: "Planificado", status: "Planificado", progreso: 0, currentLocation: route[0] });
      const statusHistory = [crearEntradaHistorial("Planificado", 0, createdTrip.currentLocation, "Viaje creado por el usuario.")];
      await addDoc(collection(db, "viajes"), {
        ...createdTrip,
        ...buildSimulationFirestorePatch({ ...createdTrip, statusHistory }),
        code,
        codigoViaje: code,
        status: "Planificado",
        estado: "Planificado",
        progreso: 0,
        simulacionActiva: false,
        currentLocation: route[0],
        route,
        statusHistory,
        itinerary: [],
        createdBy: currentUser.uid,
        createdByRole: currentProfile?.rol || "usuario",
        createdAt: serverTimestamp()
      });
      msg.textContent = "Viaje creado. Código: " + code;
    }

    await refreshMyTrips();
  } catch (error) {
    console.error("Error guardando viaje de usuario:", error);
    msg.textContent = "No se pudo guardar el viaje: " + error.message;
  }
}

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
}

const obs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) e.target.classList.add("visible");
}), { threshold: 0.15 });
document.querySelectorAll(".reveal").forEach(el => obs.observe(el));

onAuthStateChanged(auth, async user => {
  if (!user) {
    unsubscribeMyTrips?.();
    unsubscribeMyTrips = null;
    userPanelContent.innerHTML = `
      <article class="card user-panel-card full-width">
        <span class="eyebrow">Sesión requerida</span>
        <h2>Inicia sesión para ver tu panel</h2>
        <p class="muted">Tus viajes asignados y datos de cuenta se muestran solo con sesión activa.</p>
        <div class="compact-actions"><a class="btn btn-primary" href="login.html">Ir a login</a><a class="btn btn-secondary" href="rastreo-viaje.html">Rastreo público</a></div>
      </article>
    `;
    return;
  }

  currentUser = user;
  currentProfile = { nombre: user.displayName || "usuario", email: user.email, rol: "usuario" };

  try {
    const directProfile = await getDoc(doc(db, "usuarios", user.uid));
    if (directProfile.exists()) currentProfile = { id: directProfile.id, ...directProfile.data() };
  } catch (error) {
    console.warn("No se pudo cargar el perfil del usuario:", error);
  }

  if ((currentProfile?.rol || "usuario") === "admin") {
    userPanelContent.innerHTML = `
      <article class="card user-panel-card full-width">
        <span class="eyebrow">Rol administrador</span>
        <h2>Redirigiendo al panel administrativo</h2>
        <p class="muted">Esta vista esta reservada para viajeros.</p>
      </article>
    `;
    setTimeout(() => { window.location.href = "admin-viajes.html#panel"; }, 700);
    return;
  }

  await refreshMyTrips();
  subscribeToMyTrips(user);

  const hash = window.location.hash;
  if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
});
