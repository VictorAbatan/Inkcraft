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

document.addEventListener('DOMContentLoaded', async () => {

  // -----------------------------
  // 1️⃣ Load floating menu first
  // -----------------------------
  const loadFloatingMenu = async () => {
    const container = document.getElementById('floating-menu-container');
    if (!container) return;

    try {
      const res = await fetch('author-floating-menu.html');
      const html = await res.text();
      container.innerHTML = html;

      const items = container.querySelectorAll('.menu-item');
      // Use requestAnimationFrame to animate menu items
      items.forEach((item, index) => {
        requestAnimationFrame(() => setTimeout(() => item.classList.add('show'), index * 300));
      });

      const currentPath = window.location.pathname.split('/').pop().toLowerCase();
      container.querySelectorAll('a').forEach(link => {
        if (link.getAttribute('href').toLowerCase() === currentPath) {
          link.classList.add('active');
        }
      });
    } catch (err) {
      console.error('Error loading floating menu:', err);
    }
  };

  await loadFloatingMenu(); // Ensure menu is fully loaded before inbox

  // -----------------------------
  // 2️⃣ Load inbox if logged in
  // -----------------------------
  const auth = getAuth(app);
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    const uid = user.uid;

    const sysList = document.getElementById('notification-list');
    const commentList = document.getElementById('comment-notification-list');
    const sysBadge = document.getElementById('sys-badge');
    const commentBadge = document.getElementById('comment-badge');

    sysList.classList.add('mobile-list');
    commentList.classList.add('mobile-list');

    sysList.textContent = '';
    commentList.textContent = '';

    try {
      const inboxQuery = query(
        collection(db, `users/${uid}/inbox`),
        orderBy('timestamp', 'desc')
      );
      const inboxSnap = await getDocs(inboxQuery);

      if (inboxSnap.empty) {
        const liSys = document.createElement('li');
        liSys.textContent = 'No notifications yet.';
        sysList.appendChild(liSys);

        const liComment = document.createElement('li');
        liComment.textContent = 'No comments yet.';
        commentList.appendChild(liComment);

        sysBadge.textContent = 0;
        commentBadge.textContent = 0;
        return;
      }

      let sysCount = 0;
      let commentCount = 0;

      inboxSnap.forEach(doc => {
        const notif = doc.data();

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

        const timeStr = notif.timestamp?.toDate
          ? new Date(notif.timestamp.toDate()).toLocaleString()
          : 'Unknown time';

        // Create <li> dynamically
        const li = document.createElement('li');
        li.classList.add('mobile-list');

        const strong = document.createElement('strong');
        strong.textContent = typeLabel;

        const text = document.createTextNode(` — ${notif.message || ''}`);
        const br = document.createElement('br');
        const small = document.createElement('small');
        small.textContent = timeStr;

        if (notif.type === 'comment' || notif.type === 'reply') {
          const a = document.createElement('a');
          a.classList.add('notif-link');
          a.href = notif.novelId ? `novel-details.html?novelId=${notif.novelId}#commentsTab` : '#';
          a.appendChild(strong);
          a.appendChild(text);

          li.appendChild(a);
          li.appendChild(br.cloneNode());
          li.appendChild(small);
          commentList.appendChild(li);
          commentCount++;
        } else {
          li.appendChild(strong);
          li.appendChild(text);
          li.appendChild(br.cloneNode());
          li.appendChild(small);
          sysList.appendChild(li);
          sysCount++;
        }
      });

      // Force repaint to avoid mobile flicker
      requestAnimationFrame(() => {
        sysBadge.textContent = sysCount;
        commentBadge.textContent = commentCount;
      });

    } catch (err) {
      const liSys = document.createElement('li');
      liSys.textContent = 'Error loading notifications.';
      sysList.appendChild(liSys);

      const liComment = document.createElement('li');
      liComment.textContent = 'Error loading comments.';
      commentList.appendChild(liComment);

      sysBadge.textContent = 0;
      commentBadge.textContent = 0;
    }
  });

  // -----------------------------
  // 3️⃣ Dropdown toggle logic
  // -----------------------------
  document.addEventListener('click', e => {
    if (e.target.classList.contains('dropdown-toggle')) {
      const toggle = e.target;
      const content = toggle.nextElementSibling;
      toggle.classList.toggle('active');
      content.classList.toggle('open');
    }
  });
});
