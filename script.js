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

import { createChore, markChoreDone, loadChores, deleteChore, updateChore } from "./chores.js";
import { createGroup, deleteGroup } from "./group.js";
import { getFirestore, collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

/**
 * Splash Screen Management
 * Shows the app icon and title for 2.5 seconds when the app loads
 */
function initializeSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');

    if (!splashScreen) {
        console.log('Splash screen element not found');
        return;
    }

    // Hide splash screen after 2.5 seconds
    setTimeout(() => {
        splashScreen.classList.add('fade-out');

        // Completely hide after fade animation completes
        setTimeout(() => {
            splashScreen.classList.add('hidden');
        }, 500); // Match the CSS transition duration
    }, 2500);
}

// Initialize splash screen when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeSplashScreen();

    // Invite code modal close and copy logic
    const closeBtn = document.getElementById("close-invite-code-modal");
    if (closeBtn) closeBtn.onclick = hideInviteCodeModal;
    const copyBtn = document.getElementById("copy-invite-code-btn");
    if (copyBtn) copyBtn.onclick = function () {
        const input = document.getElementById("invite-code-input");
        input.select();
        input.setSelectionRange(0, 9999); // For mobile
        document.execCommand('copy');
        this.textContent = "Copied!";
        setTimeout(() => { this.textContent = "Copy Code"; }, 1500);
    };
});

/**
 * Shows a specific view while hiding all others
 * @param {string} viewId - The ID of the view to show (e.g., 'login-view', 'groups-view', 'chores-view')
 */
function showView(viewId) {
    document.querySelectorAll(".view").forEach(div => {
        div.style.display = div.id === viewId ? "block" : "none";
    });

    // Trigger specific events for certain views
    if (viewId === "single-chore-view") {
        document.dispatchEvent(new CustomEvent("single-chore-view-ready"));
    }
}

/**
 * Event listener for when a group is selected and ready
 * Loads chores and members for the selected group, and sets up admin permissions
 */
document.addEventListener("group-ready", (e) => {
    const groupId = e.detail;

    // Reset rendering flag when entering a new group
    isRenderingChores = false;

    // Load and display chores for the selected group
    loadChores(groupId, renderChores);

    // Start progress updates for this group
    startProgressUpdates();
    startGroupStatsUpdates(); // Start group stats updates

    // Check if current user is admin and show/hide invite member section accordingly
    const userId = window.currentUser?.uid;
    import("./group.js").then(({ isUserAdmin }) => {
        isUserAdmin(groupId, userId).then(isAdmin => {
            document.getElementById("invite-member-btn").style.display = isAdmin ? "inline-block" : "none";
            document.getElementById("delete-group-section").style.display = isAdmin ? "block" : "none";
        });
    });

    // Load and display group members
    import("./group.js").then(({ loadMembers }) => {
        loadMembers(groupId, renderMembers);
    });
});

/**
 * Event handler for creating new groups - now navigates to create group view
 */
document.getElementById("create-group-btn").addEventListener("click", () => {
    showView("create-group-view");
});

/**
 * Event handler for joining groups - shows the join code input
 */
document.getElementById("join-group-btn").addEventListener("click", () => {
    const joinSection = document.getElementById("join-code-section");
    joinSection.style.display = "block";
    document.getElementById("join-code-input").focus();
});

/**
 * Event handler for canceling join group
 */
document.getElementById("cancel-join-btn").addEventListener("click", () => {
    document.getElementById("join-code-section").style.display = "none";
    document.getElementById("join-code-input").value = "";
});

/**
 * Event handler for confirming group creation in the dedicated view
 */
document.getElementById("confirm-create-group-btn").addEventListener("click", async () => {
    const groupName = document.getElementById("new-group-id-input").value.trim();

    if (!groupName) {
        alert("Please enter a group name.");
        return;
    }

    try {
        // Create group using groupName as both ID and name
        await createGroup(groupName, groupName);
        alert(`Group "${groupName}" created!`);

        // Clear the input field
        document.getElementById("new-group-id-input").value = "";

        // Go back to groups view
        showView("groups-view");

        // Refresh the user's groups list to show the new group immediately
        const userId = window.currentUser?.uid;
        if (userId) {
            import("./group.js").then(({ loadUserGroups }) => {
                loadUserGroups(userId, async (groups) => {
                    await renderGroupList(groups);
                });
            });
        }
    } catch (err) {
        alert("Failed to create group: " + err.message);
        console.error(err);
    }
});

/**
 * Event handler for canceling group creation
 */
document.getElementById("cancel-create-group-btn").addEventListener("click", () => {
    document.getElementById("new-group-id-input").value = "";
    showView("groups-view");
});

/**
 * Event handler for creating new chores - now navigates to create chore view
 */
document.getElementById("create-chore-btn").addEventListener("click", () => {
    showView("create-chore-view");
});

/**
 * Event handler for inviting members - now navigates to invite member view
 */
document.getElementById("invite-member-btn").addEventListener("click", () => {
    showView("invite-member-view");
});

/**
 * Event handler for confirming chore creation in the dedicated view
 */
document.getElementById("confirm-create-chore-btn").addEventListener("click", () => {
    const choreName = document.getElementById("new-chore-name-input").value.trim();
    const groupId = localStorage.getItem("groupId");
    const intervalValueInput = document.getElementById("chore-interval-value-input").value.trim();
    const intervalUnit = document.getElementById("chore-interval-unit-input").value;

    // Validate that chore name and group are provided
    if (!choreName || !groupId) {
        alert("Enter a chore name and select a group first.");
        return;
    }

    // Parse interval value (optional)
    let intervalValue = null;
    let intervalUnitFinal = null;

    if (intervalValueInput) {
        intervalValue = parseInt(intervalValueInput, 10);
        // Validate interval value if provided
        if (isNaN(intervalValue) || intervalValue <= 0) {
            alert("Please enter a valid interval (number greater than 0).\nFor example: 8 hours, 2 days, etc.\nOr leave empty for no time requirement.");
            return;
        }
        intervalUnitFinal = intervalUnit;
    }

    // Create the chore and refresh the display
    createChore(groupId, choreName, intervalValue, intervalUnitFinal)
        .then(() => {
            // Clear input fields
            document.getElementById("new-chore-name-input").value = "";
            document.getElementById("chore-interval-value-input").value = "";
            document.getElementById("chore-interval-unit-input").value = "hours";

            // Go back to chores view
            showView("chores-view");

            // Refresh chores
            loadChores(groupId, renderChores);
            // Update the group overdue badge and stats
            updateGroupOverdueBadge(groupId);
        })
        .catch(err => console.error("Failed to create chore:", err));
});

/**
 * Event handler for canceling chore creation
 */
document.getElementById("cancel-create-chore-btn").addEventListener("click", () => {
    // Clear input fields
    document.getElementById("new-chore-name-input").value = "";
    document.getElementById("chore-interval-value-input").value = "";
    document.getElementById("chore-interval-unit-input").value = "hours";
    showView("chores-view");
});

/**
 * Event handler for inviting members - now navigates to invite member view
 */
document.getElementById("invite-member-btn").addEventListener("click", () => {
    showView("invite-member-view");
});

/**
 * Event handler for confirming member invitation
 */
document.getElementById("confirm-invite-btn").addEventListener("click", async () => {
    try {
        console.log("🔧 Starting invite by email process...");
        const email = document.getElementById("invite-email-input").value.trim().toLowerCase();
        const isAdmin = document.getElementById("invite-as-admin-input").checked;
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

        // Show modal with code
        showInviteCodeModal(code);

        // Clear input fields and go back to chores view
        document.getElementById("invite-email-input").value = "";
        document.getElementById("invite-as-admin-input").checked = false;
        showView("chores-view");
    } catch (error) {
        console.error("❌ Error in invite by email:", error);
        alert("Failed to create invite: " + error.message);
    }
});

/**
 * Event handler for generating invite code
 */
document.getElementById("generate-invite-code-btn").addEventListener("click", async () => {
    try {
        console.log("🔧 Starting generate invite code process...");
        const groupId = localStorage.getItem("groupId");
        if (!groupId) return alert("No group selected.");

        const isAdmin = document.getElementById("invite-as-admin-input").checked;
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

        // Show modal with code
        showInviteCodeModal(code);
    } catch (error) {
        console.error("❌ Error in generate invite code:", error);
        alert("Failed to generate invite code: " + error.message);
    }
});

/**
 * Event handler for canceling member invitation
 */
document.getElementById("cancel-invite-btn").addEventListener("click", () => {
    // Clear input fields
    document.getElementById("invite-email-input").value = "";
    document.getElementById("invite-as-admin-input").checked = false;
    showView("chores-view");
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
 * Helper to calculate progress for timed chores
 * @param {Object} chore - The chore object
 * @returns {Object} - Progress data with percentage, status, and time remaining
 */
function calculateChoreProgress(chore) {
    if (!chore.intervalValue || !chore.intervalUnit || !chore.lastDone) {
        return null; // No progress for non-timed chores
    }

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
    const now = Date.now();
    const timeRemaining = nextDue - now;

    // Calculate remaining time percentage (100-0, emptying from right to left)
    const remainingPercent = Math.max(0, Math.min(100, (timeRemaining / intervalMs) * 100));

    // Determine status based on time remaining
    let status = 'good';
    let timeText = '';

    if (timeRemaining <= 0) {
        // Overdue
        status = 'urgent';
        const overdueMs = Math.abs(timeRemaining);
        const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
        const overdueDays = Math.floor(overdueMs / (1000 * 60 * 60 * 24));

        if (overdueDays > 0) {
            timeText = `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`;
        } else {
            timeText = `Overdue by ${overdueHours} hour${overdueHours > 1 ? 's' : ''}`;
        }
    } else {
        // Not overdue
        const remainingHours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const remainingDays = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));

        if (remainingPercent < 25) {
            status = 'urgent';
        } else if (remainingPercent < 50) {
            status = 'warning';
        }

        if (remainingDays > 0) {
            timeText = `${remainingDays} day${remainingDays > 1 ? 's' : ''} remaining`;
        } else if (remainingHours > 0) {
            timeText = `${remainingHours} hour${remainingHours > 1 ? 's' : ''} remaining`;
        } else {
            timeText = 'Less than 1 hour remaining';
        }
    }

    return {
        percent: remainingPercent,
        status: status,
        timeText: timeText
    };
}

/**
 * Helper to format time remaining for display
 * @param {Object} chore - The chore object
 * @returns {string} - Formatted time remaining string
 */
function formatTimeRemaining(chore) {
    if (!chore.intervalValue || !chore.intervalUnit || !chore.lastDone) {
        return null;
    }

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
    const now = Date.now();
    const timeRemaining = nextDue - now;

    if (timeRemaining <= 0) {
        // Overdue
        const overdueMs = Math.abs(timeRemaining);
        const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
        const overdueDays = Math.floor(overdueMs / (1000 * 60 * 60 * 24));

        if (overdueDays > 0) {
            return `Overdue ${overdueDays}d`;
        } else if (overdueHours > 0) {
            return `Overdue ${overdueHours}h`;
        } else {
            return "Overdue";
        }
    } else {
        // Not overdue
        const remainingHours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const remainingDays = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));

        if (remainingDays > 0) {
            return `${remainingDays}d left`;
        } else if (remainingHours > 0) {
            return `${remainingHours}h left`;
        } else {
            const remainingMinutes = Math.floor(timeRemaining / (1000 * 60));
            return `${remainingMinutes}m left`;
        }
    }
}

// Flag to prevent multiple simultaneous renders
let isRenderingChores = false;
// Flag to prevent multiple user-ready executions
let isUserReadyHandled = false;

/**
 * Renders the list of chores in the current group
 * @param {Array} chores - Array of chore objects with id, name, lastDone, and doneBy properties
 */
function renderChores(chores) {
    // Prevent multiple simultaneous renders
    if (isRenderingChores) {
        console.log("🔄 Already rendering chores, skipping...");
        return;
    }

    isRenderingChores = true;
    console.log("🎨 Starting to render chores:", chores.length);

    const container = document.getElementById("chore-list");
    container.innerHTML = ""; // Clear existing content

    // Show message if no chores exist
    if (chores.length === 0) {
        container.textContent = "No chores yet.";
        isRenderingChores = false;
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

                // Mute state
                const muted = isChoreMuted(chore.id);
                const bellIcon = muted ? '🔕' : '🔔';
                const bellTitle = muted ? 'Notifications muted for this chore' : 'Notifications active for this chore';

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
                } else {
                    intervalText = "No time requirement";
                }

                // Check if overdue
                const overdue = isChoreOverdue(chore);
                if (overdue) {
                    div.classList.add("overdue-chore");
                    anyOverdue = true;
                }

                // Calculate overdue time for display
                let overdueText = "";
                if (overdue && chore.lastDone) {
                    let intervalMs = 0;
                    if (chore.intervalUnit === "minutes") {
                        intervalMs = chore.intervalValue * 60 * 1000;
                    } else if (chore.intervalUnit === "hours") {
                        intervalMs = chore.intervalValue * 60 * 60 * 1000;
                    } else if (chore.intervalUnit === "days") {
                        intervalMs = chore.intervalValue * 24 * 60 * 60 * 1000;
                    }
                    const nextDue = chore.lastDone.seconds * 1000 + intervalMs;
                    const overdueMs = Date.now() - nextDue;
                    const overdueDays = Math.floor(overdueMs / (1000 * 60 * 60 * 24));
                    const overdueHours = Math.floor((overdueMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    const overdueMinutes = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
                    if (overdueDays > 0) {
                        overdueText = `Overdue by ${overdueDays} day${overdueDays > 1 ? 's' : ''}`;
                        if (overdueHours > 0) {
                            overdueText += ` and ${overdueHours} hour${overdueHours > 1 ? 's' : ''}`;
                        }
                    } else if (overdueHours > 0) {
                        overdueText = `Overdue by ${overdueHours} hour${overdueHours > 1 ? 's' : ''}`;
                        if (overdueMinutes > 0) {
                            overdueText += ` and ${overdueMinutes} minute${overdueMinutes > 1 ? 's' : ''}`;
                        }
                    } else if (overdueMinutes > 0) {
                        overdueText = `Overdue by ${overdueMinutes} minute${overdueMinutes > 1 ? 's' : ''}`;
                    } else {
                        overdueText = "Overdue";
                    }
                }

                // Create detailed info for dropdown
                const fullTimestamp = chore.lastDone
                    ? new Date(chore.lastDone.seconds * 1000).toLocaleString()
                    : "Never";
                const doneByText = chore.doneBy
                    ? `Done by: ${chore.doneBy.displayName || chore.doneBy.uid}`
                    : "";

                // Calculate progress for timed chores
                const progress = calculateChoreProgress(chore);
                const progressBar = progress ? `
                    <div class="progress-container">
                        <div class="progress-fill ${progress.status}" style="width: ${progress.percent}%"></div>
                    </div>
                    <div class="progress-text">${progress.timeText}</div>
                ` : '';

                div.innerHTML = `
                    <div class="chore-header" style="position: relative;">
                        <span class="chore-name">${chore.name}${overdue ? ' 🔴' : ''}</span>
                        <button class="mute-chore-btn" title="${bellTitle}" data-chore-id="${chore.id}" style="position: absolute; top: 0; right: 0; background: none; border: none; font-size: 1.2rem; cursor: pointer;">${bellIcon}</button>
                    </div>
                    <div class="chore-main-info">
                        <small>${chore.doneBy?.displayName || 'Unknown'} ${lastDoneText}</small>
                    </div>
                    ${progressBar}
                    <div class="chore-actions">
                        <button class="mark-done-btn" data-chore-id="${chore.id}">Done</button>
                    </div>
                `;

                // Add event listener for mute/activate button
                div.querySelector('.mute-chore-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const currentlyMuted = isChoreMuted(chore.id);
                    setChoreMuted(chore.id, !currentlyMuted);
                    renderChores(chores); // re-render to update icon
                });

                // Add click handler to the entire chore card for single chore view
                div.addEventListener("click", (e) => {
                    // Don't trigger if clicking on buttons
                    if (e.target.classList.contains('mark-done-btn') ||
                        e.target.classList.contains('delete-chore-btn') ||
                        e.target.classList.contains('mute-chore-btn')) {
                        return;
                    }

                    // Store chore data and go to single chore view
                    localStorage.setItem("currentChore", JSON.stringify(chore));
                    showView("single-chore-view");
                });

                // Add event listener for marking chore as done
                div.querySelector(".mark-done-btn").addEventListener("click", () => {
                    const user = window.currentUser;
                    if (!user) return alert("Login first.");

                    import("./chores.js").then(({ markChoreDone, loadChores }) => {
                        markChoreDone(groupId, chore.id, user)
                            .then(() => {
                                loadChores(groupId, renderChores);
                                // Update the group overdue badge
                                updateGroupOverdueBadge(groupId);
                            });
                    });
                });

                // Add delete functionality for admins only
                if (isAdmin) {
                    const deleteBtn = div.querySelector(".delete-chore-btn");
                    if (deleteBtn) {
                        deleteBtn.addEventListener("click", () => {
                            if (confirm("Delete this chore?")) {
                                deleteChore(groupId, chore.id)
                                    .then(() => {
                                        loadChores(groupId, renderChores);
                                        // Update the group overdue badge
                                        updateGroupOverdueBadge(groupId);
                                    })
                                    .catch(err => {
                                        alert("Failed to delete chore: " + err.message);
                                    });
                            }
                        });
                    }
                }

                container.appendChild(div);
            });

            // Update the group overdue badge after rendering chores
            updateGroupOverdueBadge(groupId);
            checkAndNotifyOverdueChores(chores); // Notify overdue chores after rendering
            isRenderingChores = false;
        });
    });
}

/**
 * Loads and displays the history for a specific chore in a popup modal
 * @param {string} choreId - The chore ID
 * @param {string} choreName - The chore name for the popup title
 */
async function displayChoreHistory(choreId, choreName) {
    const groupId = localStorage.getItem("groupId");

    try {
        console.log("🔍 Loading history for chore:", choreId, "in group:", groupId);

        const { loadChoreHistory } = await import("./chores.js");
        const history = await loadChoreHistory(groupId, choreId);

        console.log("📋 Raw history data:", history);
        console.log("📊 History length:", history.length);

        // Create or get the modal
        let modal = document.getElementById("history-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "history-modal";
            modal.className = "modal";
            document.body.appendChild(modal);
        }

        let historyContent = '';
        if (history.length === 0) {
            historyContent = `
                <p style="color: #666; font-style: italic;">No history available.</p>
                <p style="color: #999; font-size: 0.8rem;">This chore has no completion or edit history yet.</p>
            `;
        } else {
            // Sort history by timestamp (newest first)
            const sortedHistory = history.sort((a, b) => {
                const timeA = a.timestamp?.seconds || 0;
                const timeB = b.timestamp?.seconds || 0;
                return timeB - timeA;
            });

            console.log("🔄 Sorted history:", sortedHistory);

            historyContent = '<div class="history-list">';

            sortedHistory.forEach((entry, index) => {
                const timestamp = entry.timestamp?.seconds
                    ? new Date(entry.timestamp.seconds * 1000).toLocaleString()
                    : 'Unknown time';

                const relativeTime = entry.timestamp?.seconds
                    ? formatRelativeTime(entry.timestamp.seconds * 1000)
                    : 'Unknown time';

                if (entry.type === "edit") {
                    // Display edit history entry
                    const editedBy = entry.editedBy?.displayName || entry.editedBy?.uid || 'Unknown user';
                    const changes = entry.changes;

                    let changeDescription = '';
                    if (changes.oldName !== changes.newName) {
                        changeDescription += `Name: "${changes.oldName}" → "${changes.newName}"`;
                    }

                    const oldInterval = changes.oldIntervalValue && changes.oldIntervalUnit
                        ? `${changes.oldIntervalValue} ${changes.oldIntervalUnit}`
                        : 'No interval';
                    const newInterval = changes.newIntervalValue && changes.newIntervalUnit
                        ? `${changes.newIntervalValue} ${changes.newIntervalUnit}`
                        : 'No interval';

                    if (oldInterval !== newInterval) {
                        if (changeDescription) changeDescription += '<br>';
                        changeDescription += `Interval: ${oldInterval} → ${newInterval}`;
                    }

                    historyContent += `
                        <div class="history-entry edit-entry ${index === 0 ? 'latest' : ''}">
                            <div class="history-icon">✏️</div>
                            <div class="history-details">
                                <div class="history-user">${editedBy}</div>
                                <div class="history-action">Edited chore</div>
                                <div class="history-changes">${changeDescription}</div>
                                <div class="history-time">
                                    <span class="relative-time">${relativeTime}</span>
                                    <span class="full-time">${timestamp}</span>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    // Display completion history entry (existing logic)
                    const doneBy = entry.doneBy?.displayName || entry.doneBy?.uid || 'Unknown user';

                    historyContent += `
                        <div class="history-entry completion-entry ${index === 0 ? 'latest' : ''}">
                            <div class="history-icon">✅</div>
                            <div class="history-details">
                                <div class="history-user">${doneBy}</div>
                                <div class="history-action">Marked as done</div>
                                <div class="history-time">
                                    <span class="relative-time">${relativeTime}</span>
                                    <span class="full-time">${timestamp}</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });

            historyContent += '</div>';
        }

        // Set modal content
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📋 History: ${choreName}</h3>
                    <button class="modal-close" onclick="closeHistoryModal()">&times;</button>
                </div>
                <div class="modal-body">
                    ${historyContent}
                </div>
            </div>
        `;

        // Show the modal
        modal.style.display = "flex";

    } catch (error) {
        console.error("Error loading chore history:", error);

        // Show error in modal
        let modal = document.getElementById("history-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "history-modal";
            modal.className = "modal";
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>📋 History: ${choreName}</h3>
                    <button class="modal-close" onclick="closeHistoryModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="color: #dc3545;">Error loading history.</p>
                </div>
            </div>
        `;
        modal.style.display = "flex";
    }
}

/**
 * Closes the history modal
 */
function closeHistoryModal() {
    const modal = document.getElementById("history-modal");
    if (modal) {
        modal.style.display = "none";
    }
}

// Make the function globally accessible
window.closeHistoryModal = closeHistoryModal;

/**
 * Renders the single chore view with detailed information
 */
function renderSingleChoreView() {
    const choreData = localStorage.getItem("currentChore");
    if (!choreData) {
        showView("chores-view");
        return;
    }

    const chore = JSON.parse(choreData);
    const groupId = localStorage.getItem("groupId");

    // Set the chore name in the header
    document.getElementById("single-chore-name").textContent = chore.name;

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
    } else {
        intervalText = "No time requirement";
    }

    // Check if overdue
    const overdue = isChoreOverdue(chore);

    // Calculate progress for timed chores
    const progress = calculateChoreProgress(chore);
    const progressBar = progress ? `
        <div class="progress-container">
            <div class="progress-fill ${progress.status}" style="width: ${progress.percent}%"></div>
        </div>
        <div class="progress-text">${progress.timeText}</div>
    ` : '';

    // Create detailed info
    const fullTimestamp = chore.lastDone
        ? new Date(chore.lastDone.seconds * 1000).toLocaleString()
        : "Never";
    const doneByText = chore.doneBy
        ? `Done by: ${chore.doneBy.displayName || chore.doneBy.uid}`
        : "";

    const content = document.getElementById("single-chore-content");
    content.innerHTML = `
        <div class="single-chore-details">
            <div class="detail-section">
                <h3>Current Status</h3>
                <p><strong>Interval:</strong> ${intervalText}</p>
                <p><strong>Last done:</strong> ${lastDoneText}</p>
                <p><strong>${doneByText}</strong></p>
                ${overdue ? '<p style="color: #dc3545; font-weight: bold;">⚠️ This chore is overdue!</p>' : ''}
            </div>
            
            ${progressBar ? `
            <div class="detail-section">
                <h3>Progress</h3>
                ${progressBar}
            </div>
            ` : ''}
            
            <div class="detail-section">
                <h3>Detailed Information</h3>
                <p><strong>Full timestamp:</strong> ${fullTimestamp}</p>
                <p><strong>${nextDueText}</strong></p>
            </div>
        </div>
    `;

    // Check if user is admin and show/hide delete button
    const userId = window.currentUser?.uid;
    import("./group.js").then(({ isUserAdmin }) => {
        isUserAdmin(groupId, userId).then(isAdmin => {
            document.getElementById("delete-chore-section").style.display = isAdmin ? "block" : "none";
        });
    });
}

/**
 * Shows the edit chore view with pre-filled form data
 * @param {Object} chore - The chore object to edit
 */
function showEditChoreView(chore) {
    // Pre-fill the form with current chore data
    document.getElementById("edit-chore-name-input").value = chore.name;
    document.getElementById("edit-chore-interval-value-input").value = chore.intervalValue || "";
    document.getElementById("edit-chore-interval-unit-input").value = chore.intervalUnit || "hours";

    showView("edit-chore-view");
}

/**
 * Event handler for navigating back to single chore view
 */
document.getElementById("back-to-single-chore").addEventListener("click", () => {
    showView("single-chore-view");
});

/**
 * Event handler for confirming chore editing
 */
document.getElementById("confirm-edit-chore-btn").addEventListener("click", async () => {
    const choreData = localStorage.getItem("editingChore");
    if (!choreData) return;

    const chore = JSON.parse(choreData);
    const groupId = localStorage.getItem("groupId");
    const newName = document.getElementById("edit-chore-name-input").value.trim();
    const intervalValueInput = document.getElementById("edit-chore-interval-value-input").value.trim();
    const intervalUnit = document.getElementById("edit-chore-interval-unit-input").value;

    // Validate input
    if (!newName) {
        alert("Please enter a chore name.");
        return;
    }

    // Parse interval value (optional)
    let intervalValue = null;
    let intervalUnitFinal = null;

    if (intervalValueInput) {
        intervalValue = parseInt(intervalValueInput, 10);
        if (isNaN(intervalValue) || intervalValue <= 0) {
            alert("Please enter a valid interval (number greater than 0).");
            return;
        }
        intervalUnitFinal = intervalUnit;
    }

    try {
        // Update the chore using the imported function
        await updateChore(groupId, chore.id, newName, intervalValue, intervalUnitFinal, window.currentUser);

        alert("Chore updated successfully!");

        // Clear form and go back to single chore view
        document.getElementById("edit-chore-name-input").value = "";
        document.getElementById("edit-chore-interval-value-input").value = "";
        document.getElementById("edit-chore-interval-unit-input").value = "hours";

        // Go back to single chore view and refresh
        showView("single-chore-view");
        renderSingleChoreView();

        // Also refresh the chores view if we go back to it
        import("./chores.js").then(({ loadChores }) => {
            loadChores(groupId, renderChores);
        });

    } catch (err) {
        console.error("Failed to update chore:", err);
        alert("Failed to update chore: " + err.message);
    }
});

/**
 * Event handler for canceling chore editing
 */
document.getElementById("cancel-edit-chore-btn").addEventListener("click", () => {
    // Clear form
    document.getElementById("edit-chore-name-input").value = "";
    document.getElementById("edit-chore-interval-value-input").value = "";
    document.getElementById("edit-chore-interval-unit-input").value = "hours";

    // Go back to single chore view
    showView("single-chore-view");
});

/**
 * Event handler for navigating back to chores view
 */
document.getElementById("back-to-chores").addEventListener("click", () => {
    showView("chores-view");
});

/**
 * Event handler for deleting chore in single chore view
 */
document.getElementById("delete-chore-btn").addEventListener("click", () => {
    const choreData = localStorage.getItem("currentChore");
    if (!choreData) return;

    const chore = JSON.parse(choreData);
    const groupId = localStorage.getItem("groupId");

    if (confirm(`Are you sure you want to delete the chore "${chore.name}"?`)) {
        deleteChore(groupId, chore.id)
            .then(() => {
                // Go back to chores view and refresh
                showView("chores-view");
                import("./chores.js").then(({ loadChores }) => {
                    loadChores(groupId, renderChores);
                });
                updateGroupOverdueBadge(groupId);
            })
            .catch(err => {
                alert("Failed to delete chore: " + err.message);
            });
    }
});

/**
 * Event handler for navigating back to groups view
 */
document.getElementById("back-to-groups").addEventListener("click", () => {
    // Stop progress updates when leaving the group
    stopProgressUpdates();
    // Reset rendering flag
    isRenderingChores = false;
    showView("groups-view");
});

/**
 * Event listener for when single chore view is shown
 */
document.addEventListener("single-chore-view-ready", () => {
    renderSingleChoreView();
});

/**
 * Event handler for marking chore as done in single chore view
 */
document.getElementById("mark-done-single-btn").addEventListener("click", () => {
    const choreData = localStorage.getItem("currentChore");
    if (!choreData) return;

    const chore = JSON.parse(choreData);
    const groupId = localStorage.getItem("groupId");
    const user = window.currentUser;

    if (!user) return alert("Login first.");

    import("./chores.js").then(({ markChoreDone, loadChores }) => {
        markChoreDone(groupId, chore.id, user)
            .then(() => {
                // Go back to chores view and refresh
                showView("chores-view");
                loadChores(groupId, renderChores);
                updateGroupOverdueBadge(groupId);
            });
    });
});

/**
 * Event handler for viewing history in single chore view
 */
document.getElementById("view-history-btn").addEventListener("click", () => {
    const choreData = localStorage.getItem("currentChore");
    if (!choreData) return;

    const chore = JSON.parse(choreData);
    displayChoreHistory(chore.id, chore.name);
});

/**
 * Event handler for editing chore in single chore view
 */
document.getElementById("edit-chore-btn").addEventListener("click", () => {
    const choreData = localStorage.getItem("currentChore");
    if (!choreData) return;

    const chore = JSON.parse(choreData);
    // Store chore data for editing
    localStorage.setItem("editingChore", JSON.stringify(chore));
    showEditChoreView(chore);
});

/**
 * Event handler for inviting new members to the group
 * Only visible to group admins
 */
function generateInviteCode(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

/**
 * Helper to show the invite code modal
 */
function showInviteCodeModal(code) {
    const modal = document.getElementById("invite-code-modal");
    const input = document.getElementById("invite-code-input");
    input.value = code;
    modal.style.display = "flex";
}

/**
 * Helper to hide the invite code modal
 */
function hideInviteCodeModal() {
    document.getElementById("invite-code-modal").style.display = "none";
}

/**
 * Renders the list of group members
 * @param {Array} memberEntries - Array of [uid, memberInfo] pairs
 */
function renderMembers(memberEntries) {
    const ul = document.getElementById("member-list-ul");
    ul.innerHTML = ""; // Clear existing content

    memberEntries.forEach(([uid, info]) => {
        const li = document.createElement("li");
        const adminIcon = info.isAdmin ? "👑" : "👤";
        const displayName = info.displayName || uid;

        li.innerHTML = `
            <span class="member-icon">${adminIcon}</span>
            <span class="member-name">${displayName}</span>
        `;

        ul.appendChild(li);
    });
}

/**
 * Event listener for when a user is authenticated and ready
 * Loads the user's groups and displays them
 */
document.addEventListener("user-ready", async (e) => {
    // Prevent multiple executions
    if (isUserReadyHandled) {
        console.log("🔄 User ready already handled, skipping...");
        return;
    }

    isUserReadyHandled = true;
    const user = e.detail;
    console.log("🔁 User ready event triggered for:", user.displayName);

    // Store user profile in Firestore users collection
    const { getFirestore, doc, setDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
    const db = getFirestore();
    if (user.email) {
        await setDoc(
            doc(db, "users", user.uid),
            {
                email: user.email,
                displayName: user.displayName || "Unnamed",
                uid: user.uid
            },
            { merge: true }
        );
    }

    // Display user information in the groups view
    document.getElementById("user-info").textContent = `Hello ${user.displayName}`;
    showView("groups-view");

    import("./group.js").then(({ loadUserGroups }) => {
        console.log("📦 Group module loaded, calling loadUserGroups...");
        loadUserGroups(user.uid, async (groups) => {
            console.log("📋 Groups loaded:", groups);
            await renderGroupList(groups);
            // Start group stats updates for the groups view
            startGroupStatsUpdates();
        });
    }).catch(err => {
        console.error("❌ Error loading group module:", err);
    });
    await requestNotificationPermission();
});

/**
 * Counts overdue chores in a group
 * @param {string} groupId - The group ID to check
 * @returns {Promise<number>} - Number of overdue chores
 */
async function countOverdueChores(groupId) {
    try {
        const { loadChores } = await import("./chores.js");
        return new Promise((resolve) => {
            loadChores(groupId, (chores) => {
                const overdueCount = chores.filter(chore => isChoreOverdue(chore)).length;
                resolve(overdueCount);
            });
        });
    } catch (error) {
        console.error("Error counting overdue chores:", error);
        return 0;
    }
}

/**
 * Updates the overdue badge for a specific group card
 * @param {string} groupId - The group ID to update
 */
async function updateGroupOverdueBadge(groupId) {
    const overdueCount = await countOverdueChores(groupId);
    const groupCard = document.querySelector(`[data-group-id='${groupId}']`);

    if (groupCard) {
        const overdueBadge = groupCard.querySelector('.overdue-badge');

        if (overdueCount > 0) {
            // Add or update overdue badge
            if (overdueBadge) {
                overdueBadge.textContent = `⚠️ ${overdueCount} overdue`;
            } else {
                const groupHeader = groupCard.querySelector('.group-header');
                if (groupHeader) {
                    const newBadge = document.createElement('span');
                    newBadge.className = 'overdue-badge';
                    newBadge.textContent = `⚠️ ${overdueCount} overdue`;
                    groupHeader.appendChild(newBadge);
                }
            }
            // Add overdue styling to group card
            groupCard.classList.add('overdue-group');
        } else {
            // Remove overdue badge and styling
            if (overdueBadge) {
                overdueBadge.remove();
            }
            groupCard.classList.remove('overdue-group');
        }

        // Also update the group stats (most urgent chore)
        await updateGroupStats(groupId);
    }
}

/**
 * Gets group statistics including total chores and most urgent chore
 * @param {string} groupId - The group ID to get stats for
 * @returns {Promise<Object>} - Group statistics
 */
async function getGroupStats(groupId) {
    try {
        const { loadChores } = await import("./chores.js");
        return new Promise((resolve) => {
            loadChores(groupId, (chores) => {
                const totalChores = chores.length;
                let mostUrgentChore = null;
                let mostUrgentTime = 100; // Start with 100% (least urgent)

                // Find the most urgent chore (closest to 0% remaining)
                chores.forEach(chore => {
                    if (chore.intervalValue && chore.intervalUnit && chore.lastDone) {
                        const progress = calculateChoreProgress(chore);
                        if (progress && progress.percent < mostUrgentTime) {
                            mostUrgentTime = progress.percent;
                            mostUrgentChore = chore;
                        }
                    }
                });

                resolve({
                    totalChores,
                    mostUrgentChore,
                    mostUrgentTime
                });
            });
        });
    } catch (error) {
        console.error("Error getting group stats:", error);
        return { totalChores: 0, mostUrgentChore: null, mostUrgentTime: 100 };
    }
}

/**
 * Updates the most urgent chore for a specific group card
 * @param {string} groupId - The group ID to update
 */
async function updateGroupStats(groupId) {
    const groupCard = document.querySelector(`[data-group-id='${groupId}']`);
    if (groupCard) {
        const { totalChores, mostUrgentChore, mostUrgentTime } = await getGroupStats(groupId);

        // Check if current user is admin in this group
        const userId = window.currentUser?.uid;
        const isAdmin = groupCard.querySelector('.group-role')?.textContent.includes('Admin');

        let urgentChoreInfo = '';
        if (totalChores === 0) {
            urgentChoreInfo = `<div class="urgent-chore-info no-chores">
                <span class="urgency-indicator">📝</span>
                <span class="urgent-chore-name">No chores yet</span>
            </div>`;
        } else if (mostUrgentChore) {
            const urgencyLevel = mostUrgentTime < 25 ? '🔴' : mostUrgentTime < 50 ? '🟡' : '🟢';
            const timeRemaining = formatTimeRemaining(mostUrgentChore);
            urgentChoreInfo = `<div class="urgent-chore-info">
                <span class="urgency-indicator">${urgencyLevel}</span>
                <span class="urgent-chore-name">${mostUrgentChore.name}</span>
                <span class="urgency-percent">${timeRemaining}</span>
            </div>`;
        } else {
            urgentChoreInfo = `<div class="urgent-chore-info no-urgent">
                <span class="urgency-indicator">✅</span>
                <span class="urgent-chore-name">All chores up to date</span>
            </div>`;
        }

        const groupInfo = groupCard.querySelector('.group-info');
        if (groupInfo) {
            groupInfo.innerHTML = `
                <div class="group-role">${isAdmin ? "👑 Admin" : "👤 Member"}</div>
                <div class="group-stats">
                    <span class="chore-count">📋 ${totalChores} chore${totalChores !== 1 ? 's' : ''}</span>
                </div>
                ${urgentChoreInfo}
            `;
        }
    }
}

/**
 * Renders the list of groups the current user belongs to
 * @param {Array} groups - Array of group objects with id and name properties
 */
async function renderGroupList(groups) {
    console.log("🎨 Starting renderGroupList with groups:", groups);

    const container = document.getElementById("group-list");
    console.log("🎨 Group list container:", container);

    if (!container) {
        console.error("❌ Group list container not found!");
        return;
    }

    container.innerHTML = ""; // Clear existing content

    if (groups.length === 0) {
        console.log("📝 No groups to display, showing 'No groups' message");
        container.textContent = "No groups joined yet.";
        return;
    }

    console.log("🎨 Rendering groups:", groups);

    // Create a card for each group
    for (const group of groups) {
        const groupCard = document.createElement("div");
        groupCard.className = "chore group-entry";
        groupCard.setAttribute("data-group-id", group.id);

        // Check if current user is admin in this group
        const userId = window.currentUser?.uid;
        const isAdmin = group.admins && group.admins[userId];

        // Count overdue chores for this group
        const overdueCount = await countOverdueChores(group.id);

        // Get group stats
        const { totalChores, mostUrgentChore, mostUrgentTime } = await getGroupStats(group.id);

        // Create overdue badge if there are overdue chores
        const overdueBadge = overdueCount > 0
            ? `<span class="overdue-badge">⚠️ ${overdueCount} overdue</span>`
            : '';

        // Format most urgent chore info
        let urgentChoreInfo = '';
        if (totalChores === 0) {
            urgentChoreInfo = `<div class="urgent-chore-info no-chores">
                <span class="urgency-indicator">📝</span>
                <span class="urgent-chore-name">No chores yet</span>
            </div>`;
        } else if (mostUrgentChore) {
            const urgencyLevel = mostUrgentTime < 25 ? '🔴' : mostUrgentTime < 50 ? '🟡' : '🟢';
            const timeRemaining = formatTimeRemaining(mostUrgentChore);
            urgentChoreInfo = `<div class="urgent-chore-info">
                <span class="urgency-indicator">${urgencyLevel}</span>
                <span class="urgent-chore-name">${mostUrgentChore.name}</span>
                <span class="urgency-percent">${timeRemaining}</span>
            </div>`;
        } else {
            urgentChoreInfo = `<div class="urgent-chore-info no-urgent">
                <span class="urgency-indicator">✅</span>
                <span class="urgent-chore-name">All chores up to date</span>
            </div>`;
        }

        groupCard.innerHTML = `
            <div class="group-header">
                <span class="group-name">${group.name}</span>
                ${overdueBadge}
            </div>
            <div class="group-info">
                <div class="group-role">${isAdmin ? "👑 Admin" : "👤 Member"}</div>
                <div class="group-stats">
                    <span class="chore-count">📋 ${totalChores} chore${totalChores !== 1 ? 's' : ''}</span>
                </div>
                ${urgentChoreInfo}
            </div>
        `;

        console.log("🎨 Created group card:", groupCard);
        console.log("🎨 Group card classes:", groupCard.className);
        console.log("🎨 Group card computed styles:", window.getComputedStyle(groupCard));

        // Add click handler to select the group
        groupCard.addEventListener("click", (e) => {
            localStorage.setItem("groupId", group.id);
            document.getElementById("current-group-label").textContent = group.name;

            // Trigger group-ready event to load chores and members
            document.dispatchEvent(new CustomEvent("group-ready", { detail: group.id }));
            showView("chores-view");
        });

        container.appendChild(groupCard);
    }

    console.log("✅ renderGroupList completed successfully");
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

/**
 * Event handler for deleting the current group
 * Only visible to group admins
 */
document.getElementById("delete-group-btn").addEventListener("click", async () => {
    const groupId = localStorage.getItem("groupId");
    const userId = window.currentUser?.uid;

    if (!groupId || !userId) {
        alert("No group selected or user not logged in.");
        return;
    }

    // Check if user is admin
    const { isUserAdmin } = await import("./group.js");
    const isAdmin = await isUserAdmin(groupId, userId);

    if (!isAdmin) {
        alert("Only group admins can delete groups.");
        return;
    }

    const groupName = document.getElementById("current-group-label").textContent;

    if (confirm(`Are you sure you want to delete the group "${groupName}"? This action cannot be undone.`)) {
        try {
            await deleteGroup(groupId);
            alert("Group deleted successfully!");

            // Go back to groups view
            showView("groups-view");

            // Refresh the group list
            import("./group.js").then(({ loadUserGroups }) => {
                loadUserGroups(userId, async (groups) => {
                    await renderGroupList(groups);
                });
            });
        } catch (err) {
            console.error("Error deleting group:", err);
            alert("Failed to delete group: " + err.message);
        }
    }
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
            loadUserGroups(user.uid, async (groups) => {
                await renderGroupList(groups);
            });
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

/**
 * Updates progress bars for all visible chores
 * This function refreshes the progress display without reloading the entire chore list
 */
function updateProgressBars() {
    // Don't update if we're currently rendering chores
    if (isRenderingChores) {
        console.log("🔄 Skipping progress update - chores are being rendered");
        return;
    }

    const choreCards = document.querySelectorAll('.chore');
    console.log("🔄 Updating progress for", choreCards.length, "chores");

    choreCards.forEach(card => {
        const progressContainer = card.querySelector('.progress-container');
        const progressFill = card.querySelector('.progress-fill');
        const progressText = card.querySelector('.progress-text');

        if (progressContainer && progressFill && progressText) {
            // Get chore data from the card (we'll need to store this data)
            const choreId = card.querySelector('.mark-done-btn')?.dataset.choreId;
            if (choreId) {
                // For now, we'll just refresh the entire chore list
                // In a more sophisticated version, we could store chore data in data attributes
                const groupId = localStorage.getItem("groupId");
                if (groupId) {
                    // Only refresh if we're not already rendering
                    if (!isRenderingChores) {
                        import("./chores.js").then(({ loadChores }) => {
                            loadChores(groupId, renderChores);
                        });
                    }
                }
            }
        }
    });
}

// Set up timer to update progress bars every minute
let progressUpdateTimer = null;
let groupStatsUpdateTimer = null;

function startProgressUpdates() {
    // Clear existing timer
    if (progressUpdateTimer) {
        clearInterval(progressUpdateTimer);
    }

    // Update every 2 minutes (120000ms) instead of every minute to reduce conflicts
    progressUpdateTimer = setInterval(() => {
        try {
            updateProgressBars();
        } catch (error) {
            console.error("Error updating progress bars:", error);
        }
    }, 120000);

    console.log("🔄 Started progress updates every 2 minutes");
}

function startGroupStatsUpdates() {
    // Clear existing timer
    if (groupStatsUpdateTimer) {
        clearInterval(groupStatsUpdateTimer);
    }

    // Update group stats every 5 minutes
    groupStatsUpdateTimer = setInterval(async () => {
        try {
            const groupCards = document.querySelectorAll('[data-group-id]');
            for (const card of groupCards) {
                const groupId = card.getAttribute('data-group-id');
                await updateGroupStats(groupId);
            }
        } catch (error) {
            console.error("Error updating group stats:", error);
        }
    }, 300000); // 5 minutes

    console.log("📊 Started group stats updates every 5 minutes");
}

function stopProgressUpdates() {
    if (progressUpdateTimer) {
        clearInterval(progressUpdateTimer);
        progressUpdateTimer = null;
    }
    if (groupStatsUpdateTimer) {
        clearInterval(groupStatsUpdateTimer);
        groupStatsUpdateTimer = null;
    }
}

/**
 * Event handler for the logout button
 * Signs out the current user and returns to login view
 */
document.getElementById("logout-btn").addEventListener("click", async () => {
    // Reset flags when logging out
    isUserReadyHandled = false;
    isRenderingChores = false;

    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");
    const auth = getAuth();

    signOut(auth).then(() => {
        showView("login-view");
    });
});

async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        await Notification.requestPermission();
    }
}

function notifyOverdueChores(count) {
    console.log('notifyOverdueChores called with count:', count);
    if ('Notification' in window && Notification.permission === 'granted' && count > 0) {
        new Notification('Mind the Cat', {
            body: `You have ${count} overdue chore${count > 1 ? 's' : ''}!`,
            icon: 'icon-192.png'
        });
    }
}

// Helper: get mute state for a chore
function isChoreMuted(choreId) {
    return localStorage.getItem(`mute-chore-${choreId}`) === 'true';
}

// Helper: set mute state for a chore
function setChoreMuted(choreId, muted) {
    localStorage.setItem(`mute-chore-${choreId}`, muted ? 'true' : 'false');
}

// Update notification logic to only notify for unmuted chores
function checkAndNotifyOverdueChores(chores) {
    const overdueCount = chores.filter(chore => isChoreOverdue(chore) && !isChoreMuted(chore.id)).length;
    notifyOverdueChores(overdueCount);
}
