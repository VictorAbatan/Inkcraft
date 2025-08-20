import { app, db, auth, storage } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

function debug(msg) {
  console.log(msg);
  document.getElementById('debug').textContent = msg;
}

document.addEventListener('DOMContentLoaded', () => {
  const verseTitleInput = document.getElementById('verseTitle');
  const verseDescriptionInput = document.getElementById('verseDescription');
  const verseImageInput = document.getElementById('verseImage');
  const currentImage = document.getElementById('currentImage');
  const form = document.getElementById('editVerseForm');

  let currentVerseId = null;

  onAuthStateChanged(auth, async (user) => {
    if (!user) return debug("User not logged in.");
    debug(`Logged in as: ${user.uid}`);

    try {
      const versesRef = collection(db, "verses");
      const versesQ = query(versesRef, where("createdBy", "==", user.uid));
      const versesSnap = await getDocs(versesQ);

      if (!versesSnap.empty) {
        const verseDoc = versesSnap.docs[0];
        currentVerseId = verseDoc.id;
        const data = verseDoc.data();

        // Set current info inside form inputs
        verseTitleInput.value = data.title || "";
        verseDescriptionInput.value = data.description || "";
        currentImage.src = data.coverURL || "placeholder.png";

      } else {
        debug("No verse found for this author.");
        return;
      }

    } catch (error) {
      debug("Error loading verse: " + error.message);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentVerseId) return alert("No verse found.");

    try {
      const verseRef = doc(db, "verses", currentVerseId);
      const updates = {};

      if (verseTitleInput.value.trim() !== "") updates.title = verseTitleInput.value.trim();
      if (verseDescriptionInput.value.trim() !== "") updates.description = verseDescriptionInput.value.trim();

      if (verseImageInput.files.length > 0) {
        const file = verseImageInput.files[0];
        const storageRef = ref(storage, `verse-covers/${currentVerseId}-${file.name}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);
        updates.coverUrl = imageUrl;
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(verseRef, updates);
        debug("Verse updated successfully!");
        alert("Verse updated successfully!");

        // Update displayed preview
        if (updates.coverUrl) currentImage.src = updates.coverUrl;
      } else {
        alert("No changes made.");
      }

    } catch (error) {
      debug("Error updating verse: " + error.message);
    }
  });
});
