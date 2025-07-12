document.addEventListener('DOMContentLoaded', () => {
    const lastFedElement = document.getElementById('last-fed');
    const feedButton = document.getElementById('feed-btn');

    // Load the last fed time from localStorage
    const lastFedTime = localStorage.getItem('lastFedTime');
    if (lastFedTime) {
        lastFedElement.textContent = `Last fed: ${new Date(lastFedTime).toLocaleString()}`;
    }

    // Add click event listener to the button
    feedButton.addEventListener('click', () => {
        const now = new Date();
        localStorage.setItem('lastFedTime', now.toISOString());
        lastFedElement.textContent = `Last fed: ${now.toLocaleString()}`;
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