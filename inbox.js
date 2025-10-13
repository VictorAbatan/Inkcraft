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
import { subscribeUnreadCounts } from './notifications.js';

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

  await loadFloatingMenu();

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

    // -------------------------
    // Delete buttons (with icon)
    // -------------------------
    const createDeleteControls = (list) => {
      const iconBtn = document.createElement('button');
      iconBtn.classList.add('delete-toggle');
      iconBtn.innerHTML = '<i class="fas fa-trash"></i>';

      const label = document.createElement('span');
      label.textContent = ' Delete Selected';
      label.style.display = 'none';
      label.classList.add('delete-label');

      const wrapper = document.createElement('div');
      wrapper.classList.add('delete-wrapper');
      wrapper.appendChild(iconBtn);
      wrapper.appendChild(label);

      list.parentElement.prepend(wrapper);
      return { iconBtn, label };
    };

    const sysControls = createDeleteControls(sysList);
    const commentControls = createDeleteControls(commentList);

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
          li.dataset.docId = docSnap.id;

          // ✅ Distinguish unread vs read
          if (notif.read) {
            li.classList.add('read');
            li.classList.remove('unread', 'new');
          } else {
            li.classList.add('unread', 'new');
            li.classList.remove('read');
            setTimeout(() => li.classList.remove('new'), 1200);

            // Add subtle hint text for unread notifications
            const hint = document.createElement('small');
            hint.classList.add('mark-hint');
            hint.textContent = 'Click/tap to mark as read';
            li.appendChild(hint);
          }

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

          // ✅ Comment handler
          if (notif.type === 'comment' || notif.type === 'reply') {
            const a = document.createElement('a');
            a.classList.add('notif-link');

            if (notif.novelId && notif.chapterId) {
              a.href = `read-novel.html?novelId=${notif.novelId}&chapterId=${notif.chapterId}#comments`;
            } else if (notif.novelId) {
              a.href = `novel-details.html?novelId=${notif.novelId}`;
            } else {
              a.href = '#';
            }

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
      // ✅ New: Mark single notification as read on click/tap
      // -------------------------
      document.addEventListener('click', async e => {
        const li = e.target.closest('li');
        if (!li || !li.dataset.docId) return;
        if (e.target.classList.contains('delete-checkbox')) return;

        const docRef = doc(db, `users/${uid}/inbox`, li.dataset.docId);
        const isUnread = li.classList.contains('unread');

        if (isUnread) {
          await updateDoc(docRef, { read: true });
          li.classList.add('read');
          li.classList.remove('unread', 'new');
          const hint = li.querySelector('.mark-hint');
          if (hint) hint.remove();
        }
      });

      // -------------------------
      // Enhanced Delete Mode Logic
      // -------------------------
      const setupDeleteMode = (listEl, iconBtn, labelEl) => {
        let deleteMode = false;

        iconBtn.addEventListener('click', async () => {
          const checked = listEl.querySelectorAll('.delete-checkbox:checked');

          if (deleteMode && checked.length > 0) {
            for (const cb of checked) {
              const li = cb.closest('li');
              const docId = li.dataset.docId;
              li.remove();
              if (docId) await deleteDoc(doc(db, `users/${uid}/inbox`, docId));
            }
            deleteMode = false;
            labelEl.style.display = 'none';
            listEl.querySelectorAll('.delete-checkbox').forEach(cb => cb.remove());
            listEl.querySelectorAll('li').forEach(li => li.classList.remove('delete-mode'));
            return;
          }

          deleteMode = !deleteMode;
          labelEl.style.display = deleteMode ? 'inline-block' : 'none';

          listEl.querySelectorAll('li').forEach(li => {
            li.classList.toggle('delete-mode', deleteMode);
            if (deleteMode && !li.querySelector('.delete-checkbox')) {
              const cb = document.createElement('input');
              cb.type = 'checkbox';
              cb.classList.add('delete-checkbox');
              li.prepend(cb);
            } else if (!deleteMode) {
              const cb = li.querySelector('.delete-checkbox');
              if (cb) cb.remove();
            }
          });
        });
      };

      setupDeleteMode(sysList, sysControls.iconBtn, sysControls.label);
      setupDeleteMode(commentList, commentControls.iconBtn, commentControls.label);

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
