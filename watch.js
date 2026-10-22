/* ==========================================================================
   NEXUS KNIGHT ANIME - Watch Page Logic (watch.js)
   Developer: Keelz Valentine
   ========================================================================== */

import {
  getAnimeDetail,
  getAnimeSeries
} from "./anime-api.js";

// --- CONSTANTS & CONFIGURATION ---
const STORAGE_KEY_PROGRESS = "nexus_watch_progress";
const THROTTLE_SAVE_INTERVAL = 3000; // 3 Detik throttle untuk saving progress

// --- DOM HELPER ---
const $ = (selector) => document.querySelector(selector);

// --- GLOBAL STATE ---
let state = {
  slug: null,
  detail: null,
  series: [],
  currentEpisode: null,
  sources: [],
  currentSourceIndex: 0,
  lastSaveTime: 0,
  hasTriedFallbackSource: false,
  isListenersAttached: false
};

// --- UTILITY & SANITIZATION FUNCTIONS ---

/**
 * Validasi URL video agar hanya menggunakan protokol http:// atau https://
 */
function isValidVideoUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/**
 * Konversi teks agar bebas dari nilai null/undefined/[object Object]
 */
function safeText(val, fallback = "") {
  if (val === null || val === undefined || val === "" || Number.isNaN(val) || typeof val === "object") {
    return fallback;
  }
  return String(val).trim();
}

/**
 * Format string waktu atau episode
 */
function formatEpisodeTitle(ep, index) {
  const epNum = ep.episode || ep.number || (index + 1);
  const epTitle = ep.title || ep.name || ep.episodeTitle || "";
  
  if (epTitle) {
    return `Episode ${epNum} — ${safeText(epTitle)}`;
  }
  return `Episode ${epNum}`;
}

// --- UI VISIBILITY CONTROL ---

function showWatchLoading() {
  const loading = $("#watchLoading");
  const error = $("#watchError");
  const content = $("#watchContent");

  if (loading) loading.hidden = false;
  if (error) error.hidden = true;
  if (content) content.hidden = true;
}

function showWatchContent() {
  const loading = $("#watchLoading");
  const error = $("#watchError");
  const content = $("#watchContent");

  if (loading) loading.hidden = true;
  if (error) error.hidden = true;
  if (content) content.hidden = false;
}

function showWatchError(message = "Episode tidak ditemukan atau gagal dimuat.") {
  const loading = $("#watchLoading");
  const error = $("#watchError");
  const content = $("#watchContent");

  if (loading) loading.hidden = true;
  if (content) content.hidden = true;
  if (error) {
    error.hidden = false;
    const h2 = error.querySelector("h2");
    if (h2) h2.textContent = message;
  }
  document.title = "Nonton Anime — NEXUS KNIGHT ANIME";
}

function setPlaybackStatus(text) {
  const statusEl = $("#playbackStatus");
  if (statusEl) {
    statusEl.textContent = text;
  }
}

// --- LOCAL STORAGE & PROGRESS MANAGEMENT ---

function getSavedProgress(slug) {
  if (!slug) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data[slug] || null;
  } catch (e) {
    return null;
  }
}

function saveWatchProgress(slug, animeTitle, epTitle, currentTime, duration) {
  if (!slug || !currentTime || isNaN(currentTime)) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROGRESS);
    const data = raw ? JSON.parse(raw) : {};

    data[slug] = {
      slug,
      title: animeTitle || "",
      episodeTitle: epTitle || "",
      currentTime: Math.floor(currentTime),
      duration: Math.floor(duration || 0),
      updatedAt: Date.now()
    };

    localStorage.setItem(STORAGE_KEY_PROGRESS, JSON.stringify(data));
  } catch (e) {
    console.error("[NEXUS WATCH] LocalStorage save error:", e);
  }
}

// --- DATA NORMALIZATION HELPERS ---

function extractSeriesList(seriesResponse, detailResponse) {
  let list = [];

  if (Array.isArray(seriesResponse)) {
    list = seriesResponse;
  } else if (seriesResponse && typeof seriesResponse === "object") {
    list = seriesResponse.episodes || seriesResponse.series || seriesResponse.data || seriesResponse.results || seriesResponse.items || [];
  }

  if ((!list || list.length === 0) && detailResponse && typeof detailResponse === "object") {
    list = detailResponse.episodes || detailResponse.series || detailResponse.data || [];
  }

  if (!Array.isArray(list)) return [];

  return list.map((item, idx) => {
    if (typeof item === "string") {
      return { slug: item, title: `Episode ${idx + 1}`, episode: idx + 1 };
    }
    return {
      slug: item.slug || item.url || item.episodeSlug || item.id || null,
      title: item.title || item.name || item.episodeTitle || null,
      episode: item.episode || item.number || (idx + 1),
      sources: item.sources || item.source || item.streamUrl || item.videoUrl || item.playUrl || item.url || item.video || item.streaming || null,
      raw: item
    };
  });
}

function findEpisodeBySlug(seriesList, slug) {
  if (!Array.isArray(seriesList) || seriesList.length === 0) return null;

  return seriesList.find(ep => 
    ep.slug === slug ||
    ep.raw?.url === slug ||
    ep.raw?.episodeSlug === slug ||
    ep.raw?.slug === slug
  ) || null;
}

function extractSources(epData, detailData) {
  const rawSources = epData?.sources || epData?.raw?.streamUrl || epData?.raw?.videoUrl || epData?.raw?.playUrl || epData?.raw?.url || epData?.raw?.video || detailData?.streamUrl || detailData?.videoUrl || detailData?.url || null;

  let normalized = [];

  if (typeof rawSources === "string") {
    if (isValidVideoUrl(rawSources)) {
      normalized.push({ url: rawSources.trim(), quality: "Default" });
    }
  } else if (Array.isArray(rawSources)) {
    rawSources.forEach((s, idx) => {
      if (typeof s === "string" && isValidVideoUrl(s)) {
        normalized.push({ url: s.trim(), quality: `Source ${idx + 1}` });
      } else if (s && typeof s === "object") {
        const u = s.url || s.file || s.src || s.link || s.streamUrl;
        if (isValidVideoUrl(u)) {
          normalized.push({
            url: u.trim(),
            quality: s.quality || s.label || s.res || `Source ${idx + 1}`
          });
        }
      }
    });
  } else if (rawSources && typeof rawSources === "object") {
    const u = rawSources.url || rawSources.file || rawSources.src || rawSources.link || rawSources.streamUrl;
    if (isValidVideoUrl(u)) {
      normalized.push({
        url: u.trim(),
        quality: rawSources.quality || rawSources.label || "Default"
      });
    }
  }

  return normalized;
}

// --- VIDEO PLAYER SETUP & EVENT LISTENERS ---

function attachPlayerEventListeners(player) {
  if (state.isListenersAttached || !player) return;

  const playerLoading = $("#playerLoading");
  const playerError = $("#playerError");

  player.addEventListener("loadedmetadata", () => {
    // Resume playback progress jika ada
    const saved = getSavedProgress(state.slug);
    if (saved && saved.currentTime && player.duration) {
      const percentage = (saved.currentTime / player.duration) * 100;
      // Jangan auto resume jika sudah hampir selesai (> 95%)
      if (percentage < 95 && saved.currentTime < player.duration - 10) {
        player.currentTime = saved.currentTime;
      }
    }
  });

  player.addEventListener("canplay", () => {
    if (playerLoading) playerLoading.hidden = true;
    if (playerError) playerError.hidden = true;
    setPlaybackStatus("Siap diputar");
  });

  player.addEventListener("play", () => {
    setPlaybackStatus("Sedang diputar");
  });

  player.addEventListener("pause", () => {
    setPlaybackStatus("Video dijeda");
  });

  player.addEventListener("waiting", () => {
    if (playerLoading) playerLoading.hidden = false;
    setPlaybackStatus("Sedang buffering...");
  });

  player.addEventListener("playing", () => {
    if (playerLoading) playerLoading.hidden = true;
    setPlaybackStatus("Sedang diputar");
  });

  player.addEventListener("timeupdate", () => {
    const now = Date.now();
    if (now - state.lastSaveTime > THROTTLE_SAVE_INTERVAL) {
      state.lastSaveTime = now;
      const animeTitleStr = safeText(state.detail?.title);
      const epTitleStr = state.currentEpisode ? formatEpisodeTitle(state.currentEpisode, 0) : "";
      saveWatchProgress(state.slug, animeTitleStr, epTitleStr, player.currentTime, player.duration);
    }
  });

  player.addEventListener("ended", () => {
    setPlaybackStatus("Video selesai");
    const animeTitleStr = safeText(state.detail?.title);
    const epTitleStr = state.currentEpisode ? formatEpisodeTitle(state.currentEpisode, 0) : "";
    saveWatchProgress(state.slug, animeTitleStr, epTitleStr, player.duration, player.duration);
  });

  player.addEventListener("error", () => {
    if (playerLoading) playerLoading.hidden = true;
    if (playerError) playerError.hidden = false;
    setPlaybackStatus("Gagal memutar video");

    // Cobalah fallback ke source alternatif satu kali
    if (!state.hasTriedFallbackSource && state.sources.length > state.currentSourceIndex + 1) {
      state.hasTriedFallbackSource = true;
      state.currentSourceIndex++;
      switchVideoSource(state.currentSourceIndex);
    }
  });

  state.isListenersAttached = true;
}

function loadVideoSource(sourceUrl) {
  const player = $("#animePlayer");
  const playerLoading = $("#playerLoading");
  const playerError = $("#playerError");

  if (!player) return;

  if (playerLoading) playerLoading.hidden = false;
  if (playerError) playerError.hidden = true;

  attachPlayerEventListeners(player);

  // Pengecekan Native HLS
  if (sourceUrl.includes(".m3u8")) {
    const canPlayHLS = player.canPlayType("application/x-mpegURL") || player.canPlayType("application/vnd.apple.mpegurl");
    if (!canPlayHLS) {
      if (playerLoading) playerLoading.hidden = true;
      if (playerError) playerError.hidden = false;
      setPlaybackStatus("Browser tidak mendukung format HLS (.m3u8).");
      return;
    }
  }

  player.src = sourceUrl;
  player.load();
}

function switchVideoSource(index) {
  const player = $("#animePlayer");
  if (!player || !state.sources[index]) return;

  const currentPos = player.currentTime || 0;
  const isPaused = player.paused;

  state.currentSourceIndex = index;
  loadVideoSource(state.sources[index].url);

  const restorePosHandler = () => {
    if (currentPos > 0) {
      player.currentTime = currentPos;
    }
    if (!isPaused) {
      player.play().catch(() => {});
    }
    player.removeEventListener("loadedmetadata", restorePosHandler);
  };

  player.addEventListener("loadedmetadata", restorePosHandler);
}

// --- UI RENDER FUNCTIONS ---

function renderQualitySelector() {
  const container = $("#qualitySelector");
  const optionsBox = $("#qualityOptions");

  if (!container) return;

  if (state.sources.length <= 1) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";

  if (optionsBox) {
    optionsBox.innerHTML = "";

    const select = document.createElement("select");
    select.className = "quality-select";
    select.style.backgroundColor = "var(--bg-black, #050505)";
    select.style.color = "var(--text-white, #ffffff)";
    select.style.border = "1px solid var(--border-color, #222222)";
    select.style.padding = "4px 8px";
    select.style.borderRadius = "4px";

    state.sources.forEach((src, idx) => {
      const opt = document.createElement("option");
      opt.value = idx.toString();
      opt.textContent = src.quality || `Source ${idx + 1}`;
      if (idx === state.currentSourceIndex) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      const selectedIndex = parseInt(e.target.value, 10);
      if (!isNaN(selectedIndex)) {
        switchVideoSource(selectedIndex);
      }
    });

    optionsBox.appendChild(select);
  }
}

function renderEpisodeNavigation() {
  const prevBtn = $("#prevEpisode");
  const nextBtn = $("#nextEpisode");

  if (!Array.isArray(state.series) || state.series.length === 0) {
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }

  const currentIndex = state.series.findIndex(ep => 
    ep.slug === state.slug || 
    ep.raw?.url === state.slug || 
    ep.raw?.episodeSlug === state.slug
  );

  // Control Prev Button
  if (prevBtn) {
    if (currentIndex > 0) {
      const prevEp = state.series[currentIndex - 1];
      const prevSlug = prevEp.slug;
      if (prevSlug) {
        prevBtn.disabled = false;
        prevBtn.onclick = () => {
          window.location.href = `/watch.html?slug=${encodeURIComponent(prevSlug)}`;
        };
      } else {
        prevBtn.disabled = true;
      }
    } else {
      prevBtn.disabled = true;
    }
  }

  // Control Next Button
  if (nextBtn) {
    if (currentIndex >= 0 && currentIndex < state.series.length - 1) {
      const nextEp = state.series[currentIndex + 1];
      const nextSlug = nextEp.slug;
      if (nextSlug) {
        nextBtn.disabled = false;
        nextBtn.onclick = () => {
          window.location.href = `/watch.html?slug=${encodeURIComponent(nextSlug)}`;
        };
      } else {
        nextBtn.disabled = true;
      }
    } else {
      nextBtn.disabled = true;
    }
  }
}

function renderEpisodeList() {
  const container = $("#episodeList");
  if (!container) return;

  container.innerHTML = "";

  if (!Array.isArray(state.series) || state.series.length === 0) {
    const p = document.createElement("p");
    p.style.color = "var(--text-gray, #a0a0a0)";
    p.style.fontSize = "0.9rem";
    p.textContent = "Daftar episode belum tersedia.";
    container.appendChild(p);
    return;
  }

  state.series.forEach((ep, idx) => {
    const epSlug = ep.slug;
    const epTitleText = formatEpisodeTitle(ep, idx);

    if (epSlug) {
      const link = document.createElement("a");
      link.className = "btn btn-secondary";
      link.style.minHeight = "40px";
      link.style.padding = "8px 12px";
      link.style.fontSize = "0.85rem";
      link.style.justifyContent = "center";
      link.style.whiteSpace = "nowrap";
      link.style.overflow = "hidden";
      link.style.textOverflow = "ellipsis";
      link.href = `/watch.html?slug=${encodeURIComponent(epSlug)}`;
      link.textContent = epTitleText;

      if (epSlug === state.slug) {
        link.style.borderColor = "var(--neon-green, #00ff66)";
        link.style.color = "var(--neon-green, #00ff66)";
      }

      container.appendChild(link);
    } else {
      const btn = document.createElement("div");
      btn.className = "btn btn-secondary";
      btn.style.minHeight = "40px";
      btn.style.padding = "8px 12px";
      btn.style.fontSize = "0.85rem";
      btn.style.justifyContent = "center";
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      btn.textContent = `${epTitleText} (Unavailable)`;
      container.appendChild(btn);
    }
  });
}

function renderWatchDetails() {
  const animeTitleEl = $("#animeTitle");
  const epTitleEl = $("#episodeTitle");
  const descEl = $("#animeDescription");
  const breadcrumbEl = $("#breadcrumbTitle");

  const animeTitleStr = safeText(state.detail?.title || state.detail?.name || state.detail?.judul, "NEXUS KNIGHT ANIME");
  
  let epTitleStr = "Watch";
  if (state.currentEpisode) {
    const idx = state.series.findIndex(e => e.slug === state.slug);
    epTitleStr = formatEpisodeTitle(state.currentEpisode, idx >= 0 ? idx : 0);
  }

  // Update Page Title & Breadcrumb
  document.title = `${animeTitleStr} ${epTitleStr ? `- ${epTitleStr}` : ""} — NEXUS KNIGHT ANIME`;

  if (breadcrumbEl) {
    breadcrumbEl.textContent = `${animeTitleStr} (${epTitleStr})`;
  }

  if (animeTitleEl) {
    animeTitleEl.textContent = animeTitleStr;
  }

  if (epTitleEl) {
    epTitleEl.textContent = epTitleStr;
  }

  if (descEl) {
    const synopsis = safeText(state.detail?.description || state.detail?.synopsis || state.detail?.summary, "Sinopsis belum tersedia.");
    descEl.textContent = synopsis;
  }
}

// --- MAIN CONTROLLER / PAGE LOADER ---

async function loadWatchPage() {
  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get("slug");

  if (!slugParam || !slugParam.trim()) {
    showWatchError("Parameter slug tidak ditemukan.");
    return;
  }

  state.slug = slugParam.trim();
  state.hasTriedFallbackSource = false;
  state.currentSourceIndex = 0;

  showWatchLoading();

  try {
    // 1. Ambil detail anime
    let detailRes = null;
    try {
      detailRes = await getAnimeDetail(state.slug);
    } catch (e) {
      console.warn("[NEXUS WATCH] Detail fetch warning:", e);
    }

    state.detail = detailRes;

    // 2. Ambil series/episodes
    let seriesRes = null;
    try {
      seriesRes = await getAnimeSeries(state.slug);
    } catch (e) {
      console.warn("[NEXUS WATCH] Series fetch warning:", e);
    }

    state.series = extractSeriesList(seriesRes, detailRes);
    state.currentEpisode = findEpisodeBySlug(state.series, state.slug);

    // 3. Ekstrak Video Source
    state.sources = extractSources(state.currentEpisode, state.detail);

    // Jika tidak ditemukan sumber video
    if (state.sources.length === 0) {
      showWatchContent();
      renderWatchDetails();
      renderEpisodeNavigation();
      renderEpisodeList();

      const playerError = $("#playerError");
      const playerLoading = $("#playerLoading");
      if (playerLoading) playerLoading.hidden = true;
      if (playerError) playerError.hidden = false;
      setPlaybackStatus("Sumber video tidak tersedia.");
      return;
    }

    // 4. Tampilkan halaman & render komponen
    showWatchContent();
    renderWatchDetails();
    renderQualitySelector();
    renderEpisodeNavigation();
    renderEpisodeList();

    // 5. Muat sumber video pertama
    loadVideoSource(state.sources[0].url);

  } catch (err) {
    console.error("[NEXUS WATCH] Global error:", err);
    showWatchError("Gagal memuat anime. Silakan coba lagi.");
  }
}

// --- SETUP EVENT LISTENERS ---

function setupWatchEventListeners() {
  const retryBtn = $("#watchRetry");
  if (retryBtn) {
    retryBtn.addEventListener("click", () => {
      loadWatchPage();
    });
  }

  const saveBtn = $("#saveProgress");
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      const player = $("#animePlayer");
      if (player && state.slug && player.currentTime) {
        const animeTitleStr = safeText(state.detail?.title);
        const epTitleStr = state.currentEpisode ? formatEpisodeTitle(state.currentEpisode, 0) : "";
        saveWatchProgress(state.slug, animeTitleStr, epTitleStr, player.currentTime, player.duration);

        const originalText = saveBtn.textContent;
        saveBtn.textContent = "Progress Tersimpan ✓";
        saveBtn.disabled = true;

        setTimeout(() => {
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }, 2000);
      }
    });
  }
}

// --- INITIALIZATION ---

function init() {
  setupWatchEventListeners();
  loadWatchPage();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
