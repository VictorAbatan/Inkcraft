import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  getDocs,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  // Load floating menu
  fetch('author-floating-menu.html')
    .then(res => res.text())
    .then(html => {
      const container = document.getElementById('floating-menu-container');
      if (container) {
        container.innerHTML = html;

        const items = container.querySelectorAll('.menu-item');
        items.forEach((item, index) => {
          setTimeout(() => item.classList.add('show'), index * 300);
        });

        const currentPath = window.location.pathname.split('/').pop().toLowerCase();
        container.querySelectorAll('a').forEach(link => {
          if (link.getAttribute('href').toLowerCase() === currentPath) {
            link.classList.add('active');
          }
        });
      }
    });

  // Load notifications if logged in
  const auth = getAuth(app);
  onAuthStateChanged(auth, async user => {
    if (!user) {
      alert("You must be logged in to view your inbox.");
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;
    const list = document.getElementById('notification-list');
    list.innerHTML = '<li>Loading notifications...</li>';

    try {
      const q = query(collection(db, `users/${uid}/notifications`), orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        list.innerHTML = '<li>No notifications yet.</li>';
        return;
      }

      list.innerHTML = '';
      snapshot.forEach(doc => {
        const notif = doc.data();
        const li = document.createElement('li');

        // Format message type
        let typeLabel = '';
        switch (notif.type) {
          case 'comment':
            typeLabel = 'New Comment';
            break;
          case 'reply':
            typeLabel = 'New Reply';
            break;
          case 'approval':
            typeLabel = 'Book Approved';
            break;
          case 'rejection':
            typeLabel = 'Book Rejected';
            break;
          default:
            typeLabel = notif.type ? notif.type.charAt(0).toUpperCase() + notif.type.slice(1) : 'Notification';
        }

        // Render notification
        li.innerHTML = `
          <strong>${typeLabel}</strong> — ${notif.message || ''}
          <br><small>${notif.timestamp?.toDate ? new Date(notif.timestamp.toDate()).toLocaleString() : ''}</small>
        `;

        list.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading notifications:', err);
      list.innerHTML = '<li>Error loading notifications.</li>';
    }
  });
});
