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

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  const nombre = registerName.value.trim();
  const alias = registerAlias.value.trim();
  const email = registerEmail.value.trim();
  const rol = registerRole ? registerRole.value : "usuario";
  const password = registerPassword.value;
  const confirm = registerPasswordConfirm.value;

  registerResponse.textContent = "Creando cuenta en Firebase...";
  registerResponse.classList.add("show");

  if(password !== confirm){ registerResponse.textContent = "Las contraseñas no coinciden."; return; }
  if(password.length < 6){ registerResponse.textContent = "La contraseña debe tener mínimo 6 caracteres."; return; }

  try{
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nombre });
    await setDoc(doc(db, "usuarios", cred.user.uid), {
      uid: cred.user.uid, nombre, alias, email, rol, creadoEn: serverTimestamp()
    });
    localStorage.setItem("wayture_logged_user", nombre);
    localStorage.setItem("wayture_user_role", rol);
    registerResponse.textContent = `Cuenta creada como ${rol}. Redirigiendo a tu panel de usuario...`;
    setTimeout(() => { window.location.href = "panel-usuario.html#mis-viajes"; }, 900);
  }catch(error){
    console.error(error);
    if(error.code === "auth/email-already-in-use") registerResponse.textContent = "Ese correo ya está registrado.";
    else if(error.code === "auth/invalid-email") registerResponse.textContent = "El correo no es válido.";
    else if(error.code === "auth/weak-password") registerResponse.textContent = "La contraseña debe tener mínimo 6 caracteres.";
    else registerResponse.textContent = "Error: " + error.message;
  }
});
