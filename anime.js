/* ==========================================================================
   NEXUS KNIGHT ANIME - Anime Library Logic (anime.js)
   Developer: Keelz Valentine
   ========================================================================== */

import {
  browseAnime,
  getGenres
} from "./anime-api.js";

// --- CONSTANTS & DEFAULT STATE ---
const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'><rect width='100%' height='100%' fill='%23121212'/><text x='50%' y='50%' fill='%23666666' font-family='sans-serif' font-size='12' text-anchor='middle'>No Image</text></svg>";

let currentState = {
  query: "",
  page: 1,
  sort: "latest",
  tag: ""
};

let elements = {};

// --- HELPER: DEBOUNCE ---
function debounce(fn, delay = 400) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --- URL STATE MANAGEMENT ---

/**
 * Membaca URL query parameters sebagai state awal halaman
 */
function readStateFromURL() {
  const params = new URLSearchParams(window.location.search);
  currentState.query = params.get("query") || "";
  currentState.page = parseInt(params.get("page"), 10) || 1;
  currentState.sort = params.get("sort") || "latest";
  currentState.tag = params.get("tag") || "";
}

/**
 * Memperbarui URL di browser tanpa me-reload halaman
 */
function updateURLState(push = true) {
  const params = new URLSearchParams();
  if (currentState.query) params.set("query", currentState.query);
  if (currentState.page > 1) params.set("page", currentState.page.toString());
  if (currentState.sort && currentState.sort !== "latest") params.set("sort", currentState.sort);
  if (currentState.tag) params.set("tag", currentState.tag);

  const queryString = params.toString();
  const newRelativePathQuery = window.location.pathname + (queryString ? `?${queryString}` : "");

  if (push) {
    window.history.pushState(currentState, "", newRelativePathQuery);
  } else {
    window.history.replaceState(currentState, "", newRelativePathQuery);
  }
}

/**
 * Sinkronisasi nilai kontrol UI dengan state saat ini
 */
function syncUIWithState() {
  if (elements.searchInput) elements.searchInput.value = currentState.query;
  if (elements.sortSelect) elements.sortSelect.value = currentState.sort;
  if (elements.tagSelect) elements.tagSelect.value = currentState.tag;

  if (elements.pageIndicator) {
    elements.pageIndicator.textContent = `PAGE ${currentState.page}`;
  }

  // Highlight genre chip yang aktif jika ada
  if (elements.genreContainer) {
    const chips = elements.genreContainer.querySelectorAll(".genre-chip");
    chips.forEach(chip => {
      if (chip.dataset.tag === currentState.tag && currentState.tag !== "") {
        chip.style.borderColor = "var(--neon-green)";
        chip.style.color = "var(--neon-green)";
        chip.style.backgroundColor = "rgba(0, 255, 102, 0.1)";
      } else {
        chip.style.borderColor = "var(--border-color)";
        chip.style.color = "var(--text-gray)";
        chip.style.backgroundColor = "var(--bg-card)";
      }
    });
  }
}

// --- UI DISPLAY STATE HELPERS ---

function showLoading() {
  if (elements.loading) elements.loading.hidden = false;
  if (elements.empty) elements.empty.hidden = true;
  if (elements.error) elements.error.hidden = true;
  if (elements.grid) elements.grid.style.display = "none";
}

function showGrid() {
  if (elements.loading) elements.loading.hidden = true;
  if (elements.empty) elements.empty.hidden = true;
  if (elements.error) elements.error.hidden = true;
  if (elements.grid) elements.grid.style.display = "grid";
}

function showEmpty() {
  if (elements.loading) elements.loading.hidden = true;
  if (elements.empty) elements.empty.hidden = false;
  if (elements.error) elements.error.hidden = true;
  if (elements.grid) elements.grid.style.display = "none";
}

function showError() {
  if (elements.loading) elements.loading.hidden = true;
  if (elements.empty) elements.empty.hidden = true;
  if (elements.error) elements.error.hidden = false;
  if (elements.grid) elements.grid.style.display = "none";
}

// --- CARD RENDERER (XSS SAFE & SEMANTIC) ---

/**
 * Membuat elemen kartu anime
 */
function createAnimeCard(anime) {
  const slug = anime.slug || anime.id || "";

  // Jika slug tidak tersedia, tampilkan card yang ter-disabled
  if (!slug) {
    const cardDiv = document.createElement("div");
    cardDiv.className = "anime-card";
    cardDiv.style.opacity = "0.6";
    cardDiv.style.cursor = "not-allowed";

    const poster = document.createElement("img");
    poster.className = "anime-poster";
    poster.src = anime.image || anime.poster || anime.thumbnail || anime.cover || DEFAULT_PLACEHOLDER;
    poster.alt = anime.title || "Anime Poster";
    poster.loading = "lazy";
    poster.decoding = "async";
    poster.onerror = () => {
      poster.onerror = null;
      poster.src = DEFAULT_PLACEHOLDER;
    };

    const info = document.createElement("div");
    info.className = "anime-info";

    const title = document.createElement("h3");
    title.className = "anime-title";
    title.textContent = anime.title || "Unavailable";

    info.appendChild(title);
    cardDiv.appendChild(poster);
    cardDiv.appendChild(info);
    return cardDiv;
  }

  const detailUrl = `/detail.html?slug=${encodeURIComponent(slug)}`;

  const cardLink = document.createElement("a");
  cardLink.className = "anime-card";
  cardLink.href = detailUrl;
  cardLink.dataset.slug = slug;

  const poster = document.createElement("img");
  poster.className = "anime-poster";
  poster.src = anime.image || anime.poster || anime.thumbnail || anime.cover || DEFAULT_PLACEHOLDER;
  poster.alt = anime.title || "Anime Poster";
  poster.loading = "lazy";
  poster.decoding = "async";
  poster.onerror = () => {
    poster.onerror = null;
    poster.src = DEFAULT_PLACEHOLDER;
  };

  const info = document.createElement("div");
  info.className = "anime-info";

  const title = document.createElement("h3");
  title.className = "anime-title";
  title.textContent = anime.title || "Untitled Anime";

  const meta = document.createElement("div");
  meta.className = "anime-meta";

  const episodes = anime.episodes || anime.episode;
  const status = anime.status || anime.type;

  if (episodes) {
    const epBadge = document.createElement("span");
    epBadge.className = "badge";
    epBadge.textContent = `Ep ${episodes}`;
    meta.appendChild(epBadge);
  } else if (status) {
    const statusBadge = document.createElement("span");
    statusBadge.className = "badge";
    statusBadge.textContent = status;
    meta.appendChild(statusBadge);
  }

  info.appendChild(title);
  if (meta.hasChildNodes()) {
    info.appendChild(meta);
  }

  cardLink.appendChild(poster);
  cardLink.appendChild(info);

  return cardLink;
}

// --- DATA FETCHING & RENDERING ---

/**
 * Mengambil data anime dari API berdasarkan currentState
 */
async function fetchAnime() {
  showLoading();
  syncUIWithState();

  try {
    const results = await browseAnime({
      query: currentState.query,
      tag: currentState.tag,
      page: currentState.page,
      sort: currentState.sort
    });

    const animeList = Array.isArray(results) ? results : (results?.data || results?.results || []);

    if (!animeList || animeList.length === 0) {
      showEmpty();
      updatePaginationControls(0);
      return;
    }

    if (elements.grid) {
      elements.grid.innerHTML = "";
      animeList.forEach(anime => {
        const card = createAnimeCard(anime);
        elements.grid.appendChild(card);
      });
    }

    showGrid();
    updatePaginationControls(animeList.length);

  } catch (error) {
    console.error("[NEXUS ANIME]", error);
    showError();
  }
}

/**
 * Mengambil daftar genre/tag dari API dan merender dropdown & chip
 */
async function fetchAndRenderGenres() {
  try {
    const genres = await getGenres();
    const genreArray = Array.isArray(genres) ? genres : (genres?.data || []);

    // 1. Opsi Select Dropdown
    if (elements.tagSelect) {
      elements.tagSelect.innerHTML = '<option value="">All</option>';
      genreArray.forEach(g => {
        const name = typeof g === "string" ? g : (g.name || g.title || "");
        const val = typeof g === "string" ? g : (g.slug || g.id || g.name || "");
        if (val && name) {
          const opt = document.createElement("option");
          opt.value = val;
          opt.textContent = name;
          elements.tagSelect.appendChild(opt);
        }
      });
      elements.tagSelect.value = currentState.tag;
    }

    // 2. Chip Buttons
    if (elements.genreContainer) {
      elements.genreContainer.innerHTML = "";
      genreArray.forEach(g => {
        const name = typeof g === "string" ? g : (g.name || g.title || "");
        const val = typeof g === "string" ? g : (g.slug || g.id || g.name || "");

        if (!val || !name) return;

        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "genre-chip";
        chip.dataset.tag = val;
        chip.textContent = name;

        chip.addEventListener("click", () => {
          if (currentState.tag === val) {
            currentState.tag = ""; // Unselect jika diklik ulang
          } else {
            currentState.tag = val;
          }
          currentState.page = 1;
          updateURLState(true);
          fetchAnime();
        });

        elements.genreContainer.appendChild(chip);
      });
      syncUIWithState();
    }
  } catch (error) {
    console.error("[NEXUS ANIME] Failed to load genres:", error);
  }
}

// --- PAGINATION CONTROL ---

/**
 * Mengatur status tombol pagination
 */
function updatePaginationControls(currentResultCount) {
  const isFirstPage = currentState.page <= 1;
  const isLastPage = currentResultCount < 10; // Asumsi batas item minimum halaman penuh

  [elements.prevPage, elements.btnPaginationPrev].forEach(btn => {
    if (btn) {
      btn.disabled = isFirstPage;
      btn.style.opacity = isFirstPage ? "0.5" : "1";
      btn.style.cursor = isFirstPage ? "not-allowed" : "pointer";
    }
  });

  [elements.nextPage, elements.btnPaginationNext].forEach(btn => {
    if (btn) {
      btn.disabled = isLastPage;
      btn.style.opacity = isLastPage ? "0.5" : "1";
      btn.style.cursor = isLastPage ? "not-allowed" : "pointer";
    }
  });
}

/**
 * Pindah halaman dan scroll ke atas secara halus
 */
function changePage(newPage) {
  if (newPage < 1 || newPage === currentState.page) return;
  currentState.page = newPage;
  updateURLState(true);
  fetchAnime().then(() => {
    const targetScroll = elements.grid || elements.searchForm;
    if (targetScroll) {
      targetScroll.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

// --- INITIALIZATION & EVENT HANDLERS ---

function init() {
  // Cache referensi elemen DOM dari anime.html
  elements = {
    searchForm: document.getElementById("animeSearchForm"),
    searchInput: document.getElementById("animeSearchInput"),
    sortSelect: document.getElementById("sortSelect"),
    tagSelect: document.getElementById("tagSelect"),
    genreContainer: document.getElementById("animeGenres"),
    grid: document.getElementById("animeGrid"),
    loading: document.getElementById("animeLoading"),
    empty: document.getElementById("animeEmpty"),
    error: document.getElementById("animeError"),
    retryBtn: document.getElementById("animeRetry"),
    paginationNav: document.getElementById("pagination"),
    prevPage: document.getElementById("prevPage"),
    nextPage: document.getElementById("nextPage"),
    btnPaginationPrev: document.getElementById("btnPaginationPrev"),
    btnPaginationNext: document.getElementById("btnPaginationNext"),
    pageIndicator: document.getElementById("pageIndicator")
  };

  // 1. Baca URL parameter awal
  readStateFromURL();

  // 2. Setup listener Form Pencarian
  if (elements.searchForm) {
    elements.searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const queryValue = elements.searchInput ? elements.searchInput.value.trim() : "";
      currentState.query = queryValue;
      currentState.page = 1;
      updateURLState(true);
      fetchAnime();
    });
  }

  // 3. Listener Sort Select
  if (elements.sortSelect) {
    elements.sortSelect.addEventListener("change", (e) => {
      currentState.sort = e.target.value || "latest";
      currentState.page = 1;
      updateURLState(true);
      fetchAnime();
    });
  }

  // 4. Listener Tag Select
  if (elements.tagSelect) {
    elements.tagSelect.addEventListener("change", (e) => {
      currentState.tag = e.target.value || "";
      currentState.page = 1;
      updateURLState(true);
      fetchAnime();
    });
  }

  // 5. Listener Tombol Pagination Previous
  [elements.prevPage, elements.btnPaginationPrev].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        if (currentState.page > 1) {
          changePage(currentState.page - 1);
        }
      });
    }
  });

  // 6. Listener Tombol Pagination Next
  [elements.nextPage, elements.btnPaginationNext].forEach(btn => {
    if (btn) {
      btn.addEventListener("click", () => {
        changePage(currentState.page + 1);
      });
    }
  });

  // 7. Listener Tombol Retry
  if (elements.retryBtn) {
    elements.retryBtn.addEventListener("click", () => {
      fetchAnime();
    });
  }

  // 8. Listener Browser History (Popstate)
  window.addEventListener("popstate", () => {
    readStateFromURL();
    fetchAnime();
  });

  // 9. Load Genres dan Anime awal
  fetchAndRenderGenres();
  fetchAnime();
}

// Jalankan ketika DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
