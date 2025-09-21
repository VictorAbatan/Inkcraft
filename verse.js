import { app, db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

document.addEventListener('DOMContentLoaded', async () => {
  // 1️⃣ Load floating menu safely
  try {
    const res = await fetch('floating-menu.html');
    if (res.ok) {
      const html = await res.text();
      document.getElementById('floating-menu-container').innerHTML = html;

      const currentPage = window.location.pathname.split('/').pop().toLowerCase();
      document.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href')?.toLowerCase().split('?')[0];
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    }
  } catch (err) {
    console.error("Failed to load floating menu:", err);
  }

  // 2️⃣ Reference to catalog container
  const catalog = document.getElementById('verseCatalog');
  if (!catalog) return;

  // 3️⃣ Fetch created verses from Firestore
  try {
    const versesSnapshot = await getDocs(collection(db, 'verses'));
    const verses = versesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (verses.length === 0) {
      catalog.innerHTML = `<p style="color:white; text-align:center;">No verses created yet.</p>`;
      return;
    }

    // ✅ Setup Firebase Storage
    const storage = getStorage(app);

    // 4️⃣ Populate catalog
    for (let index = 0; index < verses.length; index++) {
      const verse = verses[index];
      const item = document.createElement('div');
      item.className = 'verse-item';
      item.style.animationDelay = `${index * 100}ms`; // staggered effect

      const description = verse.description || "No description available.";
      const title = verse.title || "Untitled Verse";

      // ✅ Try to resolve coverURL from Firebase Storage
      let coverURL = "default-verse-cover.jpg";
      if (verse.coverPath && verse.coverPath.trim() !== "") {
        try {
          const coverRef = ref(storage, verse.coverPath);
          coverURL = await getDownloadURL(coverRef);
        } catch (err) {
          console.warn(`Failed to fetch cover for ${title}:`, err);
        }
      } else if (verse.coverURL && verse.coverURL.trim() !== "") {
        // in case you already store direct URLs
        coverURL = verse.coverURL;
      }

      item.innerHTML = `
        <img src="${coverURL}" alt="${title}" onerror="this.src='default-verse-cover.jpg'">
        <h3 style="text-align:center;">${title}</h3>
        <p style="color:white; text-align:center; font-size:0.9em; padding:0 10px;">${description}</p>
      `;

      // 🔗 Redirect to verse-details.html with the verse ID
      item.addEventListener('click', () => {
        window.location.href = `verse-details.html?id=${verse.id}`;
      });

      catalog.appendChild(item);
    }
  } catch (err) {
    console.error("Error fetching verses:", err);
    catalog.innerHTML = `<p style="color:red; text-align:center;">Failed to load verses.</p>`;
  }
});

