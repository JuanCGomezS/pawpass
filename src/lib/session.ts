import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
  | { status: "signed-in"; session: Session };

async function ensureProfile(user: User): Promise<void> {
  if (!db) return;
  const reference = doc(db, "users", user.uid);
  const profile = await getDoc(reference);
  if (!profile.exists()) {
    await setDoc(reference, {
      uid: user.uid,
      email: user.email ?? "",
      role: "prospect",
      createdAt: serverTimestamp(),
    });
  }
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
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback({ status: "signed-out" });
      return;
    }

    try {
      await ensureProfile(user);
      const token = await user.getIdTokenResult();
      callback({
        status: "signed-in",
        session: {
          uid: user.uid,
          email: user.email ?? "",
          isSuperadmin: token.claims.role === "superadmin",
        },
      });
    } catch {
      callback({
        status: "configured-error",
        message: "No fue posible cargar tu sesión.",
      });
    }
  });
}

export async function signOutUser(): Promise<void> {
  if (auth) await signOut(auth);
}
