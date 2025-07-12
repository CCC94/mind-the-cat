import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const auth = getAuth();
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");

loginBtn.addEventListener("click", () => {
    signInWithPopup(auth, provider).catch(console.error);
});

logoutBtn.addEventListener("click", () => {
    signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        userInfo.textContent = `Logged in as ${user.displayName}`;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline";
        window.currentUser = user;
    } else {
        userInfo.textContent = "";
        loginBtn.style.display = "inline";
        logoutBtn.style.display = "none";
        window.currentUser = null;
    }
});
// This script handles user authentication using Firebase
// It allows users to sign in with Google and displays their name
// The login button is shown when the user is not authenticated
// The logout button is shown when the user is authenticated
// The user's information is displayed on the page
// The script uses Firebase's authentication methods to manage user sessions
// Ensure to include Firebase SDK in your HTML file for this to work
// Example usage: <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"></script>
// Make sure to initialize Firebase with your project's configuration
// This script should be included after the Firebase SDK scripts in your HTML file
// Example usage: <script src="auth.js"></script>

document.addEventListener('DOMContentLoaded', () => {
    const chores = document.querySelectorAll('.chore');

    chores.forEach((choreDiv) => {
        const choreKey = choreDiv.dataset.chore;
        const lastFedSpan = choreDiv.querySelector('.last-fed');
        const button = choreDiv.querySelector('button');

        // Load last time from localStorage
        const savedTime = localStorage.getItem(`mind-the-cat-${choreKey}`);
        if (savedTime) {
            lastFedSpan.textContent = new Date(savedTime).toLocaleString();
        }

        // Button click
        button.addEventListener('click', () => {
            const now = new Date();
            localStorage.setItem(`mind-the-cat-${choreKey}`, now.toISOString());
            lastFedSpan.textContent = now.toLocaleString();
        });
    });
});
// This script handles the feeding functionality and updates the last fed time
// It uses localStorage to persist the last fed time across page reloads
// The last fed time is displayed in a human-readable format
// The button click updates the last fed time and saves it to localStorage
// The script runs when the DOM is fully loaded to ensure all elements are available
// This is a simple implementation for a pet feeding tracker
// It can be extended with more features like feeding history or reminders
// Ensure to include this script in your HTML file for it to work
// Example usage: <script src="script.js"></script>
// Make sure to test the functionality in a browser that supports localStorage