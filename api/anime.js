/* ==========================================================================
   NEXUS KNIGHT ANIME - Secure API Proxy (api/anime.js)
   Developer: Keelz Valentine
   ========================================================================== */

const BASE_URL = "https://api.kyzzz.xyz/api/anime-hen/hentaitv";
const TIMEOUT_MS = 10000;

// Whitelist action yang diizinkan
const ALLOWED_ACTIONS = new Set([
  "genres",
  "browse",
  "detail",
  "series",
  "trending"
]);

export default async function handler(req, res) {
  // Set response headers dasar
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(200).end();
  }

  // Hanya izinkan HTTP GET Method
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET, OPTIONS");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Validasi keberadaan Environment Variable API Key
  const apiKey = process.env.ANIME_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Anime API is not configured" });
  }

  const { action, query, tag, page, sort, slug } = req.query || {};

  // Validasi action terhadap whitelist
  if (!action || !ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ error: "Invalid API action" });
  }

  // Konstruksi URL Upstream
  const upstreamUrl = new URL(`${BASE_URL}/${action}`);
  upstreamUrl.searchParams.set("apikey", apiKey);

  // Validasi dan sanitasi parameter sesuai action
  if (action === "browse") {
    if (query && typeof query === "string") {
      upstreamUrl.searchParams.set("query", query.substring(0, 100));
    }
    if (tag && typeof tag === "string") {
      upstreamUrl.searchParams.set("tag", tag.substring(0, 100));
    }

    let parsedPage = parseInt(page, 10);
    if (isNaN(parsedPage) || parsedPage < 1) {
      parsedPage = 1;
    }
    upstreamUrl.searchParams.set("page", parsedPage.toString());

    const validSort = (sort && typeof sort === "string") ? sort.substring(0, 30) : "latest";
    upstreamUrl.searchParams.set("sort", validSort);

  } else if (action === "detail" || action === "series") {
    if (!slug || typeof slug !== "string" || !slug.trim()) {
      return res.status(400).json({ error: "Missing slug" });
    }
    upstreamUrl.searchParams.set("slug", slug.trim());
  }

  // Timeout control dengan AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(upstreamUrl.toString(), {
      method: "GET",
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(response.status >= 500 ? 502 : response.status).json({
        error: "Anime API request failed"
      });
    }

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      return res.status(502).json({ error: "Invalid response from Anime API" });
    }

    // Set header cache Vercel CDN ringan untuk response sukses
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json(data);

  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === "AbortError") {
      return res.status(504).json({ error: "Anime API timeout" });
    }

    console.error("[NEXUS API]", error);
    return res.status(502).json({ error: "Anime API request failed" });
  }
}
