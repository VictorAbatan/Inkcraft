import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('author-floating-menu.html')
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
      return response.text();
    })
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (!container) return;

      container.innerHTML = html;

      const menuItems = container.querySelectorAll('.floating-menu .menu-item');
      menuItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 0.2}s`;
        item.classList.add('show');
      });

      const currentPage = window.location.pathname.split('/').pop().toLowerCase();

      container.querySelectorAll('.floating-menu a').forEach(link => {
        const href = link.getAttribute('href').toLowerCase();
        if (href === currentPage) {
          link.classList.add('active');
        }
      });
    })
    .catch(error => console.error('Error loading floating menu:', error));

  // === Profile pic & pen name load ===
  const profilePicElement = document.getElementById('author-profile-pic');
  const penNameElement = document.getElementById('author-pen-name');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html'; // redirect if not logged in
      return;
    }
    
    const docRef = doc(db, 'authors', user.uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();

      // Update pen name label
      if (data.penName) {
        penNameElement.textContent = data.penName;
      }

      // Update profile pic src if available
      if (data.profilePicURL) {
        profilePicElement.src = data.profilePicURL;
      }
    }
  });
});
