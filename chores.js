/**
 * Mind the Cat - Chores Management Module
 * 
 * This file handles all chore-related database operations using Firebase Firestore.
 * It provides functions for creating, updating, and retrieving chores within groups.
 * 
 * Key Features:
 * - Create new chores in a group
 * - Mark chores as completed with timestamp and user info
 * - Load and display all chores for a group
 * - Delete chores (admin only)
 * - Real-time chore status tracking
 */

import { getFirestore, collection, serverTimestamp, updateDoc, getDocs, addDoc, doc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Initialize Firestore database instance
const db = getFirestore();

/**
 * Creates a new chore in the specified group
 * @param {string} groupId - The ID of the group to add the chore to
 * @param {string} choreName - The name/description of the chore
 * @param {number} intervalValue - The interval value (e.g., 8)
 * @param {string} intervalUnit - The interval unit ("hours" or "days")
 * @returns {Promise} - Promise that resolves when chore is created
 */
export async function createChore(groupId, choreName, intervalValue = null, intervalUnit = null) {
    // Reference to the chores subcollection within the group
    const choresRef = collection(db, "groups", groupId, "chores");

    // Add the new chore document with initial state and interval
    await addDoc(choresRef, {
        name: choreName,
        lastDone: null,        // Timestamp of when it was last completed
        doneBy: null,          // User who last completed it
        intervalValue: intervalValue, // How often the chore should be done (number)
        intervalUnit: intervalUnit    // Unit for the interval ("hours" or "days")
    });
}

/**
 * Marks a chore as completed by the specified user
 * @param {string} groupId - The ID of the group containing the chore
 * @param {string} choreId - The ID of the chore to mark as done
 * @param {Object} user - The user object who completed the chore
 * @returns {Promise} - Promise that resolves when chore is updated
 */
export async function markChoreDone(groupId, choreId, user) {
    // Reference to the specific chore document
    const choreRef = doc(db, "groups", groupId, "chores", choreId);

    // Update the chore with completion information
    await updateDoc(choreRef, {
        lastDone: serverTimestamp(),  // Use server timestamp for accuracy
        doneBy: {
            uid: user.uid,            // User's unique ID
            displayName: user.displayName  // User's display name
        }
    });
}

/**
 * Deletes a chore from the group (admin only)
 * @param {string} groupId - The ID of the group containing the chore
 * @param {string} choreId - The ID of the chore to delete
 * @returns {Promise} - Promise that resolves when chore is deleted
 */
export async function deleteChore(groupId, choreId) {
    console.log("🔧 deleteChore called with:", { groupId, choreId });

    // Check if we have valid parameters
    if (!groupId || !choreId) {
        console.error("❌ Invalid parameters:", { groupId, choreId });
        throw new Error("Invalid group ID or chore ID");
    }

    // Reference to the specific chore document
    const choreRef = doc(db, "groups", groupId, "chores", choreId);
    console.log("📄 Chore reference path:", choreRef.path);

    try {
        // First, let's check if the document exists
        const docSnap = await getDoc(choreRef);
        if (!docSnap.exists()) {
            console.error("❌ Chore document does not exist:", choreRef.path);
            throw new Error("Chore not found");
        }
        console.log("✅ Chore document exists, proceeding with deletion...");

        // Delete the chore document
        await deleteDoc(choreRef);
        console.log("✅ Chore document deleted successfully");
    } catch (error) {
        console.error("❌ Error in deleteChore:", error);
        console.error("❌ Error code:", error.code);
        console.error("❌ Error message:", error.message);
        throw error; // Re-throw to be caught by the calling function
    }
}

/**
 * Loads all chores for a specific group and passes them to a callback function
 * @param {string} groupId - The ID of the group to load chores for
 * @param {Function} renderFn - Callback function to handle the loaded chores
 * @returns {Promise} - Promise that resolves when chores are loaded
 */
export async function loadChores(groupId, renderFn) {
    // Get all documents from the chores subcollection
    const choresSnap = await getDocs(collection(db, "groups", groupId, "chores"));

    // Convert Firestore documents to plain objects with IDs
    const chores = [];
    choresSnap.forEach(doc => {
        chores.push({
            id: doc.id,      // Document ID
            ...doc.data()    // All other document data
        });
    });

    // Pass the chores to the provided render function
    renderFn(chores);
}
