/**
 * Mind the Cat - Group Management Module
 * 
 * This file handles all group-related database operations using Firebase Firestore.
 * It provides functions for creating groups, managing members, and checking permissions.
 * 
 * Key Features:
 * - Create new groups with admin permissions
 * - Invite and manage group members
 * - Check user admin status within groups
 * - Load group members and user's groups
 * - Role-based access control
 */

import { getFirestore, doc, setDoc, serverTimestamp, getDoc, updateDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Initialize Firestore database instance
const db = getFirestore();

/**
 * Creates a new group with the current user as the admin
 * @param {string} groupId - Unique identifier for the group
 * @param {string} groupName - Display name for the group
 * @returns {Promise} - Promise that resolves when group is created
 * @throws {Error} - If user is not authenticated
 */
export async function createGroup(groupId, groupName) {
    const user = getAuth().currentUser;
    if (!user) throw new Error("User not logged in");

    // Create the group document with initial structure
    await setDoc(doc(db, "groups", groupId), {
        name: groupName,
        createdAt: serverTimestamp(),
        // Admin permissions - only the creator starts as admin
        admins: { [user.uid]: true },
        // Member list - creator is automatically added as admin member
        members: {
            [user.uid]: {
                displayName: user.displayName,
                isAdmin: true,
            },
        },
    });

    // Store group ID locally and trigger group-ready event
    localStorage.setItem("groupId", groupId);
    document.dispatchEvent(new CustomEvent("group-ready", { detail: groupId }));
}

/**
 * Checks if a user has admin privileges in a specific group
 * @param {string} groupId - The ID of the group to check
 * @param {string} userId - The ID of the user to check
 * @returns {Promise<boolean>} - True if user is admin, false otherwise
 */
export async function isUserAdmin(groupId, userId) {
    // Get the group document
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if (!groupSnap.exists()) return false;

    const data = groupSnap.data();
    // Check if user ID exists in the admins object
    return !!data.admins?.[userId];
}

/**
 * Invites a new member to a group with optional admin privileges
 * @param {string} groupId - The ID of the group to invite to
 * @param {string} userId - The ID of the user to invite
 * @param {boolean} isAdmin - Whether the user should have admin privileges
 * @param {string} displayName - Display name for the user (defaults to "Unnamed")
 * @returns {Promise} - Promise that resolves when invitation is processed
 */
export async function inviteMember(groupId, userId, isAdmin = false, displayName = "Unnamed") {
    const groupRef = doc(db, "groups", groupId);

    // Prepare the update object for the group document
    const update = {
        // Add user to members list
        [`members.${userId}`]: {
            displayName,
            isAdmin
        }
    };

    // If user should be admin, also add to admins list
    if (isAdmin) {
        update[`admins.${userId}`] = true;
    }

    // Apply the updates to the group document
    await updateDoc(groupRef, update);
}

/**
 * Loads all members of a group and passes them to a callback function
 * @param {string} groupId - The ID of the group to load members for
 * @param {Function} callback - Function to handle the loaded members
 * @returns {Promise} - Promise that resolves when members are loaded
 */
export async function loadMembers(groupId, callback) {
    // Get the group document
    const groupSnap = await getDoc(doc(db, "groups", groupId));
    if (!groupSnap.exists()) return;

    // Extract members object from group data
    const members = groupSnap.data().members || {};

    // Convert members object to array of [uid, memberInfo] pairs and pass to callback
    callback(Object.entries(members));
}

/**
 * Loads all groups where a user is a member
 * @param {string} userId - The ID of the user to find groups for
 * @param {Function} callback - Function to handle the loaded groups
 * @returns {Promise} - Promise that resolves when groups are loaded
 */
export async function loadUserGroups(userId, callback) {
    // Get all groups from the database
    const groupsRef = collection(db, "groups");
    const snapshot = await getDocs(groupsRef);

    const userGroups = [];

    // Filter groups to only include those where the user is a member
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.members && data.members[userId]) {
            // Add group to list with document ID included
            userGroups.push({ id: docSnap.id, ...data });
        }
    });

    // Pass the filtered groups to the callback function
    callback(userGroups);
}

/**
 * Deletes a group (admin only)
 * @param {string} groupId - The ID of the group to delete
 * @returns {Promise} - Promise that resolves when group is deleted
 */
export async function deleteGroup(groupId) {
    console.log("🗑️ deleteGroup called with:", { groupId });

    const user = getAuth().currentUser;
    if (!user) throw new Error("User not logged in");

    // Check if user is admin in this group
    const isAdmin = await isUserAdmin(groupId, user.uid);
    if (!isAdmin) {
        throw new Error("Only admins can delete groups");
    }

    try {
        // Delete the group document
        await deleteDoc(doc(db, "groups", groupId));
        console.log("✅ Group deleted successfully");
    } catch (error) {
        console.error("❌ Error in deleteGroup:", error);
        throw error;
    }
}
