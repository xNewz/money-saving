import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export function getAdminDb() {
  if (!getApps().length) {
    try {
      const serviceAccount = {
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-project",
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "demo@demo.com",
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, '\n'),
      };
      
      if (serviceAccount.privateKey) {
        initializeApp({ credential: cert(serviceAccount) });
      } else {
        // Fallback for build time
        initializeApp({ projectId: serviceAccount.projectId });
      }
    } catch (error) {
      console.error('Firebase admin initialization error', error);
    }
  }
  return getFirestore();
}
