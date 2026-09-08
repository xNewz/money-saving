import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getAdminDb() {
  if (!getApps().length) {
    try {
      console.log("Initializing Firebase Admin...");
      console.log("Client Email:", process.env.FIREBASE_CLIENT_EMAIL ? "Exists" : "Missing");
      console.log("Private Key length:", process.env.FIREBASE_PRIVATE_KEY?.length);
      
      const serviceAccount = {
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "demo@demo.com",
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      };
      
      if (serviceAccount.privateKey) {
        console.log("Initializing with full credentials");
        initializeApp({ credential: cert(serviceAccount) });
      } else {
        console.warn("Initializing with projectId only (Missing Private Key)");
        // Fallback for build time
        initializeApp({ projectId: serviceAccount.projectId });
      }
    } catch (error) {
      console.error('Firebase admin initialization error', error);
    }
  }
  return getFirestore();
}
