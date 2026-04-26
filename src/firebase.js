import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCL-gxxcxfjFgWDPvzKlMkXGMfq2igK3ZA",
  authDomain: "loadgo-dev.firebaseapp.com",
  projectId: "loadgo-dev",
  storageBucket: "loadgo-dev.firebasestorage.app",
  messagingSenderId: "470719393810",
  appId: "1:470719393810:web:aee8e35bced6522f6568cb",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
