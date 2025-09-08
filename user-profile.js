import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

document.addEventListener("DOMContentLoaded", () => {
  const profilePic = document.getElementById("profile-pic");
  const profilePicInput = document.getElementById("profile-pic-input");
  const displayNameInput = document.getElementById("display-name");
  const saveBtn = document.getElementById("save-profile");

  let tempPhotoURL = null; // Temporary preview URL

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      alert("You must be logged in to view your profile.");
      window.location.href = "login.html";
      return;
    }

    // Firestore references
    const userRef = doc(db, "users", user.uid);
    const authorRef = doc(db, "authorProfiles", user.uid);

    const [userSnap, authorSnap] = await Promise.all([getDoc(userRef), getDoc(authorRef)]);

    // Determine which document to use
    const activeRef = authorSnap.exists() ? authorRef : userRef;
    const data = (authorSnap.exists() ? authorSnap.data() : userSnap.data()) || {};

    // --- ✅ Load initial data with fallbacks ---
    if (data.displayName) {
      displayNameInput.value = data.displayName;
    } else if (data.username) {
      displayNameInput.value = data.username; // fallback to username if no displayName
    } else {
      displayNameInput.value = user.email; // fallback to email
    }

    if (data.photoURL) {
      profilePic.src = data.photoURL;
    } else if (data.profileImage) {
      profilePic.src = data.profileImage; // support "profileImage"
    } else {
      profilePic.src = "https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png"; // 👤 placeholder
    }

    // Handle profile picture preview & upload
    profilePicInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Immediate preview using local URL
      const localURL = URL.createObjectURL(file);
      profilePic.src = localURL;
      tempPhotoURL = localURL; // store temporary preview

      // Upload to Firebase
      const storagePath = activeRef.path.includes("authorProfiles")
        ? `authorProfiles/${user.uid}/profilePic.jpg`
        : `users/${user.uid}/profilePic.jpg`;

      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firestore with both fields
      await updateDoc(activeRef, { 
        photoURL: downloadURL,
        profileImage: downloadURL 
      }).catch(async () => {
        await setDoc(activeRef, { 
          photoURL: downloadURL,
          profileImage: downloadURL 
        }, { merge: true });
      });

      tempPhotoURL = downloadURL; // update preview to final uploaded URL
    });

    // Handle save profile
    saveBtn.addEventListener("click", async () => {
      const name = displayNameInput.value.trim();
      if (!name) {
        alert("Please enter a display name.");
        return;
      }

      // ✅ Save displayName + username + photoURL + profileImage
      await setDoc(
        activeRef,
        { 
          displayName: name,
          username: name,  // 👈 keep username in sync
          photoURL: tempPhotoURL || profilePic.src,
          profileImage: tempPhotoURL || profilePic.src
        },
        { merge: true }
      );

      alert("Profile updated successfully!");
      // ✅ Redirect back to Inkcraftmain so updates show
      window.location.href = "Inkcraftmain.html";
    });
  });
});
