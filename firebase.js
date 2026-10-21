/* ==========================================================================
   NEXUS KNIGHT ANIME - Firebase Initialization Module (firebase.js)
   Developer: Keelz Valentine
   ========================================================================== */

import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  set,
  onValue,
  onChildAdded,
  serverTimestamp
} from "firebase/database";

// Konfigurasi Firebase & Realtime Database
const firebaseConfig = {
  apiKey: "AIzaSyCvezQEeLcj3LUN24xjrUWyNN9ZE-y2Uis",
  authDomain: "xeelzxolvarius.firebaseapp.com",
  projectId: "xeelzxolvarius",
  storageBucket: "xeelzxolvarius.firebasestorage.app",
  messagingSenderId: "93282285966",
  appId: "1:93282285966:web:1bc37aacbf6334e7448cdf",
  databaseURL: "https://xeelzxolvarius-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

let app = null;
let db = null;
let messagesRef = null;

try {
  // Inisialisasi Firebase App
  app = initializeApp(firebaseConfig);
  
  // Inisialisasi Realtime Database
  db = getDatabase(app, firebaseConfig.databaseURL);
  
  // Reference ke root node chat/messages
  messagesRef = ref(db, "chat/messages");
} catch (error) {
  console.error("Inisialisasi Firebase gagal.");
}

// Export database instance & message reference untuk digunakan oleh chat.js
export {
  db,
  messagesRef,
  push,
  set,
  onValue,
  onChildAdded,
  serverTimestamp
};
