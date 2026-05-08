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

const userPanelContent = document.getElementById("userPanelContent");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let currentProfile = null;
let myTripsCache = [];
let editingTripId = null;

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
  const raw = normalizeForSearch(status);
  if (raw.includes("organ")) return "En organización";
  if (raw.includes("reserv")) return "Reservado";
  if (raw.includes("curso")) return "En curso";
  if (raw.includes("final")) return "Finalizado";
  if (raw.includes("reprogram") || raw.includes("incid") || raw.includes("cambio")) return "Reprogramado";
  return "Por planear";
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
  const snap = await getDocs(query(collection(db, "viajes"), where("code", "==", code)));
  return !snap.empty;
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

function validateDates(startDate, endDate) {
  if (startDate && endDate && endDate < startDate) {
    throw new Error("La fecha de regreso no puede ser anterior a la fecha de salida.");
  }
}

async function fetchMyTrips(user) {
  const byUid = query(collection(db, "viajes"), where("userId", "==", user.uid));
  const uidSnap = await getDocs(byUid);
  const map = new Map();
  uidSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data(), status: normalizeStatus(d.data().status) }));

  if (user.email) {
    const byEmail = query(collection(db, "viajes"), where("userEmail", "==", user.email.toLowerCase()));
    const emailSnap = await getDocs(byEmail);
    emailSnap.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data(), status: normalizeStatus(d.data().status) }));
  }

  return Array.from(map.values()).sort((a, b) => String(b.createdAt?.seconds || b.lastUpdate || "").localeCompare(String(a.createdAt?.seconds || a.lastUpdate || "")));
}

function tripFormTemplate(t = {}) {
  const isEdit = Boolean(t.id);
  return `
    <form id="userTripForm" class="stack history-card user-trip-form-card">
      <strong>${isEdit ? "Editar viaje" : "Crear viaje"}</strong>
      <p class="muted">${isEdit ? "Actualiza los datos básicos de este viaje asignado." : "Este viaje quedará asignado a tu correo."}</p>
      <div>
        <label for="userDestination">Destino</label>
        <input id="userDestination" name="destination" type="text" required value="${esc(t.destination || "")}" placeholder="Ej. Cartagena, Colombia">
      </div>
      <div class="user-form-grid">
        <div><label for="userStartDate">Fecha de salida</label><input id="userStartDate" name="startDate" type="date" value="${esc(t.startDate || "")}"></div>
        <div><label for="userEndDate">Fecha de regreso</label><input id="userEndDate" name="endDate" type="date" value="${esc(t.endDate || "")}"></div>
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

function renderPanel() {
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
  const startDate = d.get("startDate") || "";
  const endDate = d.get("endDate") || "";
  const existing = editingTripId ? myTripsCache.find(t => t.id === editingTripId) : null;

  if (!destination) {
    msg.textContent = "El destino es obligatorio.";
    return;
  }

  try {
    validateDates(startDate, endDate);
    const baseData = {
      destination,
      startDate,
      endDate,
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

    msg.textContent = editingTripId ? "Guardando cambios..." : "Creando viaje...";

    if (editingTripId && existing) {
      await updateDoc(doc(db, "viajes", editingTripId), baseData);
      msg.textContent = "Datos básicos actualizados.";
      editingTripId = null;
    } else {
      const code = await makeUniqueCode(destination);
      await addDoc(collection(db, "viajes"), {
        ...baseData,
        code,
        status: "Por planear",
        statusHistory: [{
          id: String(Date.now()),
          previousStatus: "Sin estado previo",
          newStatus: "Por planear",
          changedAt: new Date().toISOString(),
          location: baseData.lastLocation,
          comment: "Viaje creado por el usuario."
        }],
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

  await refreshMyTrips();

  const hash = window.location.hash;
  if (hash) document.querySelector(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
});
