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
      // ✅ Fetch both notifications and inbox messages
      const notifQuery = query(collection(db, `users/${uid}/notifications`), orderBy('timestamp', 'desc'));
      const inboxQuery = query(collection(db, `users/${uid}/inbox`), orderBy('timestamp', 'desc'));

      const [notifSnap, inboxSnap] = await Promise.all([getDocs(notifQuery), getDocs(inboxQuery)]);

      // Merge both collections into one array
      const allMessages = [];
      notifSnap.forEach(doc => allMessages.push(doc.data()));
      inboxSnap.forEach(doc => allMessages.push(doc.data()));

      if (allMessages.length === 0) {
        list.innerHTML = '<li>No notifications yet.</li>';
        return;
      }

      // Sort merged messages by timestamp
      allMessages.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return bTime - aTime; // newest first
      });

      list.innerHTML = '';
      allMessages.forEach(notif => {
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
        let content = `
          <strong>${typeLabel}</strong> — ${notif.message || ''}
          <br><small>${notif.timestamp?.toDate ? new Date(notif.timestamp.toDate()).toLocaleString() : ''}</small>
        `;

        // If it's a comment, make it clickable (redirect to novel-details comments tab)
        if ((notif.type === 'comment' || notif.type === 'reply') && notif.novelId) {
          const novelLink = `novel-details.html?novelId=${notif.novelId}#commentsTab`;
          content = `
            <a href="${novelLink}" class="notif-link">
              <strong>${typeLabel}</strong> — ${notif.message || 'New activity on your novel'}
            </a>
            <br><small>${notif.timestamp?.toDate ? new Date(notif.timestamp.toDate()).toLocaleString() : ''}</small>
          `;
        }

        li.innerHTML = content;
        list.appendChild(li);
      });
    } catch (err) {
      console.error('Error loading notifications:', err);
      list.innerHTML = '<li>Error loading notifications.</li>';
    }
  });
});
