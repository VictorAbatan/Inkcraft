import { app, db, auth, storage } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { ref, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

function debug(msg) {
  console.log(msg);
}

const fallbackNovelCover = 'default-novel-cover.jpg';
const fallbackSeriesCover = 'default-series-cover.jpg';

// --- Helper functions ---
async function getNovelCover(novel) {
  if (novel.coverPath) {
    try {
      return await getDownloadURL(ref(storage, novel.coverPath));
    } catch {}
  }
  return novel.coverUrl || novel.cover || fallbackNovelCover;
}

async function getSeriesCover(series) {
  if (series.coverImagePath) {
    try {
      return await getDownloadURL(ref(storage, series.coverImagePath));
    } catch {}
  }
  return series.coverImageURL || series.coverImage || fallbackSeriesCover;
}

document.addEventListener('DOMContentLoaded', () => {
  const novelSelect = document.getElementById('novelSelect');
  const seriesSelect = document.getElementById('seriesSelect');
  const form = document.getElementById('addToVerseForm');
  const verseTitleDisplay = document.getElementById('verseTitleDisplay');

  const addNovelBtn = document.getElementById('add-novel-btn');
  const addSeriesBtn = document.getElementById('add-series-btn');

  const addedNovelsList = document.getElementById('added-novels-list');
  const addedSeriesList = document.getElementById('added-series-list');

  let currentVerseId = null;

  const createListItem = (title, imageUrl, type, id) => {
    const li = document.createElement('li');
    li.className = 'added-item';

    const a = document.createElement('a');
    a.target = "_blank";
    if (type === "novel") a.href = `author-novels.html?novelId=${encodeURIComponent(id)}`;
    else if (type === "series") a.href = `author-series.html?seriesId=${encodeURIComponent(id)}`;

    const img = document.createElement('img');
    img.src = imageUrl || (type === 'novel' ? fallbackNovelCover : fallbackSeriesCover);
    img.alt = title;
    img.className = 'added-item-img';

    const span = document.createElement('span');
    span.textContent = title;
    span.className = 'added-item-title';

    a.appendChild(img);
    a.appendChild(span);
    li.appendChild(a);

    return li;
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) return debug("User not logged in.");
    debug(`Logged in as: ${user.uid}`);

    try {
      const versesRef = collection(db, "verses");
      const versesQ = query(versesRef, where("createdBy", "==", user.uid));
      const versesSnap = await getDocs(versesQ);

      if (!versesSnap.empty) {
        const verseDoc = versesSnap.docs[0];
        const verseData = verseDoc.data();
        verseTitleDisplay.textContent = verseData.title || "Untitled Verse";
        currentVerseId = verseDoc.id;

        // Populate already added novels
        addedNovelsList.innerHTML = '';
        if (verseData.novels && verseData.novels.length) {
          for (const novelId of verseData.novels) {
            const novelRef = doc(db, "novels", novelId);
            const novelSnap = await getDoc(novelRef);
            if (novelSnap.exists()) {
              const data = novelSnap.data();
              const cover = await getNovelCover(data);
              const li = createListItem(data.title, cover, "novel", novelId);
              addedNovelsList.appendChild(li);
            }
          }
        } else {
          addedNovelsList.innerHTML = '<li>No novels added yet.</li>';
        }

        // Populate already added series
        addedSeriesList.innerHTML = '';
        if (verseData.series && verseData.series.length) {
          for (const seriesId of verseData.series) {
            const seriesRef = doc(db, "series", seriesId);
            const seriesSnap = await getDoc(seriesRef);
            if (seriesSnap.exists()) {
              const data = seriesSnap.data();
              const cover = await getSeriesCover(data);
              const li = createListItem(data.title, cover, "series", seriesId);
              addedSeriesList.appendChild(li);
            }
          }
        } else {
          addedSeriesList.innerHTML = '<li>No series added yet.</li>';
        }

        if (addNovelBtn) addNovelBtn.addEventListener('click', () => {
          window.location.href = `select-novel.html?verseId=${encodeURIComponent(currentVerseId)}`;
        });
        if (addSeriesBtn) addSeriesBtn.addEventListener('click', () => {
          window.location.href = `select-series.html?verseId=${encodeURIComponent(currentVerseId)}`;
        });

      } else {
        verseTitleDisplay.textContent = "No verse found for this author.";
        [addNovelBtn, addSeriesBtn].forEach(btn => {
          if (btn) {
            btn.disabled = true;
            btn.style.color = '#999';
            btn.style.cursor = 'default';
          }
        });
        return;
      }

      // Novels dropdown
      const novelsRef = collection(db, "novels");
      const novelsQ = query(novelsRef, where("authorId", "==", user.uid));
      const novelsSnap = await getDocs(novelsQ);
      novelSelect.innerHTML = `<option value="">-- Select a Novel --</option>`;
      for (const docSnap of novelsSnap.docs) {
        const data = docSnap.data();
        if (data.status && ["approved", "published"].includes(data.status.toLowerCase())) {
          const option = document.createElement("option");
          option.value = docSnap.id;
          option.textContent = data.title;
          option.dataset.cover = await getNovelCover(data);
          novelSelect.appendChild(option);
        }
      }

      // Series dropdown
      const seriesRef = collection(db, "series");
      const seriesQ = query(seriesRef, where("createdBy", "==", user.uid));
      const seriesSnap = await getDocs(seriesQ);
      seriesSelect.innerHTML = `<option value="">-- Select a Series --</option>`;
      for (const docSnap of seriesSnap.docs) {
        const data = docSnap.data();
        const option = document.createElement("option");
        option.value = docSnap.id;
        option.textContent = data.title;
        option.dataset.cover = await getSeriesCover(data);
        seriesSelect.appendChild(option);
      }

    } catch (error) {
      debug("Error loading novels/series/verse: " + error.message);
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const novelId = novelSelect.value;
    const seriesId = seriesSelect.value;

    if (!currentVerseId) return alert("No verse found for this author.");
    if (!novelId && !seriesId) return alert("Select a novel or series!");

    try {
      const verseRef = doc(db, "verses", currentVerseId);

      if (novelId) {
        await updateDoc(verseRef, { novels: arrayUnion(novelId) });
        debug(`Novel ${novelId} added to verse ${currentVerseId}`);

        const selectedOption = novelSelect.options[novelSelect.selectedIndex];
        const li = createListItem(selectedOption.text, selectedOption.dataset.cover, "novel", novelId);
        if (addedNovelsList.querySelector('li')?.textContent === "No novels added yet.") {
          addedNovelsList.innerHTML = '';
        }
        addedNovelsList.appendChild(li);
      }

      if (seriesId) {
        await updateDoc(verseRef, { series: arrayUnion(seriesId) });
        debug(`Series ${seriesId} added to verse ${currentVerseId}`);

        const selectedOption = seriesSelect.options[seriesSelect.selectedIndex];
        const li = createListItem(selectedOption.text, selectedOption.dataset.cover, "series", seriesId);
        if (addedSeriesList.querySelector('li')?.textContent === "No series added yet.") {
          addedSeriesList.innerHTML = '';
        }
        addedSeriesList.appendChild(li);
      }

      alert("Verse updated successfully!");
    } catch (error) {
      debug("Error updating verse: " + error.message);
    }
  });
});
