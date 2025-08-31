import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  setDoc,
  doc,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

async function migrateAuthorsAndReferences() {
  console.log("Starting authors + references migration…");

  const authorsCol = collection(db, "authors");
  const snapshot = await getDocs(authorsCol);

  let updates = 0;

  for (const authorDoc of snapshot.docs) {
    const oldId = authorDoc.id;
    const data = authorDoc.data();
    const newId = data.uid; // use uid field as doc ID

    if (!newId) {
      console.warn(`Skipping author ${oldId} (no uid field)`);
      continue;
    }

    // ✅ Create a new doc with UID as ID
    const newDocRef = doc(db, "authors", newId);
    await setDoc(newDocRef, { ...data }, { merge: true });

    console.log(`Copied author ${oldId} → ${newId}`);

    // ✅ Update references in novels, series, verses
    await updateReferences("novels", oldId, newId);
    await updateReferences("series", oldId, newId);
    await updateReferences("verses", oldId, newId);

    updates++;
  }

  console.log(`Migration complete. Authors processed: ${updates}`);
  console.log(
    "NOTE: old author docs were NOT deleted (duplicates exist for safety)."
  );
}

async function updateReferences(collectionName, oldId, newId) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();

    if (data.authorId && data.authorId === oldId) {
      await updateDoc(docSnap.ref, { authorId: newId });
      console.log(
        `Updated ${collectionName}/${docSnap.id} authorId: ${oldId} → ${newId}`
      );
    }

    // If series/verse has multiple authors array
    if (Array.isArray(data.authors) && data.authors.includes(oldId)) {
      const newAuthors = data.authors.map((id) =>
        id === oldId ? newId : id
      );
      await updateDoc(docSnap.ref, { authors: newAuthors });
      console.log(
        `Updated ${collectionName}/${docSnap.id} authors array: ${oldId} → ${newId}`
      );
    }
  }
}

// Run
migrateAuthorsAndReferences().catch((err) =>
  console.error("Migration error:", err)
);
