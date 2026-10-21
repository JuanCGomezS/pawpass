import { initializeApp, getApps, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

declare global { var __PAWPASS_FIREBASE__: FirebaseOptions | undefined; }

const config = globalThis.__PAWPASS_FIREBASE__;
export const firebaseConfigured = Boolean(config?.apiKey && config.projectId && config.appId);
export const firebase = firebaseConfigured && config ? (getApps()[0] ?? initializeApp(config)) : null;
export const auth = firebase ? getAuth(firebase) : null;
export const db = firebase ? getFirestore(firebase) : null;
export const storage = firebase ? getStorage(firebase) : null;
