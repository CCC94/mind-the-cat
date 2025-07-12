import { createChore, markChoreDone, loadChores } from "./chores.js";

function showView(viewId) {
    document.querySelectorAll(".view").forEach(div => {
        div.style.display = div.id === viewId ? "block" : "none";
    });
}

document.addEventListener("group-ready", (e) => {
    const groupId = e.detail;
    loadChores(groupId, renderChores);
});

document.getElementById("create-chore-btn").addEventListener("click", () => {
    const choreName = document.getElementById("new-chore-name").value.trim();
    const groupId = localStorage.getItem("groupId");

    if (!choreName || !groupId) {
        alert("Enter a chore name and select a group first.");
        return;
    }

    createChore(groupId, choreName)
        .then(() => {
            loadChores(groupId, renderChores);
            document.getElementById("new-chore-name").value = "";
        })
        .catch(err => console.error("Failed to create chore:", err));
});

function renderChores(chores) {
    const container = document.getElementById("chore-list");
    container.innerHTML = "";

    if (chores.length === 0) {
        container.textContent = "No chores yet.";
        return;
    }

    chores.forEach(chore => {
        const div = document.createElement("div");
        div.className = "chore";
        div.innerHTML = `
      <p>${chore.name}<br/>
      <small>Last done: ${chore.lastDone ? new Date(chore.lastDone.seconds * 1000).toLocaleString() : "Never"}</small></p>
      <button data-chore-id="${chore.id}">Mark Done</button>
    `;

        div.querySelector("button").addEventListener("click", () => {
            const user = window.currentUser;
            const groupId = localStorage.getItem("groupId");

            if (!user) {
                alert("You must be logged in to mark chores as done.");
                return;
            }

            markChoreDone(groupId, chore.id, user)
                .then(() => loadChores(groupId, renderChores))
                .catch(err => console.error("Failed to mark chore done:", err));
        });

        container.appendChild(div);
    });
}

document.getElementById("back-to-groups").addEventListener("click", () => {
    showView("groups-view");
});
