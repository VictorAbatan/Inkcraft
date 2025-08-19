import { app, db, auth } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

function debug(msg) {
  console.log(msg); // keep console logging
}

const novelSelect = document.getElementById('novelSelect');
const seriesSelect = document.getElementById('seriesSelect');
const form = document.getElementById('addToVerseForm');
const verseTitleDisplay = document.getElementById('verseTitleDisplay');

let currentVerseId = null;

// 🔹 Load verse, novels & series for logged-in author
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    debug("User not logged in.");
    return;
  }

  debug(`Logged in as: ${user.uid}`);

  try {
    // 🔹 Fetch this author's verse (only one)
    const versesRef = collection(db, "verses");
    const versesQ = query(versesRef, where("createdBy", "==", user.uid));
    const versesSnap = await getDocs(versesQ);

    if (!versesSnap.empty) {
      const verseDoc = versesSnap.docs[0]; // only one per author
      const verseData = verseDoc.data();
      verseTitleDisplay.textContent = verseData.title || "Untitled Verse";
      currentVerseId = verseDoc.id;
    } else {
      verseTitleDisplay.textContent = "No verse found for this author.";
      debug("No verse found for this author.");
      return;
    }

    // 🔹 Novels (only approved/published by this user)
    const novelsRef = collection(db, "novels");
    const novelsQ = query(novelsRef, where("submittedBy", "==", user.uid));
    const novelsSnap = await getDocs(novelsQ);

    let foundNovels = 0;
    novelSelect.innerHTML = `<option value="">-- Select a Novel --</option>`;
    novelsSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status && ["approved", "published"].includes(data.status.toLowerCase())) {
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.textContent = data.title;
        novelSelect.appendChild(option);
        foundNovels++;
      }
    });
    if (!foundNovels) {
      novelSelect.innerHTML += `<option disabled>No approved novels available</option>`;
    }

    // 🔹 Series (only approved/published by this user)
    const seriesRef = collection(db, "series");
    const seriesQ = query(seriesRef, where("createdBy", "==", user.uid));
    const seriesSnap = await getDocs(seriesQ);

    let foundSeries = 0;
    seriesSelect.innerHTML = `<option value="">-- Select a Series --</option>`;
    seriesSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.status && ["approved", "published"].includes((data.status || "").toLowerCase())) {
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.textContent = data.title;
        seriesSelect.appendChild(option);
        foundSeries++;
      }
    });
    if (!foundSeries) {
      seriesSelect.innerHTML += `<option disabled>No approved series available</option>`;
    }

  } catch (error) {
    debug("Error loading novels/series/verse: " + error.message);
  }
});

// 🔹 Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const novelId = novelSelect.value;
  const seriesId = seriesSelect.value;

  if (!currentVerseId) return alert("No verse found for this author.");
  if (!novelId && !seriesId) return alert("Select a novel or series!");

  try {
    const verseRef = doc(db, "verses", currentVerseId);

    if (novelId) {
      await updateDoc(verseRef, {
        novels: arrayUnion(novelId)
      });
      debug(`Novel ${novelId} added to verse ${currentVerseId}`);
    }

    if (seriesId) {
      await updateDoc(verseRef, {
        series: arrayUnion(seriesId)
      });
      debug(`Series ${seriesId} added to verse ${currentVerseId}`);
    }

    alert("Verse updated successfully!");
  } catch (error) {
    debug("Error updating verse: " + error.message);
  }
});
