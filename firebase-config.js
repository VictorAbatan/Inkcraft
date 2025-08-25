import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyCZ2DyHyVRmtO1TeYspnW4DBLvCAt1Hvuk",
  authDomain: "inkcraft-6c0f6.firebaseapp.com",
  projectId: "inkcraft-6c0f6",
  storageBucket: "inkcraft-6c0f6.firebasestorage.app", // ✅ leave as-is
  messagingSenderId: "87895920556",
  appId: "1:87895920556:web:ddce4775fcf299788ff409"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Enable offline persistence for Firestore
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn("⚠️ Persistence failed — multiple tabs open.");
  } else if (err.code === 'unimplemented') {
    console.warn("⚠️ Persistence not supported in this browser.");
  }
});

export { app };
