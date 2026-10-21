/* ==========================================================================
   NEXUS KNIGHT ANIME - Main JavaScript (script.js)
   Developer: Keelz Valentine
   ========================================================================== */

import {
  getTrending,
  browseAnime,
  getGenres
} from "./anime-api.js";

// --- CONSTANTS & CONFIGURATION ---
const STORAGE_KEY_CONTINUE = "nexus_knight_continue_watching";
const MAX_CONTINUE_ITEMS = 6;
const DEFAULT_PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'><rect width='100%' height='100%' fill='%23121212'/><text x='50%' y='50%' fill='%23666666' font-family='sans-serif' font-size='12' text-anchor='middle'>No Image</text></svg>";

// --- DOM ELEMENTS CACHE ---
let elements = {};

// --- HELPER FUNCTIONS ---

/**
 * Pindah halaman secara aman
 */
function navigateTo(url) {
  if (url) {
    window.location.href = url;
  }
}

/**
 * Debounce helper untuk mengontrol eksekusi fungsi berulang
 */
function debounce(fn, delay = 300) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Update persentase loading screen
 */
function updateProgress(percent) {
  if (elements.loadingProgress) {
    elements.loadingProgress.textContent = `${percent}%`;
  }
}

/**
 * Sembunyikan loading screen
 */
function hideLoading() {
  if (elements.loadingScreen) {
    elements.loadingScreen.style.display = "none";
  }
}

/**
 * Tampilkan pesan error di UI
 */
function showError(message) {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = message;
    elements.errorMessage.style.display = "block";
  }
}

/**
 * Sembunyikan pesan error
 */
function hideError() {
  if (elements.errorMessage) {
    elements.errorMessage.textContent = "";
    elements.errorMessage.style.display = "none";
  }
}

// --- CARD CREATION & SANITIZATION ---

/**
 * Buat card anime dengan DOM API (Aman dari XSS / tanpa innerHTML mentah dari API)
 */
function createAnimeCard(anime) {
  const card = document.createElement("article");
  card.className = "anime-card";

  const posterImg = document.createElement("img");
  posterImg.className = "anime-poster";
  posterImg.src = anime.poster || DEFAULT_PLACEHOLDER_IMG;
  posterImg.alt = anime.title || "Anime Poster";
  posterImg.loading = "lazy";
  
  // Fallback jika gambar gagal dimuat
  posterImg.onerror = () => {
    posterImg.onerror = null;
    posterImg.src = DEFAULT_PLACEHOLDER_IMG;
  };

  const infoDiv = document.createElement("div");
  infoDiv.className = "anime-info";

  const titleEl = document.createElement("h3");
  titleEl.className = "anime-title";
  titleEl.textContent = anime.title || "Untitled";

  const metaDiv = document.createElement("div");
  metaDiv.className = "anime-meta";

  if (anime.episode) {
    const epBadge = document.createElement("span");
    epBadge.className = "badge";
    epBadge.textContent = `Ep ${anime.episode}`;
    metaDiv.appendChild(epBadge);
  } else if (anime.type || anime.status) {
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = anime.type || anime.status;
    metaDiv.appendChild(statusBadge);
  }

  const watchBtn = document.createElement("button");
  watchBtn.type = "button";
  watchBtn.className = "btn btn-primary";
  watchBtn.style.marginTop = "8px";
  watchBtn.style.width = "100%";
  watchBtn.style.minHeight = "36px";
  watchBtn.style.fontSize = "0.75rem";
  watchBtn.textContent = "WATCH NOW";

  const slug = anime.slug || anime.id || "";

  watchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (slug) {
      navigateTo(`/watch.html?slug=${encodeURIComponent(slug)}`);
    }
  });

  infoDiv.appendChild(titleEl);
  infoDiv.appendChild(metaDiv);
  infoDiv.appendChild(watchBtn);

  card.appendChild(posterImg);
  card.appendChild(infoDiv);

  card.addEventListener("click", () => {
    if (slug) {
      navigateTo(`/watch.html?slug=${encodeURIComponent(slug)}`);
    }
  });

  return card;
}

/**
 * Render daftar item ke container dengan penanganan empty state
 */
function renderList(container, items, emptyMessage = "Tidak ada data.") {
  if (!container) return;
  container.innerHTML = "";

  if (!items || !Array.isArray(items) || items.length === 0) {
    const msg = document.createElement("p");
    msg.style.color = "var(--text-gray)";
    msg.style.fontSize = "0.9rem";
    msg.style.gridColumn = "1 / -1";
    msg.textContent = emptyMessage;
    container.appendChild(msg);
    return;
  }

  items.forEach(item => {
    const card = createAnimeCard(item);
    container.appendChild(card);
  });
}

// --- FEATURE MODULES ---

/**
 * Memuat riwayat Continue Watching dari localStorage
 */
function loadContinueWatching() {
  if (!elements.continueWatching) return;

  try {
    const rawData = localStorage.getItem(STORAGE_KEY_CONTINUE);
    const history = rawData ? JSON.parse(rawData) : [];

    elements.continueWatching.innerHTML = "";

    if (!Array.isArray(history) || history.length === 0) {
      const msg = document.createElement("p");
      msg.style.color = "var(--text-gray)";
      msg.style.fontSize = "0.9rem";
      msg.style.gridColumn = "1 / -1";
      msg.textContent = "Belum ada tontonan yang dilanjutkan.";
      elements.continueWatching.appendChild(msg);
      return;
    }

    history.slice(0, MAX_CONTINUE_ITEMS).forEach(item => {
      const card = document.createElement("article");
      card.className = "continue-card anime-card";

      const posterImg = document.createElement("img");
      posterImg.className = "anime-poster";
      posterImg.src = item.poster || DEFAULT_PLACEHOLDER_IMG;
      posterImg.alt = item.title || "Anime Poster";
      posterImg.loading = "lazy";
      posterImg.onerror = () => {
        posterImg.onerror = null;
        posterImg.src = DEFAULT_PLACEHOLDER_IMG;
      };

      const progressBar = document.createElement("div");
      progressBar.className = "progress-bar";

      const progressFill = document.createElement("div");
      progressFill.className = "progress-fill";

      let percentage = 0;
      if (item.currentTime && item.duration && item.duration > 0) {
        percentage = Math.min(100, Math.max(0, (item.currentTime / item.duration) * 100));
      }
      progressFill.style.width = `${percentage}%`;
      progressBar.appendChild(progressFill);

      const infoDiv = document.createElement("div");
      infoDiv.className = "anime-info";

      const titleEl = document.createElement("h3");
      titleEl.className = "anime-title";
      titleEl.textContent = item.title || "Untitled";

      const metaDiv = document.createElement("div");
      metaDiv.className = "anime-meta";
      metaDiv.textContent = item.episode ? `Episode ${item.episode}` : "Lanjutkan";

      infoDiv.appendChild(titleEl);
      infoDiv.appendChild(metaDiv);

      card.appendChild(posterImg);
      card.appendChild(progressBar);
      card.appendChild(infoDiv);

      card.addEventListener("click", () => {
        if (item.slug) {
          navigateTo(`/watch.html?slug=${encodeURIComponent(item.slug)}`);
        }
      });

      elements.continueWatching.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading continue watching history:", err);
  }
}

/**
 * Load Trending Anime
 */
async function loadTrendingData() {
  if (!elements.trendingList) return;
  try {
    const res = await getTrending();
    const data = Array.isArray(res) ? res : (res?.data || res?.results || []);
    renderList(elements.trendingList, data, "Tidak ada anime trending.");
  } catch (err) {
    renderList(elements.trendingList, [], "Gagal memuat anime trending.");
  }
}

/**
 * Load Latest Anime
 */
async function loadLatestData() {
  if (!elements.latestList) return;
  try {
    const res = await browseAnime({ order: "latest", page: 1 });
    const data = Array.isArray(res) ? res : (res?.data || res?.results || []);
    renderList(elements.latestList, data, "Tidak ada anime terbaru.");
  } catch (err) {
    renderList(elements.latestList, [], "Gagal memuat anime terbaru.");
  }
}

/**
 * Load Popular Anime
 */
async function loadPopularData() {
  if (!elements.popularList) return;
  try {
    const res = await browseAnime({ order: "popular", page: 1 });
    const data = Array.isArray(res) ? res : (res?.data || res?.results || []);
    renderList(elements.popularList, data, "Tidak ada anime populer.");
  } catch (err) {
    renderList(elements.popularList, [], "Gagal memuat anime populer.");
  }
}

/**
 * Load Genres List
 */
async function loadGenreData() {
  if (!elements.genreList) return;
  try {
    const res = await getGenres();
    const genres = Array.isArray(res) ? res : (res?.data || res?.results || []);

    elements.genreList.innerHTML = "";
    if (!genres || genres.length === 0) {
      const msg = document.createElement("p");
      msg.style.color = "var(--text-gray)";
      msg.style.fontSize = "0.9rem";
      msg.textContent = "Tidak ada genre tersedia.";
      elements.genreList.appendChild(msg);
      return;
    }

    genres.forEach(genre => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "genre-chip";
      btn.textContent = typeof genre === "string" ? genre : (genre.name || genre.title || "Genre");

      const genreId = typeof genre === "object" ? (genre.slug || genre.id || genre.name) : genre;
      btn.addEventListener("click", () => {
        navigateTo(`/search.html?genre=${encodeURIComponent(genreId)}`);
      });

      elements.genreList.appendChild(btn);
    });
  } catch (err) {
    elements.genreList.innerHTML = "";
    const msg = document.createElement("p");
    msg.style.color = "var(--text-gray)";
    msg.style.fontSize = "0.9rem";
    msg.textContent = "Gagal memuat daftar genre.";
    elements.genreList.appendChild(msg);
  }
}

/**
 * Setup Event Listener Form Pencarian
 */
function setupSearch() {
  if (!elements.searchForm || !elements.searchInput) return;

  elements.searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = elements.searchInput.value.trim();
    if (!query) return;

    navigateTo(`/search.html?query=${encodeURIComponent(query)}`);
  });
}

// --- INITIALIZATION ---

async function init() {
  // Ambil referensi elemen DOM secara aman
  elements = {
    loadingScreen: document.getElementById("loadingScreen"),
    loadingProgress: document.getElementById("loadingProgress"),
    searchForm: document.getElementById("searchForm"),
    searchInput: document.getElementById("searchInput"),
    trendingList: document.getElementById("trendingList"),
    latestList: document.getElementById("latestList"),
    popularList: document.getElementById("popularList"),
    genreList: document.getElementById("genreList"),
    continueWatching: document.getElementById("continueWatching"),
    errorMessage: document.getElementById("errorMessage")
  };

  hideError();
  updateProgress(10);

  setupSearch();
  loadContinueWatching();
  updateProgress(30);

  // Jalankan request API secara bersamaan agar optimal
  updateProgress(50);
  await Promise.allSettled([
    loadTrendingData(),
    loadLatestData(),
    loadPopularData(),
    loadGenreData()
  ]);

  updateProgress(80);
  updateProgress(100);

  // Sembunyikan loading screen setelah selesai
  setTimeout(() => {
    hideLoading();
  }, 100);
}

// Pastikan DOM sudah siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// Export modul jika dibutuhkan script lain
export {
  createAnimeCard,
  navigateTo,
  debounce,
  loadContinueWatching,
  showError,
  hideError
};
