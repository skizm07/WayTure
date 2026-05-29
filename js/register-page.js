import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const registerForm = document.getElementById("registerForm");
const registerName = document.getElementById("registerName");
const registerAlias = document.getElementById("registerAlias");
const registerEmail = document.getElementById("registerEmail");
const registerRole = document.getElementById("registerRole");
const registerPassword = document.getElementById("registerPassword");
const registerPasswordConfirm = document.getElementById("registerPasswordConfirm");
const registerResponse = document.getElementById("registerResponse");

async function mirrorUserToLocalApi(profile) {
  if (!["localhost", "127.0.0.1"].includes(window.location.hostname)) return;
  try {
    await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile)
    });
  } catch (error) {
    console.warn("La cuenta se creó en Firebase, pero no se pudo reflejar en la API local:", error);
  }
}

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  const nombre = registerName.value.trim();
  const alias = registerAlias.value.trim();
  const email = registerEmail.value.trim().toLowerCase();
  const rol = "usuario";
  const password = registerPassword.value;
  const confirm = registerPasswordConfirm.value;

  registerResponse.textContent = "Creando cuenta en Firebase...";
  registerResponse.classList.add("show");

  if(password !== confirm){ registerResponse.textContent = "Las contraseñas no coinciden."; return; }
  if(password.length < 6){ registerResponse.textContent = "La contraseña debe tener mínimo 6 caracteres."; return; }

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });
    const profile = { uid: cred.user.uid, nombre, alias, email, rol };
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      ...profile,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp()
    }, { merge: true });
    await mirrorUserToLocalApi(profile);
    localStorage.setItem("wayture_logged_user", nombre);
    localStorage.setItem("wayture_user_role", rol);
    registerResponse.textContent = "Cuenta de viajero creada. Redirigiendo a tu panel...";
    setTimeout(() => { window.location.href = "panel-usuario.html#mis-viajes"; }, 900);
  }catch(error){
    console.error(error);
    if(error.code === "auth/email-already-in-use") registerResponse.textContent = "Ese correo ya está registrado.";
    else if(error.code === "auth/invalid-email") registerResponse.textContent = "El correo no es válido.";
    else if(error.code === "auth/weak-password") registerResponse.textContent = "La contraseña debe tener mínimo 6 caracteres.";
    else registerResponse.textContent = "Error: " + error.message;
  }
});
