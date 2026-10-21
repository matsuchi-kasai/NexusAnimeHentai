/* ==========================================================================
   NEXUS KNIGHT ANIME - API Connector Module (anime-api.js)
   Developer: Keelz Valentine
   ========================================================================== */

// --- CONFIGURATION & CONSTANTS ---
const BASE_URL = "https://api.kyzzz.xyz/api/anime-hen/hentaitv";
const VERCEL_PROXY_URL = "/api/anime"; // Serverless proxy path jika disetup di Vercel
const REQUEST_TIMEOUT_MS = 12000; // 12 Detik Timeout
const MAX_RETRIES = 2; // Maksimal 2x retry jika terjadi network error/timeout
const CACHE_TTL_MS = 5 * 60 * 1000; // Cache 5 Menit

// --- IN-MEMORY CACHE ---
const cache = new Map();

/**
 * Mengambil data dari cache jika belum kadaluarsa
 */
function getFromCache(key) {
  if (!cache.has(key)) return null;
  const { timestamp, data } = cache.get(key);
  if (Date.now() - timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return data;
}

/**
 * Menyimpan data ke dalam cache
 */
function setToCache(key, data) {
  cache.set(key, { timestamp: Date.now(), data });
}

// --- NORMALIZER HELPER ---

/**
 * Menyeragamkan format objek anime agar UI selalu mendapatkan data yang valid
 */
function normalizeAnime(item) {
  if (!item || typeof item !== "object") return null;

  return {
    slug: item.slug || item.id || item.link || null,
    title: item.title || item.name || "Untitled Anime",
    poster: item.poster || item.image || item.thumb || item.thumbnail || null,
    thumbnail: item.thumbnail || item.thumb || item.poster || null,
    episode: item.episode || item.ep || item.latest_episode || null,
    description: item.description || item.synopsis || null,
    genres: Array.isArray(item.genres) ? item.genres : (Array.isArray(item.tags) ? item.tags : []),
    tags: Array.isArray(item.tags) ? item.tags : []
  };
}

/**
 * Menyeragamkan response daftar anime
 */
function normalizeAnimeList(data) {
  let list = [];
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === "object") {
    list = data.data || data.results || data.list || data.anime || [];
  }

  if (!Array.isArray(list)) return [];
  return list.map(normalizeAnime).filter(Boolean);
}

// --- REQUEST HELPER WITH RETRY & TIMEOUT ---

/**
 * Helper internal untuk melakukan fetch dengan Timeout, Retry, dan Handling Error
 */
async function fetchWithTimeoutAndRetry(url, options = {}, retries = MAX_RETRIES, backoff = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const json = await response.json();
      return json;
    } catch (error) {
      clearTimeout(timeoutId);

      const isAbort = error.name === "AbortError";
      const isNetworkError = !error.message.startsWith("HTTP_");

      // Retry jika timeout atau network error sementara
      if (attempt < retries && (isAbort || isNetworkError)) {
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, attempt)));
        continue;
      }

      if (isAbort) {
        throw new Error("API request timeout");
      }
      throw new Error("API request failed");
    }
  }
}

/**
 * Helper umum untuk memanggil endpoint API
 */
async function requestApi(endpoint, params = {}, useCache = true) {
  const searchParams = new URLSearchParams();

  // Membaca API Key dari environment jika ada (Client/Server Proxy injection)
  const apiKey = (typeof process !== "undefined" && process.env && process.env.ANIME_API_KEY)
    ? process.env.ANIME_API_KEY
    : (typeof window !== "undefined" && window.ANIME_API_KEY ? window.ANIME_API_KEY : "");

  if (apiKey) {
    searchParams.append("apikey", apiKey);
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });

  const queryString = searchParams.toString();
  const url = `${BASE_URL}${endpoint}${queryString ? `?${queryString}` : ""}`;

  // Cek cache sebelum request
  if (useCache) {
    const cachedData = getFromCache(url);
    if (cachedData) return cachedData;
  }

  const data = await fetchWithTimeoutAndRetry(url);

  if (useCache && data) {
    setToCache(url, data);
  }

  return data;
}

// --- API SERVICES ---

/**
 * Endpoint 1: Fetch daftar genre anime
 */
async function getGenres() {
  try {
    const response = await requestApi("/genres", {}, true);
    if (Array.isArray(response)) return response;
    if (response && Array.isArray(response.data)) return response.data;
    if (response && Array.isArray(response.genres)) return response.genres;
    return [];
  } catch (error) {
    throw new Error("Gagal memuat data genre.");
  }
}

/**
 * Endpoint 2: Browse & pencarian anime
 */
async function browseAnime({
  query = "",
  tag = "",
  page = 1,
  sort = "latest"
} = {}) {
  try {
    const params = {
      ...(query && { query }),
      ...(tag && { tag }),
      page,
      sort
    };

    const response = await requestApi("/browse", params, true);
    return normalizeAnimeList(response);
  } catch (error) {
    throw new Error("Gagal memuat daftar anime.");
  }
}

/**
 * Endpoint 3: Detail spesifik anime berdasarkan slug
 */
async function getAnimeDetail(slug) {
  if (!slug) throw new Error("Slug anime tidak boleh kosong.");
  
  try {
    const encodedSlug = encodeURIComponent(slug);
    const response = await requestApi("/detail", { slug: encodedSlug }, true);
    
    if (!response) return null;

    const detailData = response.data || response.detail || response;
    const normalized = normalizeAnime(detailData);

    return {
      ...normalized,
      episodes: detailData.episodes || detailData.episode_list || [],
      streamUrl: detailData.streamUrl || detailData.stream_url || null,
      raw: detailData
    };
  } catch (error) {
    throw new Error("Gagal memuat detail anime.");
  }
}

/**
 * Endpoint 4: Seri episoded/related dari anime berdasarkan slug
 */
async function getAnimeSeries(slug) {
  if (!slug) throw new Error("Slug anime tidak boleh kosong.");

  try {
    const encodedSlug = encodeURIComponent(slug);
    const response = await requestApi("/series", { slug: encodedSlug }, true);
    return response?.data || response?.series || response || null;
  } catch (error) {
    throw new Error("Gagal memuat seri anime.");
  }
}

/**
 * Endpoint 5: Fetch anime yang sedang trending
 */
async function getTrending() {
  try {
    const response = await requestApi("/trending", {}, true);
    return normalizeAnimeList(response);
  } catch (error) {
    throw new Error("Gagal memuat anime trending.");
  }
}

// --- EXPORT ES MODULES ---
export {
  getGenres,
  browseAnime,
  getAnimeDetail,
  getAnimeSeries,
  getTrending
};
