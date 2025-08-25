import { app, db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', async () => {
  // 1️⃣ Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;

      const currentPage = window.location.pathname.split('/').pop();
      document.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
          link.classList.add('active');
        }
      });
    });

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

    // 4️⃣ Populate catalog
    verses.forEach((verse, index) => {
      const item = document.createElement('div');
      item.className = 'verse-item';
      item.style.animationDelay = `${index * 100}ms`; // staggered effect

      // ✅ Ensure cover fallback and description
      const coverURL = verse.coverURL && verse.coverURL.trim() !== "" 
        ? verse.coverURL 
        : "default-verse-cover.jpg";
      const description = verse.description || "No description available.";

      item.innerHTML = `
        <img src="${coverURL}" alt="${verse.title}" onerror="this.src='default-verse-cover.jpg'">
        <h3 style="text-align:center;">${verse.title}</h3>
        <p style="color:white; text-align:center; font-size:0.9em; padding:0 10px;">${description}</p>
      `;

      // 🔗 Redirect to verse-details.html with the verse ID
      item.addEventListener('click', () => {
        window.location.href = `verse-details.html?id=${verse.id}`;
      });

      catalog.appendChild(item);
    });
  } catch (err) {
    console.error("Error fetching verses:", err);
    catalog.innerHTML = `<p style="color:red; text-align:center;">Failed to load verses.</p>`;
  }
});
