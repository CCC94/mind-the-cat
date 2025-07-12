import {
    getFirestore,
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    collection,
    addDoc,
    query,
    onSnapshot as listenCollection
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

// Create a chore inside the selected group
async function createChore(groupId, choreName) {
    const ref = doc(db, "groups", groupId, "chores", choreName);
    await setDoc(ref, {
        name: choreName,
        lastDone: null,
        doneBy: null
    });
    console.log(`✅ Created chore: ${choreName}`);
}

// Render a chore item to the DOM
function renderChore(groupId, choreId, data) {
    const choreList = document.getElementById("chore-list");

    let div = document.getElementById(`chore-${choreId}`);
    if (!div) {
        div = document.createElement("div");
        div.className = "chore";
        div.id = `chore-${choreId}`;
        choreList.appendChild(div);
    }

    const lastDone = data.lastDone?.seconds
        ? new Date(data.lastDone.seconds * 1000).toLocaleString()
        : "Never";

    const who = data.doneBy?.displayName || "Unknown";

    div.innerHTML = `
        <p>📝 ${choreId}<br/>
        <span class="last-fed">Last done by ${who} at ${lastDone}</span></p>
        <button data-chore-btn="${choreId}">Done</button>
    `;

    div.querySelector("button").onclick = () => markChoreDone(groupId, choreId);
}

// Mark chore done
async function markChoreDone(groupId, choreId) {
    const user = auth.currentUser;
    if (!user) {
        alert("Sign in to mark chores.");
        return;
    }

    const ref = doc(db, "groups", groupId, "chores", choreId);
    await setDoc(ref, {
        lastDone: new Date(),
        doneBy: {
            uid: user.uid,
            displayName: user.displayName,
            photoURL: user.photoURL || null,
        },
    }, { merge: true });

    console.log(`🔄 ${choreId} marked done by ${user.displayName}`);
}

// Listen for all chores in a group
function listenToChores(groupId) {
    const q = collection(db, "groups", groupId, "chores");
    return listenCollection(q, (snapshot) => {
        document.getElementById("chore-list").innerHTML = ""; // clear existing
        snapshot.forEach(doc => {
            renderChore(groupId, doc.id, doc.data());
        });
    });
}

// When group is ready, start listening
document.addEventListener("group-ready", (event) => {
    const groupId = event.detail;
    listenToChores(groupId);
});

// Handle chore creation
document.getElementById("create-chore-btn").addEventListener("click", () => {
    const choreName = document.getElementById("new-chore-name").value.trim();
    const groupId = localStorage.getItem("groupId");
    if (!choreName || !groupId) {
        alert("Enter a chore name and select a group first.");
        return;
    }

    createChore(groupId, choreName);
    document.getElementById("new-chore-name").value = "";
});

// Auto-load saved group on page load
window.addEventListener("load", () => {
    const savedGroupId = localStorage.getItem("groupId");
    if (savedGroupId) {
        document.dispatchEvent(new CustomEvent("group-ready", { detail: savedGroupId }));
        document.getElementById("current-group-label").textContent = `Group: ${savedGroupId}`;
    }
});
