import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore();

async function createGroup(groupId) {
    const user = window.currentUser;
    if (!user) {
        alert("You must be logged in to create a group.");
        return;
    }
    try {
        console.log("Creating group:", groupId);
        const groupRef = doc(db, "groups", groupId);
        await setDoc(groupRef, {
            name: groupId,
            createdBy: {
                uid: user.uid,
                displayName: user.displayName
            },
            members: {
                [user.uid]: {
                    displayName: user.displayName,
                    joinedAt: serverTimestamp()
                }
            }
        });
        localStorage.setItem("groupId", groupId);
        document.getElementById("current-group-label").textContent = `Group: ${groupId}`;
        document.dispatchEvent(new CustomEvent("group-ready", { detail: groupId }));
        console.log("Group created successfully");
    } catch (e) {
        console.error("Failed to create group:", e);
        alert("Failed to create group: " + e.message);
    }
}

async function joinGroup(groupId) {
    const user = window.currentUser;
    if (!user) {
        alert("You must be logged in to join a group.");
        return;
    }
    try {
        console.log("Joining group:", groupId);
        const groupRef = doc(db, "groups", groupId);
        const snap = await getDoc(groupRef);
        if (!snap.exists()) {
            alert("Group does not exist.");
            return;
        }
        await updateDoc(groupRef, {
            [`members.${user.uid}`]: {
                displayName: user.displayName,
                joinedAt: serverTimestamp()
            }
        });
        localStorage.setItem("groupId", groupId);
        document.getElementById("current-group-label").textContent = `Group: ${groupId}`;
        document.dispatchEvent(new CustomEvent("group-ready", { detail: groupId }));
        console.log("Joined group successfully");
    } catch (e) {
        console.error("Failed to join group:", e);
        alert("Failed to join group: " + e.message);
    }
}

// Load all groups the user is a member of and populate the dropdown
async function loadUserGroups(user) {
    const groupsRef = collection(db, "groups");
    const snap = await getDocs(groupsRef);
    const select = document.getElementById("group-select");
    select.innerHTML = `<option value="">-- Select a group --</option>`;

    snap.forEach(docSnap => {
        const group = docSnap.data();
        if (group.members && group.members[user.uid]) {
            const option = document.createElement("option");
            option.value = docSnap.id;
            option.textContent = group.name;
            select.appendChild(option);
        }
    });
}

// On auth state ready, populate group dropdown
document.addEventListener("user-ready", (e) => {
    loadUserGroups(e.detail);
});

// When user selects a group
document.getElementById("group-select").addEventListener("change", (e) => {
    const selectedGroupId = e.target.value;
    if (selectedGroupId) {
        localStorage.setItem("groupId", selectedGroupId);
        document.getElementById("current-group-label").textContent = `Group: ${selectedGroupId}`;
        document.dispatchEvent(new CustomEvent("group-ready", { detail: selectedGroupId }));
    }
});

// Add event listeners to buttons
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
