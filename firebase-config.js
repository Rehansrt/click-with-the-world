// Paste the values from Firebase Console > Project settings > General > Your apps > SDK setup and configuration.
// These identifiers are meant to be public in client-side code — access control is enforced by
// database.rules.json, not by hiding this file. See README.md for the full walkthrough.
export const firebaseConfig = {
  apiKey: "AIzaSyBiZeK0QD9axAAQGtfiWN8TlpIXNZr8CVQ",
  authDomain: "click-with-the-world.firebaseapp.com",
  databaseURL: "https://click-with-the-world-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "click-with-the-world",
  storageBucket: "click-with-the-world.firebasestorage.app",
  messagingSenderId: "874683725656",
  appId: "1:874683725656:web:c7192259b92371a2dc572d",
  measurementId: "G-SYQY16SR0D"
};

// App Check / reCAPTCHA Enterprise site key — also meant to be public client-side
// (it identifies the reCAPTCHA config, not a secret). Used by app.js and
// embed-widget.js to gate Realtime Database writes against bot abuse.
export const recaptchaSiteKey = "6Ld0ebktAAAAAH4-vbZm6glzUaDgIwxcJWR8HWsB";
