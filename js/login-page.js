import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const welcomeBox = document.getElementById("welcomeBox");

async function resolveLoginEmail(identifier) {
  const value = identifier.trim().toLowerCase();
  if (!value) return "";
  if (value.includes("@")) return value;

  const snap = await getDocs(collection(db, "usuarios"));
  const match = snap.docs.find(docSnap => {
    const data = docSnap.data() || {};
    return [data.alias, data.nombre, data.email].some(field => String(field || "").trim().toLowerCase() === value);
  });
  return match?.data()?.email?.toLowerCase() || "";
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const loginValue = loginEmail.value.trim();
  const password = loginPassword.value;
  welcomeBox.textContent = "Iniciando sesión...";
  welcomeBox.classList.add("show");
  try{
    const email = await resolveLoginEmail(loginValue);
    if (!email) {
      welcomeBox.textContent = "No encontramos ese usuario o correo en WayTure.";
      return;
    }
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);
    let nombre = user.displayName || "viajero";
    let rol = "usuario";
    if(snap.exists()){
      const data = snap.data(); nombre = data.nombre || nombre; rol = data.rol || "usuario";
    }else{
      await setDoc(ref, {uid:user.uid, nombre, alias:"", email:user.email, rol:"usuario", creadoEn:serverTimestamp()});
    }
    localStorage.setItem("wayture_logged_user", nombre);
    localStorage.setItem("wayture_user_role", rol);
    const isAdmin = rol === "admin";
    welcomeBox.textContent = `Bienvenido, ${nombre}. Rol: ${rol}. Redirigiendo...`;
    setTimeout(() => { window.location.href = isAdmin ? "admin-viajes.html#panel" : "panel-usuario.html#mis-viajes"; }, 900);
  }catch(error){
    console.error(error);
    if(error.code === "auth/invalid-credential") welcomeBox.textContent = "Correo o contraseña incorrectos.";
    else if(error.code === "auth/invalid-email") welcomeBox.textContent = "El correo no es válido.";
    else welcomeBox.textContent = "Error: " + error.message;
  }
});
