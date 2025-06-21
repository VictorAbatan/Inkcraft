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

  const docRef = doc(db, 'authors', user.uid);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    penNameInput.value = data.penName || '';
    if (data.profilePicURL) {
      previewPic.src = data.profilePicURL;
    }
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

    if (selectedFile) {
      const fileRef = ref(storage, `authorProfiles/${currentUser.uid}/profile-pic`);
      
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
      const docRef = doc(db, 'authors', currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        profilePicURL = docSnap.data().profilePicURL || null;
      }
    }

    await setDoc(doc(db, 'authors', currentUser.uid), {
      penName,
      profilePicURL
    });

    alert('Profile updated successfully!');
    window.location.href = 'author-centre.html';
  } catch (error) {
    console.error('❌ Error saving profile:', error);
    alert('Failed to save profile. Try again.');
  }
});
