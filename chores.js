import { getFirestore, collection, serverTimestamp, updateDoc, getDocs, addDoc, doc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore();

export async function createChore(groupId, choreName) {
    const choresRef = collection(db, "groups", groupId, "chores");
    await addDoc(choresRef, {
        name: choreName,
        lastDone: null,
        doneBy: null
    });
}

export async function markChoreDone(groupId, choreId, user) {
    const choreRef = doc(db, "groups", groupId, "chores", choreId);
    await updateDoc(choreRef, {
        lastDone: serverTimestamp(),
        doneBy: {
            uid: user.uid,
            displayName: user.displayName
        }
    });
}

export async function loadChores(groupId, renderFn) {
    const choresSnap = await getDocs(collection(db, "groups", groupId, "chores"));
    const chores = [];
    choresSnap.forEach(doc => chores.push({ id: doc.id, ...doc.data() }));
    renderFn(chores);
}
