/* ==========================================================================
   NEXUS KNIGHT ANIME - Realtime Chat Module (chat.js)
   Developer: Keelz Valentine
   ========================================================================== */

import {
  db,
  messagesRef
} from "./firebase.js";

import {
  ref,
  push,
  set,
  onChildAdded,
  serverTimestamp,
  query,
  limitToLast
} from "firebase/database";

// --- CONSTANTS & CONFIGURATION ---
const STORAGE_KEY_USERNAME = "nexus_knight_username";
const MAX_USERNAME_LENGTH = 24;
const MAX_MESSAGE_LENGTH = 500;
const MAX_DOM_MESSAGES = 100;
const INITIAL_MESSAGE_LIMIT = 50;
const COOLDOWN_MS = 1000;

// --- STATE VARIABLES ---
let elements = {};
const renderedMessageIds = new Set();
let isSending = false;
let lastSendTime = 0;

// --- HELPER FUNCTIONS ---

/**
 * Format timestamp menjadi string jam:menit (HH:MM)
 */
function formatTimestamp(ts) {
  if (!ts) return "Baru saja";
  const date = new Date(ts);
  if (isNaN(date.getTime())) return "Baru saja";
  
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Update tampilan status koneksi chat
 */
function updateStatus(statusText, isError = false) {
  if (elements.chatStatus) {
    elements.chatStatus.textContent = statusText;
    elements.chatStatus.style.color = isError ? "var(--neon-red, #ff2a5f)" : "var(--neon-green, #00ff66)";
  }
}

/**
 * Scroll kontainer chat ke bagian paling bawah
 */
function scrollToBottom() {
  if (elements.chatMessages) {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }
}

/**
 * Hapus elemen pesan lama dari DOM jika jumlah pesan melebihi batas
 */
function trimDomMessages() {
  const container = elements.chatMessages;
  if (!container) return;

  while (container.children.length > MAX_DOM_MESSAGES) {
    const firstChild = container.firstElementChild;
    if (firstChild && firstChild.dataset.id) {
      renderedMessageIds.delete(firstChild.dataset.id);
    }
    container.removeChild(firstChild);
  }
}

/**
 * Ubah status UI tombol kirim pesan saat proses pengiriman
 */
function setSendingState(sending) {
  isSending = sending;
  if (elements.sendMessageBtn) {
    elements.sendMessageBtn.disabled = sending;
    elements.sendMessageBtn.textContent = sending ? "SENDING..." : "SEND";
  }
}

// --- RENDER MESSAGE (SANITISED & XSS PROTECTED) ---

/**
 * Render satu elemen pesan ke dalam UI secara aman
 */
function renderMessage(id, data) {
  if (!id || renderedMessageIds.has(id)) return;
  renderedMessageIds.add(id);

  const usernameText = (data.username || "Anonymous").trim().substring(0, MAX_USERNAME_LENGTH);
  const messageText = (data.text || "").trim().substring(0, MAX_MESSAGE_LENGTH);
  const timeText = formatTimestamp(data.timestamp);

  // Buat elemen DOM
  const msgCard = document.createElement("div");
  msgCard.className = "chat-message-item";
  msgCard.dataset.id = id;
  msgCard.style.padding = "8px 12px";
  msgCard.style.marginBottom = "8px";
  msgCard.style.backgroundColor = "var(--bg-card, #121212)";
  msgCard.style.border = "1px solid var(--border-color, #222222)";
  msgCard.style.borderRadius = "var(--border-radius, 8px)";

  const headerDiv = document.createElement("div");
  headerDiv.style.display = "flex";
  headerDiv.style.justifyContent = "space-between";
  headerDiv.style.alignItems = "center";
  headerDiv.style.marginBottom = "4px";

  // Username (Sanitised textContent)
  const usernameEl = document.createElement("strong");
  usernameEl.style.fontSize = "0.85rem";
  usernameEl.style.color = "var(--neon-green, #00ff66)";
  usernameEl.textContent = usernameText;

  // Timestamp (Sanitised textContent)
  const timeEl = document.createElement("span");
  timeEl.style.fontSize = "0.7rem";
  timeEl.style.color = "var(--text-gray, #a0a0a0)";
  timeEl.textContent = timeText;

  headerDiv.appendChild(usernameEl);
  headerDiv.appendChild(timeEl);

  // Body Pesan (Sanitised textContent - Proteksi XSS)
  const bodyDiv = document.createElement("div");
  bodyDiv.style.fontSize = "0.9rem";
  bodyDiv.style.color = "var(--text-white, #ffffff)";
  bodyDiv.style.wordBreak = "break-word";
  bodyDiv.style.lineHeight = "1.4";
  bodyDiv.textContent = messageText;

  msgCard.appendChild(headerDiv);
  msgCard.appendChild(bodyDiv);

  const container = elements.chatMessages;
  if (!container) return;

  // Cek apakah posisi scroll user berada dekat dengan bagian bawah
  const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;

  container.appendChild(msgCard);

  // Jaga batasan jumlah DOM pesan
  trimDomMessages();

  // Scroll otomatis jika user berada di paling bawah
  if (isAtBottom) {
    scrollToBottom();
  }
}

// --- SEND MESSAGE HANDLER ---

/**
 * Menangani pengiriman pesan baru ke Firebase Realtime Database
 */
async function handleSendMessage(e) {
  if (e) e.preventDefault();
  if (isSending) return;

  const now = Date.now();
  if (now - lastSendTime < COOLDOWN_MS) {
    return;
  }

  const rawUsername = elements.usernameInput ? elements.usernameInput.value : "";
  const rawText = elements.chatInput ? elements.chatInput.value : "";

  const username = rawUsername.trim().substring(0, MAX_USERNAME_LENGTH);
  const text = rawText.trim().substring(0, MAX_MESSAGE_LENGTH);

  if (!username) {
    alert("Username tidak boleh kosong.");
    if (elements.usernameInput) elements.usernameInput.focus();
    return;
  }

  if (!text) {
    return;
  }

  // Simpan username ke localStorage untuk pemakaian berikutnya
  try {
    localStorage.setItem(STORAGE_KEY_USERNAME, username);
  } catch (err) {
    // Abaikan jika localStorage diblokir
  }

  setSendingState(true);

  try {
    if (!messagesRef) {
      throw new Error("Database reference not available.");
    }

    const newMessageRef = push(messagesRef);
    await set(newMessageRef, {
      username: username,
      text: text,
      timestamp: serverTimestamp()
    });

    if (elements.chatInput) {
      elements.chatInput.value = "";
    }
    lastSendTime = Date.now();
    scrollToBottom();
  } catch (err) {
    console.error("Gagal mengirim pesan chat:", err);
    updateStatus("● CONNECTION ERROR", true);
    alert("Pesan gagal dikirim.");
  } finally {
    setSendingState(false);
  }
}

// --- REALTIME LISTENER ---

/**
 * Inisialisasi listener Firebase Realtime Database
 */
function setupRealtimeListener() {
  if (!messagesRef) {
    updateStatus("● CONNECTION ERROR", true);
    return;
  }

  try {
    // Ambil pesan terbatas terbaru menggunakan limitToLast
    const recentQuery = query(messagesRef, limitToLast(INITIAL_MESSAGE_LIMIT));

    onChildAdded(recentQuery, (snapshot) => {
      updateStatus("● CONNECTED", false);
      const id = snapshot.key;
      const data = snapshot.val();
      if (data) {
        renderMessage(id, data);
      }
    }, (error) => {
      console.error("Firebase chat listener error:", error);
      updateStatus("● CONNECTION ERROR", true);
    });
  } catch (err) {
    console.error("Setup listener error:", err);
    updateStatus("● CONNECTION ERROR", true);
  }
}

// --- INITIALIZATION ---

/**
 * Inisialisasi modul chat
 */
function initChat() {
  elements = {
    chatMessages: document.getElementById("chatMessages"),
    chatForm: document.getElementById("chatForm"),
    chatInput: document.getElementById("chatInput"),
    usernameInput: document.getElementById("usernameInput"),
    sendMessageBtn: document.getElementById("sendMessage") || (document.getElementById("chatForm") ? document.getElementById("chatForm").querySelector("button[type='submit']") : null),
    chatStatus: document.getElementById("chatStatus")
  };

  // Pre-fill username dari localStorage
  try {
    const savedUsername = localStorage.getItem(STORAGE_KEY_USERNAME);
    if (savedUsername && elements.usernameInput) {
      elements.usernameInput.value = savedUsername;
    }
  } catch (err) {
    // Abaikan
  }

  // Pasang listener submit form
  if (elements.chatForm) {
    elements.chatForm.addEventListener("submit", handleSendMessage);
  }

  // Jalankan listener realtime
  setupRealtimeListener();
}

// Jalankan otomatis ketika DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initChat);
} else {
  initChat();
}

// Export fungsi utama
export {
  initChat,
  handleSendMessage
};
