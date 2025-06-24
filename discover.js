import { app, db } from './firebase-config.js';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy
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

  // Fetch published novels from Firestore
  async function fetchPublishedNovels() {
    const q = query(collection(db, 'novels'), where('status', '==', 'published'), orderBy('title'));
    const snapshot = await getDocs(q);
    allBooks = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      let authorName = 'Unknown Author';

      if (data.submittedBy) {
        try {
          const authorRef = doc(db, 'authors', data.submittedBy);
          const authorSnap = await getDoc(authorRef);
          if (authorSnap.exists()) {
            const authorData = authorSnap.data();
            authorName = authorData.name || authorName;
          }
        } catch (err) {
          console.warn(`Failed to fetch author for ${data.title}:`, err);
        }
      }

      allBooks.push({
        id: docSnap.id,
        title: data.title || 'Untitled',
        cover: data.cover || 'default-cover.jpg',
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
