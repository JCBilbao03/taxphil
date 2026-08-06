import fs from 'node:fs'
import path from 'node:path'

import type { Plugin } from 'vite'

const FIREBASE_VERSION = '12.16.0'

function buildServiceWorkerContent(env: Record<string, string>) {
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: env.VITE_FIREBASE_APP_ID ?? '',
  }

  return `importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(firebaseConfig)});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'TaxPhil Support';
  const options = {
    body: payload.notification?.body || 'You have a new support message.',
    icon: '/favicon.svg',
    data: {
      url: payload.data?.url || '/connect',
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/connect';
  event.waitUntil(clients.openWindow(targetUrl));
});
`
}

export function firebaseMessagingSwPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'firebase-messaging-sw',
    buildStart() {
      const outputPath = path.resolve('public/firebase-messaging-sw.js')
      fs.writeFileSync(outputPath, buildServiceWorkerContent(env))
    },
  }
}
