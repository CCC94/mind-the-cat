import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

const firebaseConfig = {
    apiKey: "AIzaSyCHpFshdCJ7eer8adXGp3pBoMcFs8TOhVU",
    authDomain: "mindthecat-59b98.firebaseapp.com",
    projectId: "mindthecat-59b98",
    storageBucket: "mindthecat-59b98.firebasestorage.app",
    messagingSenderId: "493425096678",
    appId: "1:493425096678:web:6e59c43655f3abe20e0827",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.getElementById("login-btn").addEventListener("click", () => {
    signInWithPopup(auth, provider).catch((error) => {
        console.error("Login error:", error);
    });
});

document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userInfo = document.getElementById("user-info");

    if (user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userInfo.textContent = `Logged in as ${user.displayName}`;
        window.currentUser = user;
        document.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
    } else {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userInfo.textContent = "";
        window.currentUser = null;
    }
});
