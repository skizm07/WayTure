import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, sendPasswordResetEmail, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const accountContent = document.getElementById("accountContent");
const mainNav = document.getElementById("mainNav");
const menuToggle = document.getElementById("menuToggle");

let currentUser = null;
let currentProfile = null;

function esc(text) {
  return String(text ?? "").replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c]));
}

function clean(text) {
  return String(text || "").trim();
}

function initials(nombre) {
  return String(nombre || "U").trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || "").join("") || "U";
}

function syncUserMenu(nombre) {
  document.querySelectorAll("[data-user-name]").forEach(box => { box.textContent = nombre; });
  document.querySelectorAll("[data-user-initials]").forEach(box => { box.textContent = initials(nombre); });
}

function renderAccount() {
  const nombre = currentProfile?.nombre || currentUser?.displayName || "";
  const alias = currentProfile?.alias || "";
  const email = currentUser?.email || currentProfile?.email || "";
  const rol = currentProfile?.rol || "usuario";

  accountContent.innerHTML = `
    <article class="card user-panel-card full-width">
      <span class="eyebrow">Mi perfil</span>
      <h2>Datos de cuenta</h2>
      <p class="muted">Estos datos se mantienen separados del panel de viajes para que el dashboard quede enfocado en operacion.</p>
      <form id="profileForm" class="stack history-card account-form-card">
        <div class="user-form-grid">
          <div><label for="profileName">Nombre</label><input id="profileName" name="nombre" type="text" value="${esc(nombre)}" required></div>
          <div><label for="profileAlias">Alias</label><input id="profileAlias" name="alias" type="text" value="${esc(alias)}" placeholder="Ej. Viajero frecuente"></div>
        </div>
        <div class="user-form-grid">
          <div><label for="profileEmail">Correo de inicio de sesion</label><input id="profileEmail" type="email" value="${esc(email)}" readonly></div>
          <div><label for="profileRole">Rol activo</label><input id="profileRole" type="text" value="${esc(rol)}" readonly></div>
        </div>
        <div class="compact-actions">
          <button class="btn btn-primary" type="submit">Guardar cuenta</button>
          <button class="btn btn-secondary" type="button" id="resetPasswordBtn">Cambiar contrasena</button>
        </div>
        <p class="success" id="profileMessage"></p>
      </form>
    </article>
  `;

  accountContent.querySelector("#profileForm").addEventListener("submit", handleProfileSubmit);
  accountContent.querySelector("#resetPasswordBtn").addEventListener("click", handlePasswordReset);
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
    msg.textContent = "Tu cuenta no tiene un correo disponible para recuperar contrasena.";
    return;
  }
  try {
    msg.textContent = "Enviando enlace de cambio de contrasena...";
    await sendPasswordResetEmail(auth, currentUser.email);
    msg.textContent = "Te enviamos un enlace al correo para cambiar la contrasena.";
  } catch (error) {
    console.error("No se pudo enviar el enlace de contrasena:", error);
    msg.textContent = "No se pudo enviar el enlace: " + error.message;
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
    accountContent.innerHTML = `
      <article class="card user-panel-card full-width">
        <span class="eyebrow">Sesion requerida</span>
        <h2>Inicia sesion para ver tu cuenta</h2>
        <p class="muted">Tus datos de cuenta se muestran solo con sesion activa.</p>
        <div class="compact-actions"><a class="btn btn-primary" href="login.html">Ir a login</a><a class="btn btn-secondary" href="rastreo-viaje.html">Rastreo publico</a></div>
      </article>
    `;
    return;
  }

  currentUser = user;
  currentProfile = { nombre: user.displayName || "usuario", email: user.email, rol: "usuario" };
  try {
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if (snap.exists()) currentProfile = { id: snap.id, ...snap.data() };
  } catch (error) {
    console.warn("No se pudo cargar el perfil:", error);
  }
  renderAccount();
});
