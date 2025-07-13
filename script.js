/**
 * Mind the Cat - Main Application Script
 * 
 * This file contains the core UI logic and event handlers for the chore tracking app.
 * It manages the three main views: login, groups, and chores, and handles all user interactions.
 * 
 * Key Features:
 * - View management (login, groups, chores)
 * - Chore creation and management
 * - Group creation and navigation
 * - Member invitation system
 * - Real-time UI updates
 */

import { createChore, markChoreDone, loadChores, deleteChore } from "./chores.js";
import { createGroup, deleteGroup } from "./group.js";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/**
 * Shows a specific view while hiding all others
 * @param {string} viewId - The ID of the view to show (e.g., 'login-view', 'groups-view', 'chores-view')
 */
function showView(viewId) {
    document.querySelectorAll(".view").forEach(div => {
        div.style.display = div.id === viewId ? "block" : "none";
    });
}

/**
 * Event listener for when a group is selected and ready
 * Loads chores and members for the selected group, and sets up admin permissions
 */
document.addEventListener("group-ready", (e) => {
    const groupId = e.detail;

    // Load and display chores for the selected group
    loadChores(groupId, renderChores);

    // Check if current user is admin and show/hide invite member section accordingly
    const userId = window.currentUser?.uid;
    import("./group.js").then(({ isUserAdmin }) => {
        isUserAdmin(groupId, userId).then(isAdmin => {
            document.getElementById("invite-member").style.display = isAdmin ? "block" : "none";
        });
    });

    // Load and display group members
    import("./group.js").then(({ loadMembers }) => {
        loadMembers(groupId, renderMembers);
    });
});

/**
 * Event handler for creating new chores
 * Validates input and creates the chore in the current group
 */
document.getElementById("create-chore-btn").addEventListener("click", () => {
    const choreName = document.getElementById("new-chore-name").value.trim();
    const groupId = localStorage.getItem("groupId");
    const intervalValue = parseInt(document.getElementById("chore-interval-value").value, 10);
    const intervalUnit = document.getElementById("chore-interval-unit").value;

    // Validate that both chore name and group are provided
    if (!choreName || !groupId) {
        alert("Enter a chore name and select a group first.");
        return;
    }
    // Validate interval value
    if (isNaN(intervalValue) || intervalValue <= 0) {
        alert("Please enter a valid interval (number greater than 0).\nFor example: 8 hours, 2 days, etc.");
        return;
    }

    // Create the chore and refresh the display
    createChore(groupId, choreName, intervalValue, intervalUnit)
        .then(() => {
            loadChores(groupId, renderChores);
            document.getElementById("new-chore-name").value = ""; // Clear input field
            document.getElementById("chore-interval-value").value = ""; // Clear interval value
            document.getElementById("chore-interval-unit").value = "hours"; // Reset to default
        })
        .catch(err => console.error("Failed to create chore:", err));
});

/**
 * Event handler for creating new groups
 * Creates a group with the current user as admin
 */
document.getElementById("create-group-btn").addEventListener("click", async () => {
    const groupId = document.getElementById("group-id-input").value.trim();

    if (!groupId) {
        alert("Please enter a group ID.");
        return;
    }

    try {
        // Create group using groupId as both ID and name
        await createGroup(groupId, groupId);
        alert(`Group "${groupId}" created!`);

        // Refresh the user's groups list to show the new group immediately
        const userId = window.currentUser?.uid;
        if (userId) {
            import("./group.js").then(({ loadUserGroups }) => {
                loadUserGroups(userId, renderGroupList);
            });
        }

        // Clear the input field after successful creation
        document.getElementById("group-id-input").value = "";
    } catch (err) {
        alert("Failed to create group: " + err.message);
        console.error(err);
    }
});

/**
 * Helper to format relative time
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} - Formatted relative time string
 */
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
        return "less than one hour ago";
    } else if (hours < 24) {
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (days < 7) {
        const remainingHours = hours % 24;
        if (remainingHours === 0) {
            return `${days} day${days === 1 ? '' : 's'} ago`;
        } else {
            return `${days} day${days === 1 ? '' : 's'} and ${remainingHours} hour${remainingHours === 1 ? '' : 's'} ago`;
        }
    } else {
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }
}

/**
 * Helper to determine if a chore is overdue
 * @param {Object} chore - The chore object
 * @returns {boolean} - True if overdue, false otherwise
 */
function isChoreOverdue(chore) {
    if (!chore.intervalValue || !chore.intervalUnit) return false;
    if (!chore.lastDone) return true; // Never done, so overdue
    const lastDone = chore.lastDone.seconds * 1000;
    let intervalMs = 0;
    if (chore.intervalUnit === "minutes") {
        intervalMs = chore.intervalValue * 60 * 1000;
    } else if (chore.intervalUnit === "hours") {
        intervalMs = chore.intervalValue * 60 * 60 * 1000;
    } else if (chore.intervalUnit === "days") {
        intervalMs = chore.intervalValue * 24 * 60 * 60 * 1000;
    }
    const nextDue = lastDone + intervalMs;
    return Date.now() > nextDue;
}

/**
 * Renders the list of chores in the current group
 * @param {Array} chores - Array of chore objects with id, name, lastDone, and doneBy properties
 */
function renderChores(chores) {
    const container = document.getElementById("chore-list");
    container.innerHTML = ""; // Clear existing content

    // Show message if no chores exist
    if (chores.length === 0) {
        container.textContent = "No chores yet.";
        return;
    }

    const userId = window.currentUser?.uid;
    const groupId = localStorage.getItem("groupId");

    // Track if any chore is overdue for group highlighting
    let anyOverdue = false;

    // Check if current user is admin to show delete buttons
    import("./group.js").then(({ isUserAdmin }) => {
        isUserAdmin(groupId, userId).then(isAdmin => {
            chores.forEach(chore => {
                // Create chore display element
                const div = document.createElement("div");
                div.className = "chore";

                // Format the last done timestamp for display
                const lastDoneText = chore.lastDone
                    ? formatRelativeTime(chore.lastDone.seconds * 1000)
                    : "Never";

                // Calculate next due time
                let nextDueText = "";
                if (chore.intervalValue && chore.intervalUnit && chore.lastDone) {
                    let intervalMs = 0;
                    if (chore.intervalUnit === "minutes") {
                        intervalMs = chore.intervalValue * 60 * 1000;
                    } else if (chore.intervalUnit === "hours") {
                        intervalMs = chore.intervalValue * 60 * 60 * 1000;
                    } else if (chore.intervalUnit === "days") {
                        intervalMs = chore.intervalValue * 24 * 60 * 60 * 1000;
                    }
                    const nextDue = chore.lastDone.seconds * 1000 + intervalMs;
                    nextDueText = `Next due: ${new Date(nextDue).toLocaleString()}`;
                }

                // Show interval info
                let intervalText = "";
                if (chore.intervalValue && chore.intervalUnit) {
                    intervalText = `Every ${chore.intervalValue} ${chore.intervalUnit}`;
                }

                // Check if overdue
                const overdue = isChoreOverdue(chore);
                if (overdue) {
                    div.classList.add("overdue-chore");
                    anyOverdue = true;
                }

                // Create detailed info for dropdown
                const fullTimestamp = chore.lastDone
                    ? new Date(chore.lastDone.seconds * 1000).toLocaleString()
                    : "Never";
                const doneByText = chore.doneBy
                    ? `Done by: ${chore.doneBy.displayName || chore.doneBy.uid}`
                    : "";

                div.innerHTML = `
                    <div class="chore-header">
                        <span class="chore-name">${chore.name}</span>
                        <span class="chore-dropdown-toggle">▼</span>
                    </div>
                    <div class="chore-main-info">
                        <small>Last done: ${lastDoneText}</small><br/>
                        <small>${intervalText}</small>
                    </div>
                    <div class="chore-details" style="display: none;">
                        <small>Full time: ${fullTimestamp}</small><br/>
                        <small>${doneByText}</small><br/>
                        <small>${nextDueText}</small>
                    </div>
                    <div class="chore-actions">
                        <button class="mark-done-btn" data-chore-id="${chore.id}">Mark Done</button>
                        ${isAdmin ? `<button class="delete-chore-btn" data-chore-id="${chore.id}">🗑️ Delete</button>` : ""}
                    </div>
                `;

                // Add dropdown toggle functionality
                const dropdownToggle = div.querySelector(".chore-dropdown-toggle");
                const choreDetails = div.querySelector(".chore-details");
                dropdownToggle.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isVisible = choreDetails.style.display !== "none";
                    choreDetails.style.display = isVisible ? "none" : "block";
                    dropdownToggle.textContent = isVisible ? "▼" : "▲";
                });

                // Add event listener for marking chore as done
                div.querySelector(".mark-done-btn").addEventListener("click", () => {
                    const user = window.currentUser;
                    if (!user) return alert("Login first.");

                    import("./chores.js").then(({ markChoreDone, loadChores }) => {
                        markChoreDone(groupId, chore.id, user)
                            .then(() => loadChores(groupId, renderChores));
                    });
                });

                // Add delete functionality for admins only
                if (isAdmin) {
                    const deleteBtn = div.querySelector(".delete-chore-btn");
                    if (deleteBtn) {
                        deleteBtn.addEventListener("click", () => {
                            if (confirm("Delete this chore?")) {
                                deleteChore(groupId, chore.id)
                                    .then(() => loadChores(groupId, renderChores))
                                    .catch(err => {
                                        alert("Failed to delete chore: " + err.message);
                                    });
                            }
                        });
                    }
                }

                container.appendChild(div);
            });

            // Highlight group if any chore is overdue
            const groupList = document.getElementById("group-list");
            if (groupList) {
                // Remove overdue-group from all group cards first
                groupList.querySelectorAll(".group-entry").forEach(card => {
                    card.classList.remove("overdue-group");
                });
                // Add overdue-group to the current group card if any chore is overdue
                if (anyOverdue) {
                    const groupId = localStorage.getItem("groupId");
                    const groupCard = groupList.querySelector(`[data-group-id='${groupId}']`);
                    if (groupCard) {
                        groupCard.classList.add("overdue-group");
                    }
                }
            }
        });
    });
}

/**
 * Event handler for navigating back to groups view
 */
document.getElementById("back-to-groups").addEventListener("click", () => {
    showView("groups-view");
});

/**
 * Event handler for inviting new members to the group
 * Only visible to group admins
 */
document.getElementById("invite-user-id").placeholder = "User Email (Google Account)";

function generateInviteCode(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

document.getElementById("invite-btn").addEventListener("click", async () => {
    try {
        console.log("🔧 Starting invite by email process...");
        const email = document.getElementById("invite-user-id").value.trim().toLowerCase();
        const isAdmin = document.getElementById("invite-as-admin").checked;
        const groupId = localStorage.getItem("groupId");

        console.log("📝 Invite details:", { email, isAdmin, groupId });

        if (!email || !groupId) return alert("User email and group required.");

        // Generate unique invite code
        const code = generateInviteCode(10);
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 hours from now

        console.log("🎫 Generated code:", code);
        console.log("⏰ Expires at:", new Date(expiresAt).toLocaleString());

        // Store invite in Firestore (modular syntax)
        const db = getFirestore();
        console.log("🔥 Storing in Firestore...");

        const inviteData = {
            code,
            groupId,
            expiresAt,
            isAdmin,
            email
        };
        console.log("📦 Invite data to store:", inviteData);

        await setDoc(doc(collection(db, "groupInvites"), code), inviteData);
        console.log("✅ Successfully stored invite code in Firestore!");

        alert(`Invite code for ${email}:\n\n${code}\n\nShare this code with the user. It is valid for 24 hours and can only be used once.`);
        document.getElementById("invite-user-id").value = "";
        document.getElementById("invite-as-admin").checked = false;
    } catch (error) {
        console.error("❌ Error in invite by email:", error);
        alert("Failed to create invite: " + error.message);
    }
});

// Generate Invite Code button (no email)
document.getElementById("generate-invite-code-btn").addEventListener("click", async () => {
    try {
        console.log("🔧 Starting generate invite code process...");
        const groupId = localStorage.getItem("groupId");
        if (!groupId) return alert("No group selected.");

        const isAdmin = document.getElementById("invite-as-admin").checked;
        const code = generateInviteCode(8);
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

        console.log("📝 Generate code details:", { groupId, isAdmin, code });
        console.log("⏰ Expires at:", new Date(expiresAt).toLocaleString());

        const db = getFirestore();
        console.log("🔥 Storing in Firestore...");

        const inviteData = {
            code,
            groupId,
            expiresAt,
            isAdmin
        };
        console.log("📦 Invite data to store:", inviteData);

        await setDoc(doc(collection(db, "groupInvites"), code), inviteData);
        console.log("✅ Successfully stored invite code in Firestore!");

        alert(`Invite code generated:\n\n${code}\n\nShare this code with the user. It is valid for 24 hours and can only be used once.`);
    } catch (error) {
        console.error("❌ Error in generate invite code:", error);
        alert("Failed to generate invite code: " + error.message);
    }
});

/**
 * Renders the list of group members
 * @param {Array} memberEntries - Array of [uid, memberInfo] pairs
 */
function renderMembers(memberEntries) {
    const ul = document.getElementById("member-list-ul");
    ul.innerHTML = ""; // Clear existing content

    memberEntries.forEach(([uid, info]) => {
        const li = document.createElement("li");
        // Display member name with admin indicator if applicable
        li.textContent = `${info.displayName || uid}${info.isAdmin ? " (Admin)" : ""}`;
        ul.appendChild(li);
    });
}

/**
 * Event listener for when a user is authenticated and ready
 * Loads the user's groups and displays them
 */
document.addEventListener("user-ready", (e) => {
    const user = e.detail;

    import("./group.js").then(({ loadUserGroups }) => {
        loadUserGroups(user.uid, renderGroupList);
    });
});

/**
 * Renders the list of groups the current user belongs to
 * @param {Array} groups - Array of group objects with id and name properties
 */
function renderGroupList(groups) {
    const container = document.getElementById("group-list");
    container.innerHTML = ""; // Clear existing content

    if (groups.length === 0) {
        container.textContent = "No groups joined yet.";
        return;
    }

    console.log("🎨 Rendering groups:", groups);

    // Create a card for each group
    groups.forEach(group => {
        const groupCard = document.createElement("div");
        groupCard.className = "chore group-entry";
        groupCard.setAttribute("data-group-id", group.id);

        // Check if current user is admin in this group
        const userId = window.currentUser?.uid;
        const isAdmin = group.admins && group.admins[userId];

        groupCard.innerHTML = `
            <p>${group.name}<br/>
            <small>${isAdmin ? "👑 Admin" : "👤 Member"}</small></p>
            ${isAdmin ? `<button class="delete-group-btn" data-group-id="${group.id}">🗑️ Delete Group</button>` : ""}
        `;

        console.log("🎨 Created group card:", groupCard);
        console.log("🎨 Group card classes:", groupCard.className);
        console.log("🎨 Group card computed styles:", window.getComputedStyle(groupCard));

        // Add click handler to select the group
        groupCard.addEventListener("click", (e) => {
            // Don't trigger group selection if clicking on delete button
            if (e.target.classList.contains('delete-group-btn')) {
                return;
            }

            localStorage.setItem("groupId", group.id);
            document.getElementById("current-group-label").textContent = group.name;

            // Trigger group-ready event to load chores and members
            document.dispatchEvent(new CustomEvent("group-ready", { detail: group.id }));
            showView("chores-view");
        });

        // Add delete functionality for admin groups
        if (isAdmin) {
            const deleteBtn = groupCard.querySelector(".delete-group-btn");
            if (deleteBtn) {
                console.log("🔘 Delete group button found for group:", group.id);
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation(); // Prevent group selection
                    console.log("🗑️ Delete group button clicked for group:", group.id);
                    console.log("Current user:", window.currentUser?.uid);
                    console.log("Group ID:", group.id);

                    if (confirm(`Are you sure you want to delete the group "${group.name}"? This action cannot be undone.`)) {
                        console.log("✅ User confirmed group deletion");
                        deleteGroup(group.id)
                            .then(() => {
                                console.log("✅ Group deleted successfully");
                                // Refresh the group list
                                const userId = window.currentUser?.uid;
                                if (userId) {
                                    import("./group.js").then(({ loadUserGroups }) => {
                                        loadUserGroups(userId, renderGroupList);
                                    });
                                }
                            })
                            .catch(err => {
                                console.error("❌ Error deleting group:", err);
                                alert("Failed to delete group: " + err.message);
                            });
                    } else {
                        console.log("❌ User cancelled group deletion");
                    }
                });
            } else {
                console.error("❌ Delete group button not found for group:", group.id);
            }
        }

        container.appendChild(groupCard);
    });
}

/**
 * Test function to verify Firebase permissions
 * This will help debug if the issue is with Firebase rules
 */
function testFirebasePermissions() {
    const groupId = localStorage.getItem("groupId");
    const userId = window.currentUser?.uid;

    console.log("🧪 Testing Firebase permissions...");
    console.log("Group ID:", groupId);
    console.log("User ID:", userId);

    if (!groupId || !userId) {
        console.error("❌ Missing group ID or user ID");
        return;
    }

    // Test admin status
    import("./group.js").then(({ isUserAdmin }) => {
        isUserAdmin(groupId, userId).then(isAdmin => {
            console.log("🧪 Admin test result:", isAdmin);
        }).catch(err => {
            console.error("❌ Admin test failed:", err);
        });
    });
}

// Add test button to the UI (temporary for debugging)
document.addEventListener("DOMContentLoaded", () => {
    // Add a test button to the chores view
    const testBtn = document.createElement("button");
    testBtn.textContent = "🧪 Test Permissions";
    testBtn.style.position = "fixed";
    testBtn.style.top = "10px";
    testBtn.style.right = "10px";
    testBtn.style.zIndex = "1000";
    testBtn.addEventListener("click", testFirebasePermissions);
    document.body.appendChild(testBtn);
});

// Join Group by Code

document.getElementById("join-code-btn").addEventListener("click", async () => {
    try {
        console.log("🔧 Starting join by code process...");
        const code = document.getElementById("join-code-input").value.trim().toUpperCase();
        if (!code) return alert("Please enter an invite code.");

        console.log("🎫 Looking up code:", code);

        const db = getFirestore();

        // Step 1: Try to read the invite code
        console.log("📖 Step 1: Reading invite code...");
        const inviteRef = doc(collection(db, "groupInvites"), code);
        const inviteSnap = await getDoc(inviteRef);
        console.log("✅ Successfully read invite code");

        if (!inviteSnap.exists()) {
            console.log("❌ Invite code not found");
            alert("Invalid invite code.");
            return;
        }

        const invite = inviteSnap.data();
        console.log("📋 Found invite:", invite);

        if (Date.now() > invite.expiresAt) {
            console.log("⏰ Invite expired");
            alert("This invite code has expired.");
            await deleteDoc(inviteRef);
            return;
        }

        // Add user to group
        const user = window.currentUser;
        if (!user) {
            console.log("❌ No user logged in");
            alert("You must be logged in to join a group.");
            return;
        }

        console.log("👤 Current user:", { uid: user.uid, displayName: user.displayName });
        console.log("🏠 Joining group:", invite.groupId);
        console.log("👑 Is admin invite:", invite.isAdmin);

        // Skip reading the group document since it requires permissions
        // We know the group exists because we have a valid invite code
        console.log("📖 Step 2: Skipping group read (permission issue)");
        const groupRef = doc(collection(db, "groups"), invite.groupId);

        // Add to members and (optionally) admins
        const update = {
            [`members.${user.uid}`]: {
                displayName: user.displayName || "Unnamed",
                isAdmin: !!invite.isAdmin
            }
        };
        if (invite.isAdmin) {
            update[`admins.${user.uid}`] = true;
        }
        await updateDoc(groupRef, update);
        console.log("✅ Successfully joined group!");

        await deleteDoc(inviteRef);
        console.log("🗑️ Deleted used invite code");

        alert("You have joined the group!");
        document.getElementById("join-code-input").value = "";

        // Refresh group list
        import("./group.js").then(({ loadUserGroups }) => {
            loadUserGroups(user.uid, renderGroupList);
        });
    } catch (error) {
        console.error("❌ Error joining group:", error);
        console.error("❌ Error details:", {
            code: error.code,
            message: error.message,
            stack: error.stack
        });

        // More specific error handling
        if (error.code === 'permission-denied') {
            console.error("🚫 PERMISSION DENIED - This could be:");
            console.error("   - Reading the invite code");
            console.error("   - Reading the group document");
            console.error("   - Writing to the group document");
            console.error("   - Deleting the invite code");
        }

        alert("Failed to join group: " + error.message);
    }
});
