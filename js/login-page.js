import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const loginForm = document.getElementById("loginForm");
const loginName = document.getElementById("loginName");
const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const welcomeBox = document.getElementById("welcomeBox");

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  welcomeBox.textContent = "Iniciando sesión...";
  welcomeBox.classList.add("show");
  try{
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;
    const ref = doc(db, "usuarios", user.uid);
    const snap = await getDoc(ref);
    let nombre = user.displayName || loginName.value.trim() || "viajero";
    let rol = "usuario";
    if(snap.exists()){
      const data = snap.data(); nombre = data.nombre || nombre; rol = data.rol || "usuario";
    }else{
      await setDoc(ref, {uid:user.uid, nombre, alias:"", email:user.email, rol:"usuario", creadoEn:serverTimestamp()});
    }
    localStorage.setItem("wayture_logged_user", nombre);
    localStorage.setItem("wayture_user_role", rol);
    welcomeBox.textContent = `Bienvenido, ${nombre}. Rol: ${rol}. Redirigiendo a tu panel de usuario...`;
    setTimeout(() => { window.location.href = "rastreo-viaje.html?mis=1"; }, 900);
  }catch(error){
    console.error(error);
    if(error.code === "auth/invalid-credential") welcomeBox.textContent = "Correo o contraseña incorrectos.";
    else if(error.code === "auth/invalid-email") welcomeBox.textContent = "El correo no es válido.";
    else welcomeBox.textContent = "Error: " + error.message;
  }
});
