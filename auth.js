// =================================================================
// INICIO DE SESIÓN, PERFILES Y DATOS DE LA BODA (Firebase)
//
// Todas las páginas cargan este archivo. Se encarga de:
//  - conectar con Firebase (si firebase-config.js está rellenado),
//  - añadir "Iniciar sesión" / tu nombre de usuario (y "Novedades") al menú,
//  - ofrecer a las demás páginas funciones para perfiles, confirmaciones y puntuaciones.
//
// La seguridad de verdad (quién puede leer o escribir qué) la imponen las reglas de
// Firestore, no este archivo: aunque alguien manipule la página, el servidor decide.
// =================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, signOut, deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, collectionGroup,
  getDocs, addDoc, query, orderBy, serverTimestamp, runTransaction, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const configured = !!firebaseConfig.apiKey && firebaseConfig.apiKey !== "PEGA_AQUI";

let auth = null, db = null;
if (configured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}
export { auth, db };
// Las páginas de administración y novedades usan estas funciones de Firestore directamente.
export { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, collectionGroup, getDocs, addDoc, query, orderBy, serverTimestamp, writeBatch };

// ---------- estado de la sesión ----------
// user: usuario de Firebase (o null) · profile: datos de users/{uid} (o null)
// needsVerification: cuenta con email+contraseña cuyo email aún no está verificado
// needsProfile: ha entrado pero todavía no ha elegido nombre de usuario
// approved: perfil aprobado (por código de invitación o por vosotros)
// isAdmin: puede abrir admin.html
const state = { ready: false, user: null, profile: null, needsVerification: false, needsProfile: false, approved: false, isAdmin: false };
const listeners = new Set();

export function getSession() { return state; }
export function onSession(cb) {
  listeners.add(cb);
  if (state.ready) cb(state);
  return () => listeners.delete(cb);
}
function emit() { listeners.forEach(cb => { try { cb(state); } catch (e) { console.error(e); } }); renderNav(); }

async function loadSession(user) {
  state.user = user;
  state.profile = null;
  state.isAdmin = false;
  state.needsVerification = !!user && !user.emailVerified;
  state.needsProfile = false;
  if (user && user.emailVerified) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      state.profile = snap.exists() ? snap.data() : null;
      state.needsProfile = !snap.exists();
    } catch (e) { console.error("No se pudo leer el perfil", e); }
    // admin/check no existe: las reglas solo dejan "leerlo" a los administradores,
    // así que si no da error de permisos, eres administrador.
    try { await getDoc(doc(db, "admin", "check")); state.isAdmin = true; } catch (e) { state.isAdmin = false; }
  }
  state.approved = state.profile?.status === "approved";
  state.ready = true;
  emit();
}

if (configured) {
  onAuthStateChanged(auth, user => { loadSession(user); });
} else {
  state.ready = true;
}

// Vuelve a leer el usuario y el perfil (por ejemplo, tras verificar el email).
export async function refreshSession() {
  if (!auth?.currentUser) return loadSession(null);
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true);
  return loadSession(auth.currentUser);
}

// ---------- menú: "Iniciar sesión" / usuario y "Novedades" ----------
function renderNav() {
  const ul = document.getElementById("navlinks");
  if (!ul || !configured) return;
  const here = location.pathname.split("/").pop() || "index.html";

  let news = document.getElementById("nav-news");
  if (state.approved) {
    if (!news) {
      news = document.createElement("li");
      news.id = "nav-news";
      news.innerHTML = '<a href="novedades.html">Novedades</a>';
      ul.appendChild(news);
    }
    if (here === "novedades.html") news.querySelector("a").setAttribute("aria-current", "page");
  } else if (news) news.remove();

  let acc = document.getElementById("nav-account");
  if (!acc) {
    acc = document.createElement("li");
    acc.id = "nav-account";
    acc.innerHTML = '<a href="cuenta.html" class="nav-account-link"></a>';
    ul.appendChild(acc);
  } else ul.appendChild(acc); // siempre el último
  const a = acc.querySelector("a");
  a.textContent = state.profile?.username || (state.user ? "Mi cuenta" : "Iniciar sesión");
  if (here === "cuenta.html") a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", renderNav); else renderNav();

// ---------- mensajes de error en español ----------
export function errorText(e) {
  const code = e?.code || "";
  const map = {
    "auth/invalid-email": "Ese email no parece válido.",
    "auth/missing-password": "Escribe una contraseña.",
    "auth/weak-password": "La contraseña es demasiado corta (mínimo 6 caracteres).",
    "auth/email-already-in-use": "Ya hay una cuenta con ese email. Prueba a entrar en lugar de crearla.",
    "auth/invalid-credential": "Email o contraseña incorrectos.",
    "auth/wrong-password": "Email o contraseña incorrectos.",
    "auth/user-not-found": "Email o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos seguidos. Espera unos minutos y vuelve a probar.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google antes de terminar.",
    "auth/cancelled-popup-request": "Se cerró la ventana de Google antes de terminar.",
    "auth/popup-blocked": "El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta web y vuelve a probar.",
    "auth/network-request-failed": "No hay conexión. Comprueba internet y vuelve a probar.",
    "auth/requires-recent-login": "Por seguridad, cierra sesión, vuelve a entrar y repite la acción.",
    "permission-denied": "No tienes permiso para hacer esto.",
    "unavailable": "No hay conexión con el servidor. Vuelve a probar en un momento."
  };
  return map[code] || "Algo ha fallado. Vuelve a probar en un momento.";
}

// ---------- entrar / salir ----------
const verifySettings = () => ({ url: location.origin + "/cuenta.html" });

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(auth, provider);
}
export async function signUpEmail(email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await sendEmailVerification(cred.user, verifySettings());
}
export async function signInEmail(email, password) {
  await signInWithEmailAndPassword(auth, email, password);
}
export async function resendVerification() {
  if (auth.currentUser) await sendEmailVerification(auth.currentUser, verifySettings());
}
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email, verifySettings());
}
export async function logout() { await signOut(auth); }

// ---------- perfil ----------
const USERNAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_.\-]{3,20}$/;
export function validUsername(name) { return USERNAME_RE.test(name); }

async function usernameTaken(lower) {
  const snap = await getDoc(doc(db, "usernames", lower));
  return snap.exists() && snap.data().uid !== auth.currentUser.uid;
}

// Devuelve { status, codeRejected }. Si el código de invitación no es válido, la cuenta se
// crea igualmente pero queda pendiente de que la aprobéis.
export async function createProfile({ username, realName, inviteCode }) {
  const user = auth.currentUser;
  username = username.trim(); realName = realName.trim(); inviteCode = (inviteCode || "").trim();
  if (!validUsername(username)) throw { code: "app/username-invalid" };
  if (realName.length < 2) throw { code: "app/realname-invalid" };
  const lower = username.toLowerCase();
  if (await usernameTaken(lower)) throw { code: "app/username-taken" };

  const write = async (status, code) => {
    const batch = writeBatch(db);
    batch.set(doc(db, "usernames", lower), { uid: user.uid });
    batch.set(doc(db, "users", user.uid), {
      username, usernameLower: lower, realName, email: user.email || "",
      status, inviteCode: code, createdAt: serverTimestamp()
    });
    await batch.commit();
  };

  let codeRejected = false;
  if (inviteCode) {
    try { await write("approved", inviteCode); }
    catch (e) { codeRejected = true; await write("pending", ""); }
  } else {
    await write("pending", "");
  }
  await loadSession(user);
  return { status: state.profile?.status, codeRejected };
}

// Para quien se registró sin código (o con uno mal escrito) y lo introduce después.
export async function redeemInviteCode(code) {
  const uid = auth.currentUser.uid;
  await updateDoc(doc(db, "users", uid), { status: "approved", inviteCode: code.trim() });
  await loadSession(auth.currentUser);
}

export async function updateRealName(realName) {
  realName = realName.trim();
  if (realName.length < 2) throw { code: "app/realname-invalid" };
  await updateDoc(doc(db, "users", auth.currentUser.uid), { realName });
  await loadSession(auth.currentUser);
}

export async function changeUsername(username) {
  username = username.trim();
  if (!validUsername(username)) throw { code: "app/username-invalid" };
  const uid = auth.currentUser.uid;
  const lower = username.toLowerCase();
  const oldLower = state.profile.usernameLower;
  if (lower !== oldLower && await usernameTaken(lower)) throw { code: "app/username-taken" };
  const scores = await getDocs(collection(db, "users", uid, "scores"));
  const batch = writeBatch(db);
  if (lower !== oldLower) {
    batch.delete(doc(db, "usernames", oldLower));
    batch.set(doc(db, "usernames", lower), { uid });
  }
  batch.update(doc(db, "users", uid), { username, usernameLower: lower });
  scores.forEach(s => batch.update(s.ref, { username }));
  await batch.commit();
  await loadSession(auth.currentUser);
}

export const appErrorText = {
  "app/username-invalid": "El nombre de usuario debe tener entre 3 y 20 caracteres: letras, números, guion, punto o guion bajo (sin espacios).",
  "app/username-taken": "Ese nombre de usuario ya está cogido. Prueba con otro.",
  "app/realname-invalid": "Escribe tu nombre y apellidos, para que sepamos quién eres."
};
export function anyErrorText(e) { return appErrorText[e?.code] || errorText(e); }

// Borra todos tus datos y la cuenta.
export async function deleteAccount() {
  const user = auth.currentUser;
  const uid = user.uid;
  const scores = await getDocs(collection(db, "users", uid, "scores"));
  const batch = writeBatch(db);
  scores.forEach(s => batch.delete(s.ref));
  batch.delete(doc(db, "rsvp", uid));
  if (state.profile) {
    batch.delete(doc(db, "usernames", state.profile.usernameLower));
    batch.delete(doc(db, "users", uid));
  }
  await batch.commit();
  await deleteUser(user);
}

// ---------- confirmación de asistencia ----------
export async function loadRsvp() {
  const snap = await getDoc(doc(db, "rsvp", auth.currentUser.uid));
  return snap.exists() ? snap.data() : null;
}
export async function saveRsvp({ attending, attendees, answers }) {
  const p = state.profile;
  await setDoc(doc(db, "rsvp", auth.currentUser.uid), {
    attending, attendees, answers,
    realName: p.realName, email: p.email, username: p.username,
    updatedAt: serverTimestamp()
  });
}

// ---------- puntuaciones de los juegos ----------
export async function loadMyScores() {
  const snaps = await getDocs(collection(db, "users", auth.currentUser.uid, "scores"));
  const out = {};
  snaps.forEach(s => { out[s.id] = s.data(); });
  return out;
}

// game: id del juego ("wordle", "trivia-pareja"...) · points: puntos de esta partida · won: si ganó
export async function saveScore(game, points, won) {
  if (!configured || !state.approved) return { saved: false, reason: state.user ? "pending" : "anon" };
  points = Math.max(0, Math.min(100, Math.round(points)));
  const ref = doc(db, "users", auth.currentUser.uid, "scores", game);
  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);
    const d = snap.exists() ? snap.data() : { plays: 0, total: 0, best: 0, wins: 0 };
    tx.set(ref, {
      game, username: state.profile.username,
      plays: d.plays + 1, total: d.total + points, best: Math.max(d.best, points),
      wins: d.wins + (won ? 1 : 0), lastPlayed: serverTimestamp()
    });
  });
  return { saved: true };
}

// Los juegos son scripts normales, no módulos: se lo dejamos a mano en window.
window.weddingScores = {
  async save(game, points, won) {
    try {
      const r = await saveScore(game, points, won);
      if (r.saved) toast("Puntuación guardada en tu cuenta.");
      else if (configured && r.reason === "anon") toast('<a href="cuenta.html">Inicia sesión</a> para guardar tus puntuaciones.', true);
      else if (configured && r.reason === "pending") toast("Tu cuenta está pendiente de aprobación: esta puntuación no se ha guardado.");
    } catch (e) {
      console.error(e);
      toast("No se pudo guardar la puntuación.");
    }
  }
};

// ---------- aviso pequeño en la esquina ----------
export function toast(html, isHtml) {
  let el = document.getElementById("site-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "site-toast";
    el.className = "site-toast";
    el.setAttribute("role", "status");
    document.body.appendChild(el);
  }
  if (isHtml) el.innerHTML = html; else el.textContent = html;
  el.classList.add("show");
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove("show"), 4500);
}

// ---------- utilidades para las páginas ----------
export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function formatDate(ts) {
  const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  if (!d) return "";
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

// Bloque que muestran las páginas privadas cuando falta algo (sesión, aprobación...).
// Devuelve null si el usuario puede ver la página.
export function gateMessage(s, what) {
  if (!configured) return `<p>El inicio de sesión todavía no está activado en la web.</p>`;
  if (!s.user) return `<p>Para ${what} necesitas iniciar sesión.</p><p><a class="btn" href="cuenta.html">Iniciar sesión</a></p>`;
  if (s.needsVerification) return `<p>Antes de seguir, confirma tu email con el enlace que te hemos enviado.</p><p><a class="btn" href="cuenta.html">Ir a mi cuenta</a></p>`;
  if (s.needsProfile) return `<p>Te falta completar tu perfil.</p><p><a class="btn" href="cuenta.html">Completar perfil</a></p>`;
  if (s.profile?.status === "rejected") return `<p>Esta cuenta no tiene acceso. Si crees que es un error, escríbenos.</p>`;
  if (!s.approved) return `<p>Tu cuenta está pendiente de aprobación. En cuanto la aprobemos podrás ${what}.</p><p>Si tienes el código de la invitación, puedes introducirlo en <a href="cuenta.html">tu cuenta</a> para entrar al momento.</p>`;
  return null;
}
