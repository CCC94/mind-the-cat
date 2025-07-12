import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

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

function showView(viewId) {
    document.querySelectorAll(".view").forEach(div => {
        div.style.display = div.id === viewId ? "block" : "none";
    });
}

document.getElementById("login-btn").addEventListener("click", () => {
    signInWithPopup(auth, provider)
        .then(result => {
            const user = result.user;
            window.currentUser = user;
            document.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
        })
        .catch(err => {
            alert("Login failed: " + err.message);
        });
});

document.getElementById("logout-btn").addEventListener("click", () => {
    signOut(auth).then(() => {
        showView("login-view");
    });
});

onAuthStateChanged(auth, user => {
    if (user) {
        window.currentUser = user;
        document.dispatchEvent(new CustomEvent("user-ready", { detail: user }));
    } else {
        showView("login-view");
    }
});

document.addEventListener("user-ready", e => {
    const user = e.detail;
    document.getElementById("user-info").textContent = `Logged in as ${user.displayName}`;
    showView("groups-view");
});
