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

  // ✅ Helper to fetch image with fallback
  async function getImageURL(storagePath, fallback) {
    if (storagePath) {
      try {
        const storageRef = ref(storage, storagePath);
        const url = await getDownloadURL(storageRef);
        return url;
      } catch {
        // Ignore error, fallback will be used
      }
    }
    return fallback;
  }

  // ✅ Fetch novels (approved only) with cached author names and batch image fetching
  async function fetchPublishedNovels() {
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

      // Resolve author name with cache
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

      // Get cover image with fallback
      const coverURL = await getImageURL(data.coverPath, data.coverUrl || 'default-cover.jpg');

      return {
        id: docSnap.id,
        title: data.title || 'Untitled',
        cover: coverURL,
        author: authorName
      };
    });

    allBooks = await Promise.all(promises);
    renderBooks(allBooks);
  }

  function renderBooks(list) {
    catalog.innerHTML = '';
    list.forEach((book, index) => {
      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-item';
      bookDiv.style.animationDelay = `${index * 50}ms`; // slightly faster stagger

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
