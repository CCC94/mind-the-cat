/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

exports.sendOverdueChoreNotifications = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const db = admin.firestore();

    // 1. Query all groups and chores
    const groupsSnapshot = await db.collection('groups').get();
    for (const groupDoc of groupsSnapshot.docs) {
        const groupId = groupDoc.id;
        const choresSnapshot = await db.collection('groups').doc(groupId).collection('chores').get();

        for (const choreDoc of choresSnapshot.docs) {
            const chore = choreDoc.data();
            // 2. Check if the chore is overdue (implement your logic here)
            if (isChoreOverdue(chore)) {
                // 3. Get the user(s) to notify (e.g., all group members)
                const groupData = groupDoc.data();
                for (const memberId in groupData.members) {
                    // 4. Get the member's FCM token
                    const userDoc = await db.collection('users').doc(memberId).get();
                    const fcmToken = userDoc.data().fcmToken;
                    if (fcmToken) {
                        // 5. Send the notification
                        await admin.messaging().send({
                            token: fcmToken,
                            notification: {
                                title: 'Chore Overdue!',
                                body: `The chore "${chore.name}" is overdue in your group.`
                            }
                        });
                    }
                }
            }
        }
    }
    return null;
});

// Helper function (implement your own logic)
function isChoreOverdue(chore) {
    if (!chore.lastDone || !chore.intervalValue || !chore.intervalUnit) return false;
    const lastDone = chore.lastDone._seconds * 1000;
    let intervalMs = 0;
    if (chore.intervalUnit === "minutes") intervalMs = chore.intervalValue * 60 * 1000;
    if (chore.intervalUnit === "hours") intervalMs = chore.intervalValue * 60 * 60 * 1000;
    if (chore.intervalUnit === "days") intervalMs = chore.intervalValue * 24 * 60 * 60 * 1000;
    return Date.now() > lastDone + intervalMs;
}
