import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);

  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert("Please log in to run the patch.");
      window.location.href = "login.html";
      return;
    }

    const uid = user.uid;
    const q = query(collection(db, 'series'), where('createdBy', '==', uid));

    try {
      const snapshot = await getDocs(q);
      let patched = 0;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (!data.ownerId) {
          const ref = doc(db, 'series', docSnap.id);
          await updateDoc(ref, { ownerId: uid });
          patched++;
          console.log(`✅ Patched series: ${docSnap.id}`);
        }
      }

      alert(`Patch complete. ${patched} series updated.`);
    } catch (err) {
      console.error("Error patching series:", err);
      alert("Failed to patch series. See console for details.");
    }
  });
});
