import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA0aMZzRDGdRRU4RIR_r8IG26frpFG6KuE",
  authDomain: "waytrue-38d39.firebaseapp.com",
  projectId: "waytrue-38d39",
  storageBucket: "waytrue-38d39.firebasestorage.app",
  messagingSenderId: "585717570483",
  appId: "1:585717570483:web:9a8b244d9dd3ff4d7449c6",
  measurementId: "G-VJ4WRPL6FG"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
