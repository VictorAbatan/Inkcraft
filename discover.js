import { app, db } from './firebase-config.js';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  orderBy,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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

  // ✅ Fetch novels (only approved, prefer authorName from novel doc itself)
  async function fetchPublishedNovels() {
    const q = query(
      collection(db, 'novels'),
      where("status", "==", "approved"),
      orderBy('title')
    );
    const snapshot = await getDocs(q);

    allBooks = [];
    const authorCache = new Map();

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();

      // ✅ Use authorName from the novel document if it exists
      let authorName = data.authorName || 'Unknown Author';

      // Optionally, if you also want to cross-check with users/{id}
      if (!data.authorName && data.authorId) {
        if (authorCache.has(data.authorId)) {
          authorName = authorCache.get(data.authorId);
        } else {
          const userDoc = await getDoc(doc(db, 'users', data.authorId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            authorName = userData.authorName || userData.penName || 'Unknown Author';
            authorCache.set(data.authorId, authorName);
          }
        }
      }

      allBooks.push({
        id: docSnap.id,
        title: data.title || 'Untitled',
        cover: data.cover || data.coverUrl || 'default-cover.jpg',
        author: authorName
      });
    }

    renderBooks(allBooks);
  }

  function renderBooks(list) {
    catalog.innerHTML = '';
    list.forEach((book, index) => {
      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-item';
      bookDiv.style.animationDelay = `${index * 100}ms`;

      bookDiv.innerHTML = `
        <img src="${book.cover}" alt="${book.title}">
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
