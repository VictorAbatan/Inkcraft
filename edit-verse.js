import { app, db, auth, storage } from './firebase-config.js';
import {
  doc,
  updateDoc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

function debug(msg) {
  console.log(msg);
  document.getElementById('debug').textContent = msg;
}

// ✅ helper to parse storage path from download URL
function getPathFromUrl(url) {
  const match = decodeURIComponent(url).match(/o\/(.*?)\?/);
  return match ? match[1] : null;
}

document.addEventListener('DOMContentLoaded', () => {
  const verseTitleInput = document.getElementById('verseTitle');
  const verseDescriptionInput = document.getElementById('verseDescription');
  const verseImageInput = document.getElementById('newVerseImage'); // ✅ fixed id
  const currentImage = document.getElementById('currentImage');
  const form = document.getElementById('editVerseForm');

  let currentVerseId = null;
  let currentUser = null;
  let oldCoverURL = null; // ✅ track old cover

  // ✅ Preview new image before upload
  if (verseImageInput && currentImage) {
    verseImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          currentImage.src = ev.target.result;
          currentImage.style.display = "block";
          const noCoverMsg = document.getElementById("noCoverMsg");
          if (noCoverMsg) noCoverMsg.remove();
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ✅ get verseId from query string
  const params = new URLSearchParams(window.location.search);
  const verseIdFromUrl = params.get("id");

  if (!verseIdFromUrl) {
    debug("No verse ID provided in URL.");
    alert("No verse ID provided.");
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return debug("User not logged in.");
    debug(`Logged in as: ${user.uid}`);
    currentUser = user;
    currentVerseId = verseIdFromUrl;

    try {
      const verseRef = doc(db, "verses", currentVerseId);
      const verseSnap = await getDoc(verseRef);

      if (!verseSnap.exists()) {
        debug("Verse not found.");
        alert("Verse not found.");
        return;
      }

      const data = verseSnap.data();

      // ✅ Ensure the logged-in user is the creator
      if (data.createdBy !== user.uid) {
        debug("Unauthorized access to this verse.");
        alert("You are not allowed to edit this verse.");
        return;
      }

      // Set current info inside form inputs
      verseTitleInput.value = data.title || "";
      verseDescriptionInput.value = data.description || "";

      if (data.coverURL) {
        oldCoverURL = data.coverURL; // ✅ save old image url
        currentImage.src = data.coverURL;
        currentImage.style.display = "block";
      } else {
        currentImage.style.display = "none";
        currentImage.insertAdjacentHTML("afterend", "<p id='noCoverMsg'>No cover uploaded</p>");
      }

    } catch (error) {
      debug("Error loading verse: " + error.message);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentVerseId) return alert("No verse found.");
    if (!currentUser) return alert("User not authenticated.");

    try {
      const verseRef = doc(db, "verses", currentVerseId);
      const updates = {};

      if (verseTitleInput.value.trim() !== "") updates.title = verseTitleInput.value.trim();
      if (verseDescriptionInput.value.trim() !== "") updates.description = verseDescriptionInput.value.trim();

      // ✅ safe check for file input
      if (verseImageInput && verseImageInput.files.length > 0) {
        const file = verseImageInput.files[0];

        // ✅ delete old image if exists
        if (oldCoverURL) {
          try {
            const oldPath = getPathFromUrl(oldCoverURL);
            if (oldPath) {
              const oldRef = ref(storage, oldPath);
              await deleteObject(oldRef);
            }
          } catch (err) {
            console.warn("Couldn't delete old image:", err.message);
          }
        }

        // ✅ upload new one
        const storageRef = ref(storage, `verse-covers/${currentUser.uid}/${currentVerseId}-${Date.now()}`);
        await uploadBytes(storageRef, file);
        const imageUrl = await getDownloadURL(storageRef);
        updates.coverURL = imageUrl; // ✅ overwrite the same field
      }

      if (Object.keys(updates).length > 0) {
        await updateDoc(verseRef, updates);
        debug("Verse updated successfully!");
        alert("Verse updated successfully!");

        // Update displayed preview
        if (updates.coverURL) {
          currentImage.src = updates.coverURL;
          currentImage.style.display = "block";
          const noCoverMsg = document.getElementById("noCoverMsg");
          if (noCoverMsg) noCoverMsg.remove();
        }

        // ✅ redirect after save
        window.location.href = "author-verse.html";

      } else {
        alert("No changes made.");
      }

    } catch (error) {
      debug("Error updating verse: " + error.message);
    }
  });
});
