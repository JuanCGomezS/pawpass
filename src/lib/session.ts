import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import {
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { auth, db, firebaseConfigured } from "./firebase";

export type Session = {
  uid: string;
  email: string;
  isSuperadmin: boolean;
};

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "configured-error"; message: string }
  | { status: "signed-in"; session: Session }
  | { status: "needs-profile"; session: Session; suggestedName: string };

async function ensureProfile(user: User) {
  if (!db) throw new Error("Firebase no está configurado.");
  const reference = doc(db, "users", user.uid);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) {
      const data = snapshot.data();
      return {
        needsName: data.nameConfirmed === false,
        suggestedName:
          typeof data.displayName === "string"
            ? data.displayName
            : (user.displayName ?? ""),
      };
    }
    const needsName = user.providerData.some(
      (provider) => provider.providerId === "google.com",
    );
    const displayName = user.displayName ?? "";
    transaction.set(reference, {
      uid: user.uid,
      email: user.email ?? "",
      role: "prospect",
      displayName,
      nameConfirmed: !needsName,
      createdAt: serverTimestamp(),
    });
    return { needsName, suggestedName: displayName };
  });
}

export async function confirmProfileName(
  uid: string,
  value: string,
): Promise<void> {
  const name = value.trim();
  if (!name || name.length > 80)
    throw new Error("Escribe tu nombre, de máximo 80 caracteres.");
  if (!auth || !db || auth.currentUser?.uid !== uid)
    throw new Error("Tu sesión cambió. Vuelve a iniciar sesión.");
  await updateDoc(doc(db, "users", uid), {
    displayName: name,
    nameConfirmed: true,
  });
}

export function observeSession(
  callback: (state: SessionState) => void,
): () => void {
  if (!firebaseConfigured || !auth) {
    callback({
      status: "configured-error",
      message: "Firebase no está configurado.",
    });
    return () => undefined;
  }

  callback({ status: "loading" });
  let generation = 0;
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    const current = ++generation;
    if (!user) {
      callback({ status: "signed-out" });
      return;
    }
    callback({ status: "loading" });

    try {
      const profile = await ensureProfile(user);
      const token = await user.getIdTokenResult();
      if (current !== generation || auth?.currentUser?.uid !== user.uid) return;
      const session: Session = {
        uid: user.uid,
        email: user.email ?? "",
        isSuperadmin: token.claims.role === "superadmin",
      };
      callback(
        profile.needsName
          ? {
              status: "needs-profile",
              session,
              suggestedName: profile.suggestedName,
            }
          : { status: "signed-in", session },
      );
    } catch {
      if (current !== generation || auth?.currentUser?.uid !== user.uid) return;
      callback({
        status: "configured-error",
        message: "No fue posible cargar tu sesión.",
      });
    }
  });
  return () => {
    generation++;
    unsubscribe();
  };
}

export async function signOutUser(): Promise<void> {
  if (auth) await signOut(auth);
}
