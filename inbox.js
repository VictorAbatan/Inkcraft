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
    const sysList = document.getElementById('notification-list');
    const commentList = document.getElementById('comment-notification-list');
    sysList.innerHTML = '<li>Loading notifications...</li>';
    commentList.innerHTML = '<li>Loading comments...</li>';

    try {
      // ✅ Fetch both collections
      const notifQuery = query(collection(db, `users/${uid}/notifications`), orderBy('timestamp', 'desc'));
      const inboxQuery = query(collection(db, `users/${uid}/inbox`), orderBy('timestamp', 'desc'));

      const [notifSnap, inboxSnap] = await Promise.all([getDocs(notifQuery), getDocs(inboxQuery)]);

      // Merge
      const allMessages = [];
      notifSnap.forEach(doc => allMessages.push(doc.data()));
      inboxSnap.forEach(doc => allMessages.push(doc.data()));

      if (allMessages.length === 0) {
        sysList.innerHTML = '<li>No notifications yet.</li>';
        commentList.innerHTML = '<li>No comments yet.</li>';
        return;
      }

      // Sort by timestamp (desc)
      allMessages.sort((a, b) => {
        const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
        const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
        return bTime - aTime;
      });

      sysList.innerHTML = '';
      commentList.innerHTML = '';

      allMessages.forEach(notif => {
        const li = document.createElement('li');

        let typeLabel = '';
        switch (notif.type) {
          case 'comment': typeLabel = 'New Comment'; break;
          case 'reply': typeLabel = 'New Reply'; break;
          case 'approval': typeLabel = 'Book Approved'; break;
          case 'rejection': typeLabel = 'Book Rejected'; break;
          case 'pending': typeLabel = 'Submission Pending'; break;
          case 'rollback': typeLabel = 'Submission Rolled Back'; break;
          default: typeLabel = notif.type ? notif.type.charAt(0).toUpperCase() + notif.type.slice(1) : 'Notification';
        }

        // Format timestamp
        const timeStr = notif.timestamp?.toDate ? new Date(notif.timestamp.toDate()).toLocaleString() : '';

        if (notif.type === 'comment' || notif.type === 'reply') {
          // Comments go in Reader Comments section
          const novelLink = notif.novelId
            ? `novel-details.html?novelId=${notif.novelId}#commentsTab`
            : '#';
          li.innerHTML = `
            <a href="${novelLink}" class="notif-link">
              <strong>${typeLabel}</strong> — ${notif.message || 'New activity on your novel'}
            </a>
            <br><small>${timeStr}</small>
          `;
          commentList.appendChild(li);
        } else {
          // System notifications
          li.innerHTML = `
            <strong>${typeLabel}</strong> — ${notif.message || ''}
            <br><small>${timeStr}</small>
          `;
          sysList.appendChild(li);
        }
      });

      if (!sysList.hasChildNodes()) sysList.innerHTML = '<li>No notifications yet.</li>';
      if (!commentList.hasChildNodes()) commentList.innerHTML = '<li>No comments yet.</li>';

    } catch (err) {
      console.error('Error loading notifications:', err);
      sysList.innerHTML = '<li>Error loading notifications.</li>';
      commentList.innerHTML = '<li>Error loading comments.</li>';
    }
  });
});
