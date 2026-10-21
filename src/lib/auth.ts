import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, firebaseConfigured } from "./firebase";

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

export type SignInResult = { ok: true } | { ok: false; message: string };

export async function signInWithGoogle(): Promise<SignInResult> {
  if (!firebaseConfigured || !auth) {
    return {
      ok: false,
      message: "Configura Firebase para continuar con Google.",
    };
  }

  try {
    await signInWithPopup(auth, provider);
    return { ok: true };
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code.includes("popup-closed-by-user")) {
      return {
        ok: false,
        message: "Cerraste la ventana de Google antes de terminar.",
      };
    }
    if (code.includes("popup-blocked")) {
      return {
        ok: false,
        message:
          "El navegador bloqueó la ventana. Permite ventanas emergentes e inténtalo otra vez.",
      };
    }
    if (code.includes("unauthorized-domain")) {
      return {
        ok: false,
        message: "Este dominio no está autorizado en Firebase Authentication.",
      };
    }
    if (code.includes("account-exists-with-different-credential")) {
      return {
        ok: false,
        message:
          "Este correo ya usa otro método de acceso. Ingresa con ese método primero.",
      };
    }
    return {
      ok: false,
      message: "No fue posible iniciar sesión con Google. Inténtalo de nuevo.",
    };
  }
}
