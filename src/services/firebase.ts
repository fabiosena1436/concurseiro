// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const apiKey = import.meta.env.VITE_API_KEY;
const authDomain = import.meta.env.VITE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_APP_ID;

if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
  throw new Error(
    "A configuração do Firebase está incompleta. Verifique seu arquivo .env."
  );
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
