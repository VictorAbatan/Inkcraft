import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { markAsRead, subscribeUnreadCounts } from './notifications.js';

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

    // Add delete mode buttons
    const sysDeleteBtn = document.createElement('button');
    sysDeleteBtn.textContent = 'Delete';
    sysDeleteBtn.classList.add('delete-toggle');
    sysList.parentElement.prepend(sysDeleteBtn);

    const commentDeleteBtn = document.createElement('button');
    commentDeleteBtn.textContent = 'Delete';
    commentDeleteBtn.classList.add('delete-toggle');
    commentList.parentElement.prepend(commentDeleteBtn);

    const sysDeleteSelected = document.createElement('button');
    sysDeleteSelected.textContent = 'Delete Selected';
    sysDeleteSelected.style.display = 'none';
    sysDeleteSelected.classList.add('delete-selected');
    sysList.parentElement.prepend(sysDeleteSelected);

    const commentDeleteSelected = document.createElement('button');
    commentDeleteSelected.textContent = 'Delete Selected';
    commentDeleteSelected.style.display = 'none';
    commentDeleteSelected.classList.add('delete-selected');
    commentList.parentElement.prepend(commentDeleteSelected);

    try {
      const inboxQuery = query(
        collection(db, `users/${uid}/inbox`),
        orderBy('timestamp', 'desc')
      );

      onSnapshot(inboxQuery, (inboxSnap) => {
        sysList.textContent = '';
        commentList.textContent = '';

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

        inboxSnap.forEach(docSnap => {
          const notif = docSnap.data();
          const li = document.createElement('li');
          li.classList.add('mobile-list');
          li.dataset.docId = docSnap.id; // ✅ consistent data-doc-id

          if (notif.read) li.classList.add('read'); // dim read notifications

          const strong = document.createElement('strong');
          const typeLabel = notif.type
            ? notif.type.charAt(0).toUpperCase() + notif.type.slice(1)
            : 'Notification';
          strong.textContent = typeLabel;

          const text = document.createTextNode(` — ${notif.message || ''}`);
          const br = document.createElement('br');
          const small = document.createElement('small');
          small.textContent = notif.timestamp?.toDate
            ? new Date(notif.timestamp.toDate()).toLocaleString()
            : 'Unknown time';

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
            if (!notif.read) commentCount++;
          } else {
            li.appendChild(strong);
            li.appendChild(text);
            li.appendChild(br.cloneNode());
            li.appendChild(small);
            sysList.appendChild(li);
            if (!notif.read) sysCount++;
          }
        });

        sysBadge.textContent = sysCount;
        commentBadge.textContent = commentCount;
      });

      // -------------------------
      // Mark notifications as read
      // -------------------------
      document.addEventListener('click', async e => {
        const toggle = e.target.closest('.dropdown-toggle');
        if (!toggle) return;

        const toggles = [...document.querySelectorAll('.dropdown-toggle')];
        const index = toggles.indexOf(toggle);

        if (index === 0) {
          await markAsRead(uid, 'system');
          document.querySelectorAll('#notification-list li').forEach(li => li.classList.add('read'));
          sysBadge.textContent = 0;
        }
        if (index === 1) {
          await markAsRead(uid, 'comment');
          document.querySelectorAll('#comment-notification-list li').forEach(li => li.classList.add('read'));
          commentBadge.textContent = 0;
        }
      });

      // -------------------------
      // Delete mode toggle
      // -------------------------
      const setupDeleteMode = (listEl, toggleBtn, selectedBtn) => {
        toggleBtn.addEventListener('click', () => {
          listEl.querySelectorAll('li').forEach(li => {
            li.classList.toggle('delete-mode');
            if (li.classList.contains('delete-mode') && !li.querySelector('.delete-checkbox')) {
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.classList.add('delete-checkbox');
              li.prepend(cb);
            } else {
              const cb = li.querySelector('.delete-checkbox');
              if (cb) cb.remove();
            }
          });
          selectedBtn.style.display = selectedBtn.style.display === 'block' ? 'none' : 'block';
        });

        selectedBtn.addEventListener('click', async () => {
          const checked = listEl.querySelectorAll('.delete-checkbox:checked');
          for (const cb of checked) {
            const li = cb.closest('li');
            const docId = li.dataset.docId;
            li.remove();
            if (docId) await deleteDoc(doc(db, `users/${uid}/inbox`, docId));
          }
        });
      };

      setupDeleteMode(sysList, sysDeleteBtn, sysDeleteSelected);
      setupDeleteMode(commentList, commentDeleteBtn, commentDeleteSelected);

      // -------------------------
      // Real-time unread counts
      // -------------------------
      const unsubCounts = subscribeUnreadCounts(uid, ({ sysCount, commentCount }) => {
        if (sysBadge) sysBadge.textContent = sysCount;
        if (commentBadge) commentBadge.textContent = commentCount;
      });

      window.addEventListener('beforeunload', () => {
        if (typeof unsubCounts === 'function') unsubCounts();
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
