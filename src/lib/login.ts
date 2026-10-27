import {
  recoverPassword,
  signInWithEmail,
  signInWithGoogle,
  type AuthResult,
} from "./auth";
import { confirmProfileName, observeSession, signOutUser } from "./session";

const element = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!;
const fields = element<HTMLFieldSetElement>("[data-auth-fields]");
const message = element("[data-auth-message]");
const retry = element<HTMLButtonElement>("[data-retry-session]");
const email = element<HTMLInputElement>("#email");
const password = element<HTMLInputElement>("#password");
const resetEmail = element<HTMLInputElement>("#reset-email");
const name = element<HTMLInputElement>("#profile-name");
const destination = `${import.meta.env.BASE_URL}mis-mascotas/`;
type View = "login" | "name" | "reset";
let view: View = "login";
let busy = true;
let operation = 0;
let profileUid: string | undefined;

function showMessage(text: string, error = false) {
  message.textContent = text;
  message.dataset.kind = error ? "error" : "info";
}
function setBusy(value: boolean) {
  busy = value;
  fields.disabled = value;
  fields.setAttribute("aria-busy", String(value));
}
function showView(next: View) {
  view = next;
  for (const section of document.querySelectorAll<HTMLElement>(
    "[data-auth-view]",
  ))
    section.hidden = section.dataset.authView !== next;
  showMessage("");
}
async function authenticate(
  action: () => Promise<AuthResult>,
  pendingMessage: string,
) {
  if (busy || view !== "login") return;
  const current = ++operation;
  setBusy(true);
  showMessage(pendingMessage);
  const result = await action();
  if (current !== operation) return;
  if (!result.ok) {
    setBusy(false);
    showMessage(result.message, true);
  } else {
    showMessage("Preparando tu espacio…");
  }
}

const unsubscribe = observeSession((state) => {
  operation++;
  retry.hidden = true;
  if (state.status === "loading") {
    setBusy(true);
    return;
  }
  if (state.status === "configured-error") {
    setBusy(true);
    showMessage(`${state.message} Vuelve a intentarlo.`, true);
    retry.hidden = false;
    return;
  }
  if (state.status === "signed-in") {
    setBusy(true);
    showMessage("Abriendo tu espacio…");
    window.location.assign(destination);
    return;
  }
  setBusy(false);
  if (state.status === "needs-profile") {
    profileUid = state.session.uid;
    password.value = "";
    name.value = state.suggestedName.slice(0, 80);
    element("[data-profile-email]").textContent = state.session.email;
    showView("name");
    name.focus();
    return;
  }
  profileUid = undefined;
  name.value = "";
  element("[data-profile-email]").textContent = "";
  password.value = "";
  showView("login");
});

element("[data-google-sign-in]").addEventListener("click", () => {
  void authenticate(signInWithGoogle, "Abriendo Google…");
});
element<HTMLFormElement>("[data-email-form]").addEventListener(
  "submit",
  (event) => {
    event.preventDefault();
    void authenticate(
      () => signInWithEmail(email.value, password.value),
      "Comprobando tu acceso…",
    );
  },
);
element("[data-reset-open]").addEventListener("click", () => {
  if (busy) return;
  resetEmail.value = email.value.trim();
  password.value = "";
  showView("reset");
  resetEmail.focus();
});
element("[data-reset-back]").addEventListener("click", () => {
  if (busy) return;
  email.value = resetEmail.value.trim();
  showView("login");
  email.focus();
});
element<HTMLFormElement>("[data-reset-form]").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    if (busy || view !== "reset") return;
    const current = ++operation;
    setBusy(true);
    showMessage("Solicitando el enlace de recuperación…");
    const result = await recoverPassword(resetEmail.value);
    if (current !== operation) return;
    setBusy(false);
    showMessage(
      result.ok
        ? "Si existe una cuenta asociada a ese correo, recibirás un enlace para recuperar tu contraseña. Revisa también spam o correo no deseado. Después vuelve aquí para ingresar."
        : result.message,
      !result.ok,
    );
  },
);
element<HTMLFormElement>("[data-name-form]").addEventListener(
  "submit",
  async (event) => {
    event.preventDefault();
    if (busy || view !== "name" || !profileUid) return;
    const displayName = name.value.trim();
    if (!displayName || displayName.length > 80) {
      showMessage("Escribe tu nombre, de máximo 80 caracteres.", true);
      name.focus();
      return;
    }
    const uid = profileUid;
    const current = ++operation;
    setBusy(true);
    showMessage("Guardando tu nombre…");
    try {
      await confirmProfileName(uid, displayName);
      if (current !== operation || profileUid !== uid) return;
      window.location.assign(destination);
    } catch {
      if (current !== operation) return;
      setBusy(false);
      showMessage(
        "No pudimos guardar tu nombre. Intenta de nuevo; no necesitas crear otra cuenta.",
        true,
      );
    }
  },
);
element("[data-change-account]").addEventListener("click", async () => {
  if (busy) return;
  const current = ++operation;
  setBusy(true);
  showMessage("Cerrando esta sesión…");
  try {
    await signOutUser();
  } catch {
    if (current !== operation) return;
    setBusy(false);
    showMessage("No pudimos cerrar la sesión. Inténtalo de nuevo.", true);
  }
});
retry.addEventListener("click", () => window.location.reload());
window.addEventListener("pagehide", () => {
  operation++;
  unsubscribe();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) window.location.reload();
});
