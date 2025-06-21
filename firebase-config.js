import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyCZ2DyHyVRmtO1TeYspnW4DBLvCAt1Hvuk",
  authDomain: "inkcraft-6c0f6.firebaseapp.com",
  projectId: "inkcraft-6c0f6",
  storageBucket: "inkcraft-6c0f6.firebasestorage.app", // <-- updated here
  messagingSenderId: "87895920556",
  appId: "1:87895920556:web:ddce4775fcf299788ff409"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export { app };
