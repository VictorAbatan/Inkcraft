document.addEventListener('DOMContentLoaded', () => {
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

  const books = [
    { title: "Bad Omen", cover: "Bad Omen.jpg", page: "book1.html" },
    { title: "Beyond Calamity", cover: "Beyond Calamity.jpg", page: "book2.html" },
    { title: "Becoming a God again", cover: "Becoming a God again.jpg", page: "book3.html" },
    { title: "The Vagabond's Gaze", cover: "The Vagabond's Gaze.jpg", page: "book4.html" },
    { title: "Chaosborne", cover: "Chaosborne.jpg", page: "book5.html" },
    { title: "Conundrum", cover: "Conundrum.jpg", page: "book6.html" },
    { title: "On the run", cover: "On the run.jpeg", page: "book7.html" },
    { title: "Requiem", cover: "Requiem.jpeg", page: "book8.html" },
    { title: "Voyage of Mysteries", cover: "voyage of mysteries.jpg", page: "book9.html" },
    { title: "Voyage of Mysteries 2", cover: "voyage of mysteries 2.jpg", page: "book10.html" },
    { title: "Crimson & Furs", cover: "crimson&furs.jpg", page: "book11.html" },
    { title: "Crimson & Furs 2", cover: "crimson&furs2.jpg", page: "book12.html" },
    { title: "Creepy Diaries", cover: "creepy diaries.jpg", page: "book13.html" },
  ];

  const catalog = document.getElementById('bookCatalog');

  function renderBooks(list) {
    catalog.innerHTML = '';
    list.forEach((book, index) => {
      const bookDiv = document.createElement('div');
      bookDiv.className = 'book-item';
      bookDiv.style.animationDelay = `${index * 100}ms`; // stagger animation

      bookDiv.innerHTML = `
        <img src="${book.cover}" alt="${book.title}">
        <div class="book-label">${book.title}</div>
      `;

      bookDiv.addEventListener('click', () => {
        window.location.href = book.page;
      });

      catalog.appendChild(bookDiv);
    });
  }

  renderBooks(books);

  // Live search
  const searchInput = document.getElementById('searchInput');

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();

    if (query === '') {
      renderBooks(books); // Reset catalog
    } else {
      const filtered = books.filter(book =>
        book.title.toLowerCase().includes(query)
      );
      renderBooks(filtered);
    }
  });
});
