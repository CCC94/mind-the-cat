/**
 * Mind the Cat - Authentication Module
 * 
 * This file handles user authentication using Firebase Authentication with Google Sign-In.
 * It manages the login/logout flow and user state throughout the application.
 * 
 * Key Features:
 * - Google OAuth authentication
 * - User session management
 * - Automatic login state restoration
 * - User information display
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase configuration for the Mind the Cat project
const firebaseConfig = {
    apiKey: "AIzaSyCHpFshdCJ7eer8adXGp3pBoMcFs8TOhVU",
    authDomain: "mindthecat-59b98.firebaseapp.com",
    projectId: "mindthecat-59b98",
    storageBucket: "mindthecat-59b98.firebasestorage.app",
    messagingSenderId: "493425096678",
    appId: "1:493425096678:web:6e59c43655f3abe20e0827",
};

// Initialize Firebase app and authentication
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

/**
 * Shows a specific view while hiding all others
 * @param {string} viewId - The ID of the view to show
 */
function showView(viewId) {
    document.querySelectorAll(".view").forEach(div => {
        div.style.display = div.id === viewId ? "block" : "none";
    });
}

/**
 * Event handler for the login button
 * Initiates Google Sign-In popup and handles the authentication flow
 */
document.getElementById("login-btn").addEventListener("click", () => {
    signInWithPopup(auth, provider)
        .then(result => {
            const user = result.user;
            // Store user globally for access throughout the app
            window.currentUser = user;
            // Trigger user-ready event to load user's groups
            document.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
        })
        .catch(err => {
            alert("Login failed: " + err.message);
        });
});

/**
 * Event handler for the logout button
 * Signs out the current user and returns to login view
 */
document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth).then(() => {
        showView("login-view");
    });
});

/**
 * Firebase Auth state change listener
 * Automatically handles user authentication state changes
 * This ensures the app responds to login/logout events even when they happen
 * outside of the app (e.g., user logs out in another tab)
 */
onAuthStateChanged(auth, user => {
    if (user) {
        // User is signed in
        window.currentUser = user;
        document.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
    } else {
        // User is signed out
        showView("login-view");
    }
});
