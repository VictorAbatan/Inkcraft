import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initNotificationBadge } from './notifications.js'; 

// === 1. Active Link Highlight ===
document.addEventListener("DOMContentLoaded", () => {
  const currentPage = window.location.pathname.split("/").pop();
  const menuItems = document.querySelectorAll(".floating-menu .menu-item");

  menuItems.forEach(item => {
    const link = item.getAttribute("href");
    if (link && link.includes(currentPage)) {
      item.classList.add("active");
    }
  });
});

// === 2. Inbox Badge (hook into reusable notifications.js) ===
onAuthStateChanged(auth, (user) => {
  if (!user) return;

  // ✅ Pass IDs/selectors as strings (not DOM elements)
  initNotificationBadge(user.uid, "inbox-badge", ".menu-item.inbox-link");
});
