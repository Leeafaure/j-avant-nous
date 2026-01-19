/* eslint-disable */
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDGrfSUU7mo7lALwMCoxNozQYyLqQQEcYE",
  authDomain: "j-avant-nous.firebaseapp.com",
  projectId: "j-avant-nous",
  storageBucket: "j-avant-nous.firebasestorage.app",
  messagingSenderId: "71780708901",
  appId: "1:71780708901:web:53c4e4702b500fa5aa45cc",
  measurementId: "G-7D2ZCHFV16",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
