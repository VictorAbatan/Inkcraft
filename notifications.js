// notifications.js
// Reusable notification helpers for Inkcraft
import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  onSnapshot,
  doc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * getUnreadCounts(uid)
 * Returns an object: { sysCount, commentCount }
 * Counts documents where `read` is falsy (undefined or false).
 */
export async function getUnreadCounts(uid) {
  const inboxRef = collection(db, `users/${uid}/inbox`);
  const snap = await getDocs(inboxRef);

  let sysCount = 0;
  let commentCount = 0;

  snap.forEach(s => {
    const d = s.data();
    if (!d.read) {
      if (d.type === 'comment' || d.type === 'reply') commentCount++;
      else sysCount++;
    }
  });

  return { sysCount, commentCount };
}

/**
 * markAsRead(uid, type)
 * type = 'system' | 'comment'
 * Marks matching notifications as read (batched).
 */
export async function markAsRead(uid, type) {
  const batch = writeBatch(db);
  const inboxRef = collection(db, `users/${uid}/inbox`);
  const snap = await getDocs(inboxRef);

  snap.forEach(s => {
    const d = s.data();
    if (!d.read) {
      if (type === 'system' && d.type !== 'comment' && d.type !== 'reply') {
        batch.update(doc(db, `users/${uid}/inbox/${s.id}`), { read: true });
      } else if (type === 'comment' && (d.type === 'comment' || d.type === 'reply')) {
        batch.update(doc(db, `users/${uid}/inbox/${s.id}`), { read: true });
      }
    }
  });

  await batch.commit();
  return true;
}

/**
 * subscribeUnreadCounts(uid, callback)
 * Real-time subscription; callback receives { sysCount, commentCount }.
 * Returns the unsubscribe function from onSnapshot.
 */
export function subscribeUnreadCounts(uid, callback) {
  const inboxRef = collection(db, `users/${uid}/inbox`);
  const unsub = onSnapshot(inboxRef, snap => {
    let sysCount = 0;
    let commentCount = 0;

    snap.forEach(s => {
      const d = s.data();
      if (!d.read) {
        if (d.type === 'comment' || d.type === 'reply') commentCount++;
        else sysCount++;
      }
    });

    callback({ sysCount, commentCount });
  });

  return unsub;
}

/**
 * initNotificationBadge(badgeId, linkSelector)
 * Attaches a real-time listener to update a badge + link UI.
 */
export function initNotificationBadge(uid, badgeId, linkSelector) {
  const badge = document.getElementById(badgeId);
  const link = document.querySelector(linkSelector);

  if (!badge || !link) return;

  return subscribeUnreadCounts(uid, ({ sysCount, commentCount }) => {
    // Combine counts for total
    const totalCount = sysCount + commentCount;
    badge.textContent = totalCount;

    if (totalCount > 0) {
      badge.style.display = "inline-block";
      link.classList.add("has-notifications");

      // 🔔 bump animation
      badge.classList.add("bump");
      setTimeout(() => badge.classList.remove("bump"), 300);
    } else {
      badge.style.display = "none";
      link.classList.remove("has-notifications");
    }
  });
}
