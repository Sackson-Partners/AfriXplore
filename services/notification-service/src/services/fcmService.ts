import { App, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

let firebaseApp: App | null = null;

function getFirebaseApp(): App {
  if (!firebaseApp) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '{}'
    );
    firebaseApp = initializeApp({ credential: cert(serviceAccount) });
  }
  return firebaseApp;
}

export async function sendFCMPush(
  fcmToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  const messaging = getMessaging(getFirebaseApp());

  await messaging.send({
    token: fcmToken,
    notification: { title, body },
    data,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'afrixplore_alerts',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  });

  console.log('FCM push sent');
}

export async function sendFCMToMultiple(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) return;

  const messaging = getMessaging(getFirebaseApp());

  for (let i = 0; i < tokens.length; i += 500) {
    const batch = tokens.slice(i, i + 500);
    await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data,
    });
  }
}
