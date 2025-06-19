document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
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

  // Verse book entries
  const verseBooks = [
    {
      title: "Psalms of Time",
      cover: "Psalms of Time.jpeg",
      link: "verse1.html"
    },
    {
      title: "The Grand Cosmos",
      cover: "The Grand Cosmos.jpg",
      link: "verse2.html"
    },
    {
      title: "The Discoveries Pantheon",
      cover: "The Discoveries Pantheon.jpg",
      link: "verse3.html"
    },
    {
      title: "The Infinite Library",
      cover: "Infinite library.jpg",
      link: "verse4.html"
    },
      {
      title: "BlackScrolls",
      cover: "BlackScrolls.jpg",
      link: "verse5.html"
    },
      {
      title: "Aeonic Crucible",
      cover: "Aeonic Crucible.jpg",
      link: "verse6.html"
    }
    
    // Add more as needed
  ];

  const catalog = document.getElementById('verseCatalog');

  verseBooks.forEach((book, index) => {
    const item = document.createElement('div');
    item.className = 'verse-item';
    item.style.animationDelay = `${index * 100}ms`; // staggered effect
    item.innerHTML = `
      <img src="${book.cover}" alt="${book.title}">
      <h3>${book.title}</h3>
    `;
    item.addEventListener('click', () => {
      window.location.href = book.link;
    });
    catalog.appendChild(item);
  });
});
