import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp, getDocFromServer, setDoc, getDoc } from "firebase/firestore";

// Firebase configuration
const firebaseConfig: any = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID
};

// Fallback for local development/AI Studio
// We use a synchronous check to avoid top-level await issues in some environments
if (!firebaseConfig.apiKey) {
  console.warn("Firebase API Key missing from environment variables. Checking for local config...");
  try {
    // This is a dynamic import that will be handled by Vite
    // In production (Vercel), this file won't exist, so it will fall into the catch block
    const localConfig = await import("../../firebase-applet-config.json").then(m => m.default || m);
    if (localConfig) {
      Object.assign(firebaseConfig, {
        apiKey: localConfig.apiKey,
        authDomain: localConfig.authDomain,
        projectId: localConfig.projectId,
        storageBucket: localConfig.storageBucket,
        messagingSenderId: localConfig.messagingSenderId,
        appId: localConfig.appId,
        firestoreDatabaseId: localConfig.firestoreDatabaseId
      });
    }
  } catch (e) {
    console.error("CRITICAL: Firebase configuration not found. Please set VITE_FIREBASE_* environment variables in Vercel.");
  }
}

// Initialize Firebase only if we have a valid config
let app;
try {
  if (!firebaseConfig.apiKey) {
    throw new Error("Firebase API Key is required for initialization.");
  }
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Create a dummy app object to prevent total crash, but auth/db will be unusable
  app = { name: "[DEFAULT]" } as any;
}

export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
export const googleProvider = new GoogleAuthProvider();

// Auth helpers with better error handling
export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Login failed:", error);
    if (error.code === "auth/unauthorized-domain") {
      alert(`Domain not authorized. Please add this domain to Firebase Console -> Authentication -> Settings -> Authorized Domains: ${window.location.hostname}`);
    } else {
      alert(`Login error: ${error.message}`);
    }
    throw error;
  }
};
export const logout = () => signOut(auth);

// Error handling for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}
testConnection();

export { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  onAuthStateChanged,
  setDoc,
  getDoc
};
