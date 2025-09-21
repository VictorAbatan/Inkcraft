import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyCZ2DyHyVRmtO1TeYspnW4DBLvCAt1Hvuk",
  authDomain: "inkcraft-6c0f6.firebaseapp.com",
  projectId: "inkcraft-6c0f6",
storageBucket: "inkcraft-6c0f6.firebasestorage.app",

  messagingSenderId: "87895920556",
  appId: "1:87895920556:web:ddce4775fcf299788ff409"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
  .catch((err) => console.error("⚠️ Auth persistence error:", err));

export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ Enable persistent local cache (new FirestoreSettings API)
try {
  db._setSettings({
    cache: { type: 'persistent' }
  });
  console.log("✅ Firestore persistence enabled with new cache API");
} catch (err) {
  console.warn("⚠️ Could not enable persistence:", err);
}

export { app };
