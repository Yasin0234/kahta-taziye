import admin from 'firebase-admin';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

let dbInstance: admin.firestore.Firestore | null = null;
let messagingInstance: admin.messaging.Messaging | null = null;

export function initFirebase() {
  if (admin.apps.length > 0) {
    return {
      db: admin.firestore(),
      messaging: admin.messaging(),
    };
  }

  // 1. Durum: FIREBASE_SERVICE_ACCOUNT ortam değişkeni (JSON string veya base64)
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  // 2. Durum: Yerel dosya yolu (ör: ./serviceAccountKey.json)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  let credential: admin.credential.Credential | null = null;

  if (serviceAccountEnv) {
    try {
      let rawJson = serviceAccountEnv.trim();
      // Eğer base64 ile encode edilmişse decode et
      if (!rawJson.startsWith('{')) {
        rawJson = Buffer.from(rawJson, 'base64').toString('utf-8');
      }
      const serviceAccount = JSON.parse(rawJson);
      credential = admin.credential.cert(serviceAccount);
    } catch (e) {
      console.error('FIREBASE_SERVICE_ACCOUNT JSON parse hatası:', e);
      throw new Error('Geçersiz FIREBASE_SERVICE_ACCOUNT ortam değişkeni');
    }
  } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
    const fileContent = fs.readFileSync(serviceAccountPath, 'utf-8');
    const serviceAccount = JSON.parse(fileContent);
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    // 3. Durum: Ayrı ayrı ortam değişkenleri
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else {
    // Fallback: Default application credentials
    try {
      credential = admin.credential.applicationDefault();
    } catch (e) {
      console.warn('Firebase kimlik bilgisi bulunamadı. Lütfen .env dosyasını yapılandırın.');
    }
  }

  if (credential) {
    admin.initializeApp({
      credential,
    });
  } else {
    admin.initializeApp();
  }

  dbInstance = admin.firestore();
  messagingInstance = admin.messaging();

  return {
    db: dbInstance,
    messaging: messagingInstance,
  };
}

export function getFirestore() {
  if (!dbInstance) return initFirebase().db;
  return dbInstance;
}

export function getMessaging() {
  if (!messagingInstance) return initFirebase().messaging;
  return messagingInstance;
}
