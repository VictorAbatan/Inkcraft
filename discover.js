import { app, db, storage } from './firebase-config.js';
import {
  collection,
  getDocs,
  doc,
  query,
  orderBy,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  ref,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Load floating menu
  fetch('floating-menu.html')
    .then(res => res.text())
    .then(html => {
      document.getElementById('floating-menu-container').innerHTML = html;

      // Highlight current page
      const currentPage = window.location.pathname.split('/').pop();
      document.querySelectorAll('.floating-menu a').forEach(link => {
        if (link.getAttribute('href') === currentPage) {
          link.classList.add('active');
        }
      });
    });

  const catalog = document.getElementById('bookCatalog');
  const searchInput = document.getElementById('searchInput');
  let allBooks = [];

  // ✅ Create loading spinner element (Summoning novels...)
  const loader = document.createElement('div');
  loader.id = "loadingSpinner";
  loader.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; gap:10px; animation: fadeIn 0.3s ease;">
      <div style="
        width:60px;
        height:60px;
        border:4px solid rgba(162,89,255,0.2);
        border-top-color: #A259FF;
        border-radius:50%;
        animation: spin 1s linear infinite;
      "></div>
      <span style="font-size:1rem; color:#fff; opacity:0.9;">Summoning novels...</span>
    </div>
  `;
  loader.style.textAlign = "center";
  loader.style.padding = "20px";
  catalog.before(loader);

  // ✅ Add keyframes for ring spinner
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes spin {
      100% { transform: rotate(360deg); }
    }
    @keyframes fadeIn {
      from { opacity:0; }
      to { opacity:1; }
    }
  `;
  document.head.appendChild(style);

  // ✅ Helper to fetch image with fallback
  async function getImageURL(storagePath, fallback) {
    if (storagePath) {
      try {
        const storageRef = ref(storage, storagePath);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch {}
    }
    return fallback;
  }

  // ✅ Fetch novels (approved only)
  async function fetchPublishedNovels() {
    loader.style.display = "block"; // Show loader

    const q = query(
      collection(db, 'novels'),
      where("status", "==", "approved"),
      orderBy('title')
    );
    const snapshot = await getDocs(q);

    allBooks = [];
    const authorCache = new Map();

    const promises = snapshot.docs.map(async docSnap => {
      const data = docSnap.data();

      let authorName = data.authorName || 'Unknown Author';
      if (!data.authorName && data.authorId) {
        if (authorCache.has(data.authorId)) {
          authorName = authorCache.get(data.authorId);
        } else {
          const userDoc = await getDocs(collection(db, 'users'));
          const user = userDoc.docs.find(d => d.id === data.authorId);
          if (user) {
            const userData = user.data();
            authorName = userData.authorName || userData.penName || 'Unknown Author';
            authorCache.set(data.authorId, authorName);
          }
        }
      }

      const coverURL = await getImageURL(data.coverPath, data.coverUrl || 'default-cover.jpg');

      return {
        id: docSnap.id,
        title: data.title || 'Untitled',
        cover: coverURL,
        author: authorName
      };
    });

    allBooks = await Promise.all(promises);
    loader.style.display = "none"; // Hide loader
    renderBooks(allBooks);
  }

  function renderBooks(list) {
    catalog.innerHTML = '';

    if (list.length === 0) {
      catalog.innerHTML = `<div class="no-results" style="text-align:center; padding:20px;">Book not found</div>`;
      return;
    }

    list.forEach((book, index) => {
      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-item';
      bookDiv.style.animationDelay = `${index * 50}ms`;

      bookDiv.innerHTML = `
        <img src="${book.cover}" alt="${book.title}" loading="lazy">
        <div class="book-label">
          <strong>${book.title}</strong><br>
          <small>by ${book.author}</small>
        </div>
      `;

      bookDiv.addEventListener('click', () => {
        window.location.href = `novel-details.html?novelId=${book.id}`;
      });

      catalog.appendChild(bookDiv);
    });
  }

  // Search functionality
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (query === '') {
      renderBooks(allBooks);
    } else {
      const filtered = allBooks.filter(book =>
        book.title.toLowerCase().includes(query)
      );
      renderBooks(filtered);
    }
  });

  // Initial load
  fetchPublishedNovels();
});
