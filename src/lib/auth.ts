import { FirebaseError } from "firebase/app";
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export type AuthResult = { ok: true } | { ok: false; message: string };

function errorMessage(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : "";
  switch (code) {
    case "auth/user-not-found":
      return "No estás registrado. Continúa con Google para crear tu cuenta.";
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
    case "auth/wrong-password":
      return "El correo o la contraseña no son correctos. Si aún no tienes cuenta, continúa con Google para registrarte.";
    case "auth/invalid-email":
      return "Revisa que el correo electrónico esté bien escrito.";
    case "auth/user-disabled":
      return "Esta cuenta está deshabilitada. Contacta con la administración.";
    case "auth/too-many-requests":
      return "Hubo demasiados intentos. Espera unos minutos y vuelve a intentarlo.";
    case "auth/network-request-failed":
      return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Cerraste la ventana de Google. Puedes volver a intentarlo cuando quieras.";
    case "auth/popup-blocked":
      return "Permite las ventanas emergentes de este sitio para continuar con Google.";
    case "auth/unauthorized-domain":
      return "Este dominio aún no está autorizado para iniciar sesión. Contacta con la administración.";
    case "auth/account-exists-with-different-credential":
      return "Este correo ya tiene una cuenta con otro método de acceso. Ingresa con el método que utilizaste antes.";
    case "auth/operation-not-allowed":
      return "Este método de acceso no está habilitado. Contacta con la administración.";
    default:
      return "No pudimos completar la solicitud. Inténtalo de nuevo.";
  }
}

const unavailable: AuthResult = {
  ok: false,
  message: "El acceso no está disponible en este momento. Inténtalo más tarde.",
};

export async function signInWithGoogle(): Promise<AuthResult> {
  if (!firebaseConfigured || !auth) return unavailable;
  auth.languageCode = "es";
  try {
    await signInWithPopup(auth, provider);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthResult> {
  if (!firebaseConfigured || !auth) return unavailable;
  auth.languageCode = "es";
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export async function recoverPassword(email: string): Promise<AuthResult> {
  if (!firebaseConfigured || !auth) return unavailable;
  auth.languageCode = "es";
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { ok: true };
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "auth/user-not-found")
      return { ok: true };
    return { ok: false, message: errorMessage(error) };
  }
}
