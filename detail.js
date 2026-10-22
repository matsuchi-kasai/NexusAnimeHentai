/* ==========================================================================
   NEXUS KNIGHT ANIME - Detail Page Logic (detail.js)
   Developer: Keelz Valentine
   ========================================================================== */

import { getAnimeDetail, getAnimeSeries } from "./anime-api.js";

// --- HELPER FUNCTIONS ---
const $ = (selector) => document.querySelector(selector);

const DEFAULT_PLACEHOLDER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='300' viewBox='0 0 200 300'><rect width='100%' height='100%' fill='%23121212'/><text x='50%' y='50%' fill='%23666666' font-family='sans-serif' font-size='12' text-anchor='middle'>No Image</text></svg>";

/**
 * Membaca slug dari URL query parameter
 */
function getSlugFromURL() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  return slug ? slug.trim() : null;
}

/**
 * Menampilkan status Loading Screen
 */
function showLoading() {
  const loading = $("#detailLoading");
  const error = $("#detailError");
  const content = $("#detailContent");

  if (loading) loading.hidden = false;
  if (error) error.hidden = true;
  if (content) content.hidden = true;
}

/**
 * Menampilkan status Konten Utama
 */
function showContent() {
  const loading = $("#detailLoading");
  const error = $("#detailError");
  const content = $("#detailContent");

  if (loading) loading.hidden = true;
  if (error) error.hidden = true;
  if (content) content.hidden = false;
}

/**
 * Menampilkan status Error Screen
 */
function showError(message) {
  const loading = $("#detailLoading");
  const error = $("#detailError");
  const content = $("#detailContent");

  if (loading) loading.hidden = true;
  if (content) content.hidden = true;
  if (error) {
    error.hidden = false;
    const msgEl = error.querySelector("p");
    if (msgEl && message) {
      msgEl.textContent = message;
    }
  }
  document.title = "NEXUS KNIGHT ANIME";
}

/**
 * Memastikan string aman dari undefined/null/NaN/[object Object]
 */
function safeText(val, fallback = "-") {
  if (val === null || val === undefined || val === "" || Number.isNaN(val) || typeof val === "object") {
    return fallback;
  }
  return String(val).trim();
}

/**
 * Render daftar genre / tags ke UI secara aman
 */
function renderGenres(rawGenres) {
  const container = $("#genreList") \vert{}\vert{} $("#animeGenres");
  if (!container) return;

  container.innerHTML = "";

  let list = [];
  if (Array.isArray(rawGenres)) {
    list = rawGenres;
  } else if (rawGenres && typeof rawGenres === "object") {
    list = rawGenres.genres || rawGenres.tags || rawGenres.genre || [];
  }

  if (!Array.isArray(list) || list.length === 0) {
    const span = document.createElement("span");
    span.style.fontSize = "0.8rem";
    span.style.color = "var(--text-gray)";
    span.textContent = "Tidak ada genre.";
    container.appendChild(span);
    return;
  }

  list.forEach((g) => {
    let name = "";
    if (typeof g === "string") {
      name = g.trim();
    } else if (g && typeof g === "object") {
      name = safeText(g.name || g.title || g.label, "");
    }

    if (name) {
      const chip = document.createElement("span");
      chip.className = "genre-chip";
      chip.style.display = "inline-flex";
      chip.style.alignItems = "center";
      chip.style.padding = "4px 10px";
      chip.style.fontSize = "0.75rem";
      chip.style.backgroundColor = "var(--bg-black)";
      chip.style.border = "1px solid var(--border-color)";
      chip.style.borderRadius = "12px";
      chip.style.color = "var(--text-white)";
      chip.textContent = name;
      container.appendChild(chip);
    }
  });
}

/**
 * Render data utama anime ke elemen HTML
 */
function renderDetailData(detail, slug) {
  const title = safeText(detail.title || detail.name || detail.judul, "Anime Tidak Diketahui");
  document.title = `${title} — NEXUS KNIGHT ANIME`;

  // Title & Breadcrumb
  const titleEl = $("#animeTitle");
  if (titleEl) titleEl.textContent = title;

  const breadcrumbEl = $("#breadcrumbTitle");
  if (breadcrumbEl) breadcrumbEl.textContent = title;

  // Poster
  const posterImg = $("#animePoster");
  if (posterImg) {
    const imageUrl = detail.image || detail.thumbnail || detail.cover || detail.poster || DEFAULT_PLACEHOLDER;
    posterImg.src = imageUrl;
    posterImg.alt = title;
    posterImg.setAttribute("loading", "eager");
    posterImg.setAttribute("decoding", "async");
    posterImg.onerror = () => {
      posterImg.onerror = null;
      posterImg.src = DEFAULT_PLACEHOLDER;
    };
  }

  // Description
  const descEl = $("#animeDescription");
  if (descEl) {
    const synopsis = safeText(detail.description || detail.synopsis || detail.summary, "Sinopsis belum tersedia.");
    descEl.textContent = synopsis;
  }

  // Metadata
  const statusEl = $("#animeStatus");
  if (statusEl) {
    statusEl.textContent = `Status: ${safeText(detail.status)}`;
  }

  const typeEl = $("#animeType");
  if (typeEl) {
    typeEl.textContent = `Type: ${safeText(detail.type)}`;
  }

  const epEl = $("#animeEpisodes");
  if (epEl) {
    const epVal = safeText(detail.episodes || detail.episode);
    epEl.textContent = epVal !== "-" ? `Total: ${epVal} Ep` : "Total Ep: -";
  }

  // Genres
  renderGenres(detail.genres || detail.tags || detail.genre);

  // Tombol Nonton
  const watchBtn = $("#watchBtn");
  if (watchBtn) {
    if (slug) {
      const watchUrl = `/watch.html?slug=${encodeURIComponent(slug)}`;
      watchBtn.href = watchUrl;
      watchBtn.removeAttribute("aria-disabled");
    } else {
      watchBtn.href = "#";
      watchBtn.setAttribute("aria-disabled", "true");
    }
  }
}

/**
 * Pengurutan episode numerik secara konsisten (misal: Ep 2 sebelum Ep 10)
 */
function sortEpisodes(epList) {
  if (!Array.isArray(epList)) return [];

  return [...epList].sort((a, b) => {
    const numA = parseFloat(a.episode || a.number || (a.title ? a.title.replace(/[^0-9.]/g, "") : NaN));
    const numB = parseFloat(b.episode || b.number || (b.title ? b.title.replace(/[^0-9.]/g, "") : NaN));

    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return 0;
  });
}

/**
 * Mengambil dan merender daftar episode / seri anime
 */
async function loadSeriesData(slug) {
  const episodeListEl = $("#episodeList");
  if (!episodeListEl) return;

  episodeListEl.innerHTML = "";

  try {
    const seriesResponse = await getAnimeSeries(slug);

    let epArray = [];
    if (Array.isArray(seriesResponse)) {
      epArray = seriesResponse;
    } else if (seriesResponse && typeof seriesResponse === "object") {
      epArray = seriesResponse.series || seriesResponse.episodes || seriesResponse.data || seriesResponse.results || seriesResponse.items || [];
    }

    if (!Array.isArray(epArray) || epArray.length === 0) {
      const emptyMsg = document.createElement("p");
      emptyMsg.style.color = "var(--text-gray)";
      emptyMsg.style.fontSize = "0.9rem";
      emptyMsg.style.gridColumn = "1 / -1";
      emptyMsg.textContent = "Episode belum tersedia.";
      episodeListEl.appendChild(emptyMsg);
      return;
    }

    const sortedEpisodes = sortEpisodes(epArray);

    sortedEpisodes.forEach((ep, index) => {
      const epSlug = ep.slug || ep.id || (typeof ep === "string" ? ep : null);
      const epTitle = safeText(ep.title || ep.name || (ep.episode ? `Episode ${ep.episode}` : `Episode ${index + 1}`), `Episode ${index + 1}`);

      if (epSlug && typeof epSlug === "string") {
        const watchUrl = `/watch.html?slug=${encodeURIComponent(epSlug)}`;
        const item = document.createElement("a");
        item.className = "btn btn-secondary";
        item.style.minHeight = "40px";
        item.style.padding = "8px 12px";
        item.style.fontSize = "0.85rem";
        item.style.justifyContent = "center";
        item.style.whiteSpace = "nowrap";
        item.style.overflow = "hidden";
        item.style.textOverflow = "ellipsis";
        item.href = watchUrl;
        item.textContent = epTitle;
        episodeListEl.appendChild(item);
      } else {
        const item = document.createElement("div");
        item.className = "btn btn-secondary";
        item.style.minHeight = "40px";
        item.style.padding = "8px 12px";
        item.style.fontSize = "0.85rem";
        item.style.justifyContent = "center";
        item.style.opacity = "0.5";
        item.style.cursor = "not-allowed";
        item.style.whiteSpace = "nowrap";
        item.style.overflow = "hidden";
        item.style.textOverflow = "ellipsis";
        item.textContent = `${epTitle} (Unavailable)`;
        episodeListEl.appendChild(item);
      }
    });

  } catch (err) {
    console.error("[NEXUS DETAIL] Series load error:", err);
    const errorMsg = document.createElement("p");
    errorMsg.style.color = "var(--text-gray)";
    errorMsg.style.fontSize = "0.9rem";
    errorMsg.style.gridColumn = "1 / -1";
    errorMsg.textContent = "Episode belum tersedia.";
    episodeListEl.appendChild(errorMsg);
  }
}

/**
 * Alur Utama Memuat Detail Anime
 */
async function loadAnimeDetail() {
  const slug = getSlugFromURL();

  if (!slug) {
    showError("Parameter slug tidak ditemukan.");
    return;
  }

  showLoading();

  try {
    const detailData = await getAnimeDetail(slug);

    if (!detailData) {
      showError("Gagal memuat detail anime.");
      return;
    }

    renderDetailData(detailData, slug);
    showContent();

    // Memuat episode secara terpisah agar tidak memblokir UI utama
    loadSeriesData(slug);

  } catch (err) {
    console.error("[NEXUS DETAIL]", err);
    showError("Gagal memuat detail anime. Silakan coba lagi.");
  }
}

/**
 * Inisialisasi dan Event Listeners
 */
function init() {
  const retryBtn = $("#detailRetry");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      loadAnimeDetail();
    });
  }

  loadAnimeDetail();
}

// Jalankan saat DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
