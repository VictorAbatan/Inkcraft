import { app, db } from './firebase-config.js';
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const auth = getAuth(app);

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const userId = user.uid;
    const userRef = doc(db, `users/${userId}`);

    let displayName = "Author";
    let photoUrl = "https://ui-avatars.com/api/?name=A&background=000&color=fff";

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.displayName) displayName = data.displayName;
        if (data.photoUrl) photoUrl = data.photoUrl;
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
    }

    // Build identity UI
    const wrapper = document.createElement('div');
    wrapper.id = 'author-info-wrapper';

    wrapper.innerHTML = `
      <div id="author-info">
        <img src="${photoUrl}" alt="Profile Picture" />
        <span>${displayName}</span>
        <div id="author-dropdown">
          <a href="edit-author-profile.html">Edit Profile</a>
        </div>
      </div>
    `;

    document.body.appendChild(wrapper);
  });
});
