import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Your config
const firebaseConfig = {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    // etc.
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
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
