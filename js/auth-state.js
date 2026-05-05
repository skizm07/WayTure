import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const adminLinks = document.querySelectorAll("[data-admin-link]");
const loginLinks = document.querySelectorAll("[data-login-link]");
const registerLinks = document.querySelectorAll("[data-register-link]");
const logoutButtons = document.querySelectorAll("[data-logout-button]");
const userLinks = document.querySelectorAll("[data-user-link]");
const greetingBoxes = document.querySelectorAll("[data-user-greeting]");
const userMenus = document.querySelectorAll("[data-user-menu]");
const userMenuButtons = document.querySelectorAll("[data-user-menu-button]");
const userMenuDropdowns = document.querySelectorAll("[data-user-menu-dropdown]");
const userNames = document.querySelectorAll("[data-user-name]");
const userInitials = document.querySelectorAll("[data-user-initials]");
const publicAuthLinks = document.querySelectorAll("[data-auth-public-link]");

function hide(elements){ elements.forEach(el => { el.hidden = true; el.style.display = "none"; }); }
function show(elements){ elements.forEach(el => { el.hidden = false; el.style.display = ""; }); }
function initials(nombre){
  return String(nombre || "U")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "U";
}
function closeUserMenus(){
  userMenuDropdowns.forEach(menu => menu.classList.remove("is-open"));
  userMenuButtons.forEach(btn => btn.setAttribute("aria-expanded", "false"));
}

function guestView(){
  closeUserMenus();
  hide(adminLinks); hide(logoutButtons); hide(userLinks); hide(userMenus);
  show(loginLinks); show(registerLinks); show(publicAuthLinks);
  greetingBoxes.forEach(box => { box.textContent = ""; box.classList.remove("show"); });
  userNames.forEach(box => { box.textContent = "Usuario"; });
  userInitials.forEach(box => { box.textContent = "U"; });
  localStorage.removeItem("wayture_logged_user");
  localStorage.removeItem("wayture_user_role");
}

function loggedView(nombre, rol){
  hide(loginLinks); hide(registerLinks); hide(publicAuthLinks);
  show(logoutButtons); show(userLinks); show(userMenus);
  rol === "admin" ? show(adminLinks) : hide(adminLinks);
  userNames.forEach(box => { box.textContent = nombre; });
  userInitials.forEach(box => { box.textContent = initials(nombre); });
  greetingBoxes.forEach(box => {
    box.textContent = `Bienvenido, ${nombre}. Rol activo: ${rol}.`;
    box.classList.add("show");
  });
}

guestView();

onAuthStateChanged(auth, async user => {
  if(!user){ guestView(); return; }
  let nombre = user.displayName || "viajero";
  let rol = "usuario";
  try{
    const snap = await getDoc(doc(db, "usuarios", user.uid));
    if(snap.exists()){
      const data = snap.data();
      nombre = data.nombre || nombre;
      rol = data.rol || "usuario";
    }
  }catch(error){ console.error("No se pudo leer el perfil:", error); }
  localStorage.setItem("wayture_logged_user", nombre);
  localStorage.setItem("wayture_user_role", rol);
  loggedView(nombre, rol);
});

logoutButtons.forEach(btn => btn.addEventListener("click", async () => {
  await signOut(auth);
  guestView();
  window.location.href = "index.html";
}));

userMenuButtons.forEach(btn => btn.addEventListener("click", event => {
  event.stopPropagation();
  const menu = btn.closest("[data-user-menu]")?.querySelector("[data-user-menu-dropdown]");
  const isOpen = menu?.classList.toggle("is-open");
  btn.setAttribute("aria-expanded", String(Boolean(isOpen)));
}));

document.addEventListener("click", event => {
  if (!event.target.closest("[data-user-menu]")) closeUserMenus();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeUserMenus();
});
