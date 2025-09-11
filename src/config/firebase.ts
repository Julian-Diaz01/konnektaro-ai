import admin from "firebase-admin";
import serviceAccount from "../../serviceAccountKey.json";


if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount)
    })
    console.log('✅ Firebase Admin initialized successfully')
} else {
    console.warn('⚠️ Firebase Admin was already initialized or failed to initialize')
}
export default admin
