// This script is used to set a user as an admin in Firebase.
// Usage: node scripts/setAdmin.js <user_email>

import admin from 'firebase-admin';
import { createRequire } from 'module';

// Since this is an ES module, 'require' is not defined by default.
// We use 'createRequire' to be able to load a JSON file.
const require = createRequire(import.meta.url);

// IMPORTANT: Path to your Firebase service account key JSON file.
// Download this from your Firebase project settings.
// DO NOT COMMIT THIS FILE TO YOUR REPOSITORY.
// It's recommended to set the GOOGLE_APPLICATION_CREDENTIALS environment variable instead.
const serviceAccount = require('../simulado-concurso-ia-firebase-adminsdk-qni2k-620282a514.json'); // Adjust the path as needed

// The email of the user to make an admin, passed as a command-line argument.
const userEmail = process.argv[2];

if (!userEmail) {
    console.error("Error: Please provide the user's email as an argument.");
    console.log('Usage: node scripts/setAdmin.js <user_email>');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const setAdminClaim = async () => {
    try {
        // Find the user by email
        const user = await admin.auth().getUserByEmail(userEmail);

        // Set the custom claim 'admin' to true
        await admin.auth().setCustomUserClaims(user.uid, { admin: true });

        console.log(`Success! User ${userEmail} (UID: ${user.uid}) has been made an admin.`);
        console.log('The user must sign out and sign back in for the changes to take effect.');
        process.exit(0);
    } catch (error) {
        console.error('Error setting admin claim:', error.message);
        process.exit(1);
    }
};

setAdminClaim();
