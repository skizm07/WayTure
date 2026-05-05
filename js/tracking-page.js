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
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const moneyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

const trackingForm = document.getElementById("trackingForm");
const trackingCode = document.getElementById("trackingCode");
const trackingMessage = document.getElementById("trackingMessage");
const trackingResult = document.getElementById("trackingResult");
const resultDestination = document.getElementById("resultDestination");
const resultCode = document.getElementById("resultCode");
const resultStatus = document.getElementById("resultStatus");
const resultLocation = document.getElementById("resultLocation");
const resultBudget = document.getElementById("resultBudget");
const resultStart = document.getElementById("resultStart");
const resultEnd = document.getElementById("resultEnd");
const resultTravelers = document.getElementById("resultTravelers");
const resultNotes = document.getElementById("resultNotes");
const resultMapCaption = document.getElementById("resultMapCaption");
const trackingMap = document.getElementById("trackingMap");
const progressTrack = document.getElementById("progressTrack");
const publicItinerary = document.getElementById("publicItinerary");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let currentProfile = null;
let myTripsCache = [];
let editingTripId = null;

const statusOrder = ["Por planear", "En organizacion", "Reservado", "En curso", "Finalizado"];

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

function budget(t) {
  return Number(t.transport || 0) + Number(t.hotel || 0) + Number(t.food || 0) + Number(t.activitiesCost || 0);
}

function mapUrl(q) {
  return "https://www.google.com/maps?q=" + encodeURIComponent(q || "Europa turismo") + "&output=embed";
}

function fmtDate(d) {
  if (!d) return "Sin fecha";
  const date = new Date(d + "T00:00:00");
  return Number.isNaN(date.getTime()) ? d : date.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

function statusClass(s) {
  s = String(s || "").toLowerCase();
  if (s.includes("organ")) return "organizacion";
  if (s.includes("reserv")) return "reservado";
  if (s.includes("curso")) return "curso";
  if (s.includes("final")) return "finalizado";
  return "planear";
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

function renderProgress(status) {
  const i = Math.max(0, statusOrder.indexOf(status));
  progressTrack.innerHTML = statusOrder
    .map((step, index) => `<div class="step-item ${index <= i ? "done" : ""}">${esc(step)}</div>`)
    .join("");
}

function renderItinerary(t) {
  const items = [...(t.itinerary || [])].sort((a, b) => String((a.date || "") + (a.time || "")).localeCompare(String((b.date || "") + (b.time || ""))));
  if (!items.length) {
    publicItinerary.innerHTML = '<div class="empty-state">Este viaje aún no tiene actividades registradas.</div>';
    return;
  }
  publicItinerary.innerHTML = items.map(a => `
    <article class="history-card">
      <strong>${esc(a.time || "--:--")} - ${esc(a.place)}</strong>
      <p class="muted">${fmtDate(a.date)} · <span class="category-pill">${esc(a.category)}</span><br>${esc(a.description || "Sin descripción.")}</p>
    </article>
  `).join("");
}

function renderTrip(t) {
  trackingResult.classList.add("is-visible");
  resultDestination.textContent = t.destination || "Destino";
  resultCode.textContent = t.code || "Sin código";
  resultStatus.innerHTML = `<span class="status-pill ${statusClass(t.status)}">${esc(t.status || "Por planear")}</span>`;
  resultLocation.textContent = t.lastLocation || t.destination || "Sin ubicación";
  resultBudget.textContent = moneyFormatter.format(budget(t));
  resultStart.textContent = fmtDate(t.startDate);
  resultEnd.textContent = fmtDate(t.endDate);
  resultTravelers.textContent = (t.travelers || 1) + " viajero(s)";
  resultNotes.textContent = t.notes || "Sin notas registradas.";
  resultMapCaption.textContent = "Última ubicación: " + (t.lastLocation || t.destination || "Sin ubicación");
  trackingMap.src = mapUrl(t.mapQuery || t.lastLocation || t.destination);
  renderProgress(t.status || "Por planear");
  renderItinerary(t);
}

async function findTripByCode(code) {
  const c = clean(code).toUpperCase();
  if (!c) return null;
  const q = query(collection(db, "viajes"), where("code", "==", c));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

async function searchTracking(code) {
  trackingMessage.textContent = "Consultando Firebase...";
  const t = await findTripByCode(code);
  if (!t) {
    trackingResult.classList.remove("is-visible");
    trackingMessage.textContent = "No se encontró ningún viaje con ese código en Firebase.";
    return;
  }
  trackingMessage.textContent = "";
  renderTrip(t);
}

function insertUserPanel() {
  let box = document.getElementById("userTripsPanel");
  if (box) return box;

  box = document.createElement("div");
  box.id = "userTripsPanel";
  box.className = "history-list user-trips-panel";
  trackingForm.parentNode.insertBefore(box, trackingForm.nextSibling);
  return box;
}

function renderLoginHint() {
  const box = insertUserPanel();
  box.innerHTML = `
    <div class="history-card">
      <strong>Panel de usuario</strong>
      <p class="muted">Inicia sesión con cualquier rol para crear viajes propios, ver tus viajes asignados y editar tus datos básicos.</p>
      <div class="compact-actions compact-actions-spaced">
        <a class="small-btn" href="login.html">Iniciar sesión</a>
        <a class="small-btn" href="registro.html">Registrarme</a>
      </div>
    </div>
  `;
}

async function fetchMyTrips(user) {
  const byUid = query(collection(db, "viajes"), where("userId", "==", user.uid));
  const uidSnap = await getDocs(byUid);
  const map = new Map();
  uidSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));

  if (user.email) {
    const byEmail = query(collection(db, "viajes"), where("userEmail", "==", user.email.toLowerCase()));
    const emailSnap = await getDocs(byEmail);
    emailSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  }

  return Array.from(map.values()).sort((a, b) => String(b.createdAt?.seconds || b.lastUpdate || "").localeCompare(String(a.createdAt?.seconds || a.lastUpdate || "")));
}

function tripFormTemplate(t = {}) {
  const isEdit = Boolean(t.id);
  return `
    <form id="userTripForm" class="stack history-card user-trip-form-card">
      <strong>${isEdit ? "Editar datos básicos de mi viaje" : "Crear mi propio viaje"}</strong>
      <p class="muted">${isEdit ? "Puedes modificar los datos básicos del viaje. El estado operativo lo puede ajustar el administrador." : "Este viaje se guardará en Firebase y quedará asignado automáticamente a tu correo."}</p>

      <div>
        <label for="userDestination">Destino</label>
        <input id="userDestination" name="destination" type="text" required value="${esc(t.destination || "")}" placeholder="Ej. Cartagena, Colombia">
      </div>

      <div class="user-form-grid">
        <div>
          <label for="userStartDate">Fecha de salida</label>
          <input id="userStartDate" name="startDate" type="date" value="${esc(t.startDate || "")}">
        </div>
        <div>
          <label for="userEndDate">Fecha de regreso</label>
          <input id="userEndDate" name="endDate" type="date" value="${esc(t.endDate || "")}">
        </div>
      </div>

      <div class="user-form-grid">
        <div>
          <label for="userTravelers">Viajeros</label>
          <input id="userTravelers" name="travelers" type="number" min="1" value="${esc(t.travelers || 1)}">
        </div>
        <div>
          <label for="userExperience">Tipo de experiencia</label>
          <select id="userExperience" name="experience">
            ${["Cultural", "Aventura", "Romantico", "Gastronomico", "Descanso", "Negocios", "Familiar"].map(x => `<option ${t.experience === x ? "selected" : ""}>${x}</option>`).join("")}
          </select>
        </div>
      </div>

      <div>
        <label for="userLastLocation">Última ubicación / lugar principal</label>
        <input id="userLastLocation" name="lastLocation" type="text" value="${esc(t.lastLocation || "")}" placeholder="Ej. Centro histórico, Cartagena">
      </div>

      <div>
        <label for="userMapQuery">Búsqueda para el mapa</label>
        <input id="userMapQuery" name="mapQuery" type="text" value="${esc(t.mapQuery || "")}" placeholder="Ej. Cartagena Colombia">
      </div>

      <div class="user-budget-grid">
        <div><label>Transporte</label><input name="transport" type="number" min="0" value="${esc(t.transport || 0)}"></div>
        <div><label>Hospedaje</label><input name="hotel" type="number" min="0" value="${esc(t.hotel || 0)}"></div>
        <div><label>Comida</label><input name="food" type="number" min="0" value="${esc(t.food || 0)}"></div>
        <div><label>Actividades</label><input name="activitiesCost" type="number" min="0" value="${esc(t.activitiesCost || 0)}"></div>
      </div>

      <div>
        <label for="userNotes">Notas personales</label>
        <textarea id="userNotes" name="notes" placeholder="Ideas, restaurantes, lugares pendientes...">${esc(t.notes || "")}</textarea>
      </div>

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
  const rol = currentProfile?.rol || "usuario";

  return `
    <form id="profileForm" class="stack history-card account-form-card">
      <div>
        <strong id="perfil">Gestionar cuenta</strong>
        <p class="muted">Actualiza tus datos visibles y solicita un enlace para cambiar contraseña cuando lo necesites.</p>
      </div>

      <div class="user-form-grid">
        <div>
          <label for="profileName">Nombre</label>
          <input id="profileName" name="nombre" type="text" value="${esc(nombre)}" required>
        </div>
        <div>
          <label for="profileAlias">Alias</label>
          <input id="profileAlias" name="alias" type="text" value="${esc(alias)}" placeholder="Ej. Viajero frecuente">
        </div>
      </div>

      <div class="user-form-grid">
        <div>
          <label for="profileEmail">Correo de inicio de sesión</label>
          <input id="profileEmail" type="email" value="${esc(email)}" readonly>
        </div>
        <div>
          <label for="profileRole">Rol</label>
          <input id="profileRole" type="text" value="${esc(rol)}" readonly>
        </div>
      </div>

      <div class="compact-actions">
        <button class="btn btn-primary" type="submit">Guardar cuenta</button>
        <button class="btn btn-secondary" type="button" id="resetPasswordBtn">Cambiar contraseña</button>
      </div>
      <p class="success" id="profileMessage"></p>
    </form>
  `;
}

function renderMyTripsPanel() {
  const box = insertUserPanel();
  const userName = currentProfile?.nombre || currentUser?.displayName || currentUser?.email || "usuario";
  const userRole = currentProfile?.rol || "usuario";
  const adminShortcut = userRole === "admin" ? '<a class="small-btn" href="admin-viajes.html">Abrir panel admin</a>' : "";

  const tripsMarkup = myTripsCache.length ? myTripsCache.map(t => `
    <article class="history-card">
      <strong>${esc(t.destination || "Destino")} · ${esc(t.code)}</strong>
      <p class="muted">Estado: ${esc(t.status || "Por planear")}<br>Salida: ${fmtDate(t.startDate)} · Regreso: ${fmtDate(t.endDate)}<br>Presupuesto: ${moneyFormatter.format(budget(t))}</p>
      <div class="compact-actions compact-actions-spaced">
        <button class="small-btn" data-action="view-my-trip" data-code="${esc(t.code)}">Ver rastreo</button>
        <button class="small-btn" data-action="edit-my-trip" data-id="${esc(t.id)}">Editar datos básicos</button>
      </div>
    </article>
  `).join("") : `
    <div class="history-card">
      <strong>Mis viajes</strong>
      <p class="muted">Todavía no tienes viajes asignados. Puedes crear tu primer viaje aquí o consultar uno por código.</p>
    </div>
  `;

  const editingTrip = editingTripId ? myTripsCache.find(t => t.id === editingTripId) : null;

  box.innerHTML = `
    <div class="history-card">
      <strong>Panel de usuario</strong>
      <p class="muted">Sesión activa: ${esc(userName)} · ${esc(currentUser.email || "")} · Rol: ${esc(userRole)}</p>
      ${adminShortcut ? `<div class="compact-actions compact-actions-spaced">${adminShortcut}</div>` : ""}
    </div>
    ${profileFormTemplate()}
    ${tripFormTemplate(editingTrip || {})}
    <h3 class="user-trips-title">Mis viajes asignados</h3>
    ${tripsMarkup}
  `;

  const userTripForm = box.querySelector("#userTripForm");
  userTripForm.addEventListener("submit", handleUserTripSubmit);

  const profileForm = box.querySelector("#profileForm");
  profileForm.addEventListener("submit", handleProfileSubmit);

  const resetPasswordBtn = box.querySelector("#resetPasswordBtn");
  resetPasswordBtn.addEventListener("click", handlePasswordReset);

  const cancelBtn = box.querySelector("#cancelUserEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      editingTripId = null;
      renderMyTripsPanel();
    });
  }

  box.querySelectorAll("button[data-action='view-my-trip']").forEach(btn => {
    btn.addEventListener("click", () => {
      trackingCode.value = btn.dataset.code;
      searchTracking(btn.dataset.code);
    });
  });

  box.querySelectorAll("button[data-action='edit-my-trip']").forEach(btn => {
    btn.addEventListener("click", () => {
      editingTripId = btn.dataset.id;
      renderMyTripsPanel();
      document.getElementById("userTripForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function handleProfileSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;

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
  if (!currentUser) return;
  myTripsCache = await fetchMyTrips(currentUser);
  renderMyTripsPanel();
}

async function handleUserTripSubmit(event) {
  event.preventDefault();
  if (!currentUser) return;

  const form = event.currentTarget;
  const msg = form.querySelector("#userTripFormMessage");
  const d = new FormData(form);
  const destination = clean(d.get("destination"));
  const existing = editingTripId ? myTripsCache.find(t => t.id === editingTripId) : null;

  const baseData = {
    destination,
    startDate: d.get("startDate") || "",
    endDate: d.get("endDate") || "",
    travelers: Number(d.get("travelers")) || 1,
    experience: d.get("experience") || "Cultural",
    lastLocation: clean(d.get("lastLocation")) || destination,
    mapQuery: clean(d.get("mapQuery")) || clean(d.get("lastLocation")) || destination,
    notes: clean(d.get("notes")),
    transport: Number(d.get("transport")) || 0,
    hotel: Number(d.get("hotel")) || 0,
    food: Number(d.get("food")) || 0,
    activitiesCost: Number(d.get("activitiesCost")) || 0,
    userId: currentUser.uid,
    userEmail: String(currentUser.email || "").toLowerCase(),
    updatedAt: serverTimestamp(),
    lastUpdate: new Date().toISOString()
  };

  try {
    msg.textContent = editingTripId ? "Guardando cambios..." : "Creando viaje...";

    if (editingTripId && existing) {
      await updateDoc(doc(db, "viajes", editingTripId), baseData);
      msg.textContent = "Datos básicos actualizados en Firebase.";
      trackingCode.value = existing.code;
      await searchTracking(existing.code);
      editingTripId = null;
    } else {
      const code = makeCode(destination);
      await addDoc(collection(db, "viajes"), {
        ...baseData,
        code,
        status: "Por planear",
        itinerary: [],
        createdBy: currentUser.uid,
        createdByRole: currentProfile?.rol || "usuario",
        createdAt: serverTimestamp()
      });
      msg.textContent = "Viaje creado y asignado a tu cuenta. Código: " + code;
      trackingCode.value = code;
      await searchTracking(code);
    }

    await refreshMyTrips();
  } catch (error) {
    console.error("Error guardando viaje de usuario:", error);
    msg.textContent = "No se pudo guardar el viaje: " + error.message;
  }
}

trackingForm.addEventListener("submit", e => {
  e.preventDefault();
  searchTracking(trackingCode.value);
});

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

const params = new URLSearchParams(location.search);
const initial = params.get("codigo");
if (initial) {
  trackingCode.value = initial;
  searchTracking(initial);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentUser = null;
    currentProfile = null;
    renderLoginHint();
    return;
  }

  currentUser = user;
  currentProfile = { nombre: user.displayName || "usuario", email: user.email, rol: "usuario" };

  try {
    const directProfile = await getDoc(doc(db, "usuarios", user.uid));
    if (directProfile.exists()) {
      currentProfile = { id: directProfile.id, ...directProfile.data() };
    } else {
      const profileQ = query(collection(db, "usuarios"), where("uid", "==", user.uid));
      const profileSnap = await getDocs(profileQ);
      if (!profileSnap.empty) currentProfile = { id: profileSnap.docs[0].id, ...profileSnap.docs[0].data() };
    }
  } catch (error) {
    console.warn("No se pudo cargar el perfil del usuario:", error);
  }

  await refreshMyTrips();

  if (params.get("perfil") === "1") {
    document.getElementById("profileForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (params.get("mis") === "1") {
    document.getElementById("userTripsPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
});
