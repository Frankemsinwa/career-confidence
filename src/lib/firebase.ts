
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let FIREBASE_CONFIG_ERROR: string | null = null;

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || firebaseConfig.apiKey.startsWith('your_')) {
  FIREBASE_CONFIG_ERROR = 'Firebase credentials are not configured. Please create a .env.local file with your project settings.';
} else {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    FIREBASE_CONFIG_ERROR = error instanceof Error ? error.message : "An unknown error occurred during Firebase initialization.";
    app = null;
    auth = null;
  }
}

export { app, auth, FIREBASE_CONFIG_ERROR };
