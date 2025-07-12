import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore();

async function createGroup(groupId) {
    const user = window.currentUser;
    if (!user) return alert("You must be logged in.");

    const groupRef = doc(db, "groups", groupId);
    await setDoc(groupRef, {
        name: groupId,
        createdBy: { uid: user.uid, displayName: user.displayName },
        members: {
            [user.uid]: {
                displayName: user.displayName,
                joinedAt: serverTimestamp()
            }
        }
    });
    handleGroupSelected(groupId);
}

async function joinGroup(groupId) {
    const user = window.currentUser;
    if (!user) return alert("You must be logged in.");

    const groupRef = doc(db, "groups", groupId);
    const snap = await getDoc(groupRef);
    if (!snap.exists()) return alert("Group does not exist.");

    await updateDoc(groupRef, {
        [`members.${user.uid}`]: {
            displayName: user.displayName,
            joinedAt: serverTimestamp()
        }
    });
    handleGroupSelected(groupId);
}

async function loadUserGroups(user) {
    const groupsRef = collection(db, "groups");
    const snap = await getDocs(groupsRef);
    const list = document.getElementById("group-list");
    list.innerHTML = "";

    snap.forEach(docSnap => {
        const group = docSnap.data();
        if (group.members && group.members[user.uid]) {
            const btn = document.createElement("button");
            btn.textContent = group.name;
            btn.addEventListener("click", () => handleGroupSelected(docSnap.id));
            list.appendChild(btn);
        }
    });
}

function handleGroupSelected(groupId) {
    localStorage.setItem("groupId", groupId);
    document.getElementById("current-group-label").textContent = groupId;
    document.dispatchEvent(new CustomEvent("group-ready", { detail: groupId }));
    showView("chores-view");
}

function showView(viewId) {
    document.querySelectorAll(".view").forEach(div => {
        div.style.display = div.id === viewId ? "block" : "none";
    });
}

document.addEventListener("user-ready", (e) => {
    loadUserGroups(e.detail);
});

document.getElementById("create-group-btn").addEventListener("click", () => {
    const id = document.getElementById("group-id-input").value.trim();
    if (id) createGroup(id);
    else alert("Please enter a group ID");
});

document.getElementById("join-group-btn").addEventListener("click", () => {
    const id = document.getElementById("group-id-input").value.trim();
    if (id) joinGroup(id);
    else alert("Please enter a group ID");
});
