import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const profilePicInput = document.getElementById('profile-pic');
const previewPic = document.getElementById('preview-pic');
const penNameInput = document.getElementById('pen-name');
const saveBtn = document.getElementById('save-btn');

let currentUser = null;
let selectedFile = null;
const fallbackAuthorAvatar = 'https://upload.wikimedia.org/wikipedia/commons/9/99/Sample_User_Icon.png';

// --- Helper function to safely get image from Storage or fallback ---
async function getAuthorImage(data) {
  if (data.profilePicPath) {
    try {
      return await getDownloadURL(ref(storage, data.profilePicPath));
    } catch {
      return data.photoURL || data.profileImage || fallbackAuthorAvatar;
    }
  }
  return data.photoURL || data.profileImage || fallbackAuthorAvatar;
}

// ✅ Preview selected image
profilePicInput.addEventListener('change', (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile) {
    previewPic.src = URL.createObjectURL(selectedFile);
  }
});

// ✅ Load user data when authenticated
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  currentUser = user;

  const docRef = doc(db, 'authors', user.uid); // Always use UID as ID
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    penNameInput.value = data.penName || '';
    previewPic.src = await getAuthorImage(data);
  } else {
    previewPic.src = fallbackAuthorAvatar;
  }
});

// ✅ Save profile data
saveBtn.addEventListener('click', async () => {
  try {
    if (!currentUser) {
      alert('Not authenticated');
      return;
    }

    const penName = penNameInput.value.trim();
    if (!penName) {
      alert('Please enter a pen name.');
      return;
    }

    let profilePicURL = null;
    let profilePicPath = null;

    if (selectedFile) {
      profilePicPath = `authorProfiles/${currentUser.uid}/profile-pic`;
      const fileRef = ref(storage, profilePicPath);

      try {
        await uploadBytes(fileRef, selectedFile);
        profilePicURL = await getDownloadURL(fileRef);
        console.log('✅ Image uploaded:', profilePicURL);
      } catch (uploadErr) {
        console.error('❌ Upload failed:', uploadErr);
        alert('Upload failed. Check your internet, image format, or Firebase Storage settings.');
        return;
      }
    } else {
      // Reuse existing image if available
      const docSnap = await getDoc(doc(db, 'authors', currentUser.uid));
      if (docSnap.exists()) {
        const data = docSnap.data();
        profilePicURL = await getAuthorImage(data);
        profilePicPath = data.profilePicPath || null;
      }
    }

    // ✅ Save pen name + profile pic URL + path
    await setDoc(
      doc(db, 'authors', currentUser.uid),
      {
        penName,
        profilePicURL,
        profilePicPath
      },
      { merge: true } // <-- Prevents overwriting other fields
    );

    alert('Profile updated successfully!');
    window.location.href = 'author-centre.html';
  } catch (error) {
    console.error('❌ Error saving profile:', error);
    alert('Failed to save profile. Try again.');
  }
});
