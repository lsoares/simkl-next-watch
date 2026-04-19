// ── Pure domain functions (no DOM, no storage, no fetch) ──

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function simklId(item) {
  const ids = item?.ids || {};
  return String(ids.simkl || ids.simkl_id || "");
}

function parseNextEpisode(value) {
  if (!value) return null;
  if (typeof value === "object") {
    const s = Number(value.season ?? value.season_number);
    const e = Number(value.episode ?? value.episode_number ?? value.number);
    return Number.isFinite(s) && Number.isFinite(e) ? { season: s, episode: e } : null;
  }
  const m = String(value).match(/S(\d+)E(\d+)/i);
  return m ? { season: Number(m[1]), episode: Number(m[2]) } : null;
}

function formatEpisode({ season, episode }) {
  return `${season}x${episode}`;
}

function availableEpisodesLeft(show) {
  const total = show.total_episodes_count || 0;
  const notAired = show.not_aired_episodes_count || 0;
  const watched = show.watched_episodes_count || 0;
  return total > 0 ? Math.max(0, total - notAired - watched) : Infinity;
}

function hasAiredEpisodes(show) {
  return show.total_episodes_count === 0 || show.total_episodes_count > show.not_aired_episodes_count;
}

function isReleased(item) {
  return item.release_status !== "unreleased";
}

function sortWatching(a, b) {
  const aLeft = availableEpisodesLeft(a);
  const bLeft = availableEpisodesLeft(b);
  if ((aLeft === 1) !== (bLeft === 1)) return aLeft === 1 ? -1 : 1;
  if (aLeft === 1) return (a.runtime || Infinity) - (b.runtime || Infinity);
  return new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0);
}

function sortByAddedDate(a, b) {
  return new Date(a.added_at || 0) - new Date(b.added_at || 0);
}

function buildTvSuggestions(shows) {
  const released = shows.filter(isReleased);
  const watching = released
    .filter((s) => s.status === "watching" && parseNextEpisode(s.next_to_watch) && hasAiredEpisodes(s))
    .sort(sortWatching);
  const planToWatch = released
    .filter((s) => s.status === "plantowatch" && hasAiredEpisodes(s))
    .sort(sortByAddedDate);
  return [...watching, ...planToWatch];
}

function buildMovieSuggestions(movies) {
  return movies
    .filter((m) => (m.status === "plantowatch" || m.status === "watching") && isReleased(m))
    .sort(sortByAddedDate);
}

function posterUrl(code) {
  if (!code) return "";
  if (code.startsWith("http")) return code;
  return `https://wsrv.nl/?url=https://simkl.in/posters/${code}_c.webp`;
}

function trendingPosterUrl(code) {
  if (!code) return "";
  return `https://wsrv.nl/?url=https://simkl.in/posters/${code}_m.webp`;
}

function buildSimklUrl(item) {
  const id = simklId(item);
  if (!id) return "";
  const slug = String(item.title || "").toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `https://simkl.com/${item.type === "movie" ? "movies" : "tv"}/${id}/${slug}`;
}

function buildEpisodeUrl(item, ep) {
  const base = buildSimklUrl(item);
  return base && ep ? `${base}/season-${ep.season}/episode-${ep.episode}/` : "";
}

function isUnstarted(item, type) {
  if (type === "tv") {
    const ep = parseNextEpisode(item.next_to_watch);
    return item.status === "plantowatch" || (item.watched_episodes_count === 0 && ep?.episode === 1);
  }
  return item.status === "plantowatch";
}

function buildTrendingUrl(item, urlBase) {
  const fixedPath = item.url ? item.url.replace(/^\/movie\//, "/movies/") : null;
  const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
  return fixedPath ? `https://simkl.com${fixedPath}` : id ? `https://simkl.com/${urlBase}/${id}` : "#";
}

function collectLibraryIndex(data) {
  return new Map(
    [...(data.shows || []), ...(data.anime || []), ...(data.movies || [])]
      .map((item) => [simklId(item), {
        watched: item.status === "completed",
        watchedAt: item.status === "completed" ? (item.last_watched_at || null) : null,
        watching: item.status === "watching",
        userRating: item.user_rating ?? null,
      }])
      .filter(([id]) => id)
  );
}

function findEpisodeTitle(episodes, season, episode) {
  if (!Array.isArray(episodes)) return null;
  const match = episodes.find((e) => Number(e.season) === season && Number(e.episode) === episode && e.type === "episode");
  return match?.title || null;
}

function trendingBadgeInfo(period) {
  if (period === "today") return { label: "Today", tooltip: "Trending today" };
  if (period === "week") return { label: "Week", tooltip: "Trending this week" };
  if (period === "month") return { label: "Month", tooltip: "Trending this month" };
  return null;
}

function buildImdbUrl(item) {
  const id = item?.ids?.imdb;
  return id ? `https://www.imdb.com/title/${encodeURIComponent(id)}/` : "https://www.imdb.com/";
}

function trendingPeriodFor(simklId, sets) {
  if (!simklId || !sets) return null;
  if (sets.today.has(simklId)) return "today";
  if (sets.week.has(simklId)) return "week";
  if (sets.month.has(simklId)) return "month";
  return null;
}

const relativeTimeUnits = [["year", 31536e6], ["month", 2592e6], ["week", 6048e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4], ["second", 1e3]];
function formatWatchedAgo(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (!iso || Number.isNaN(diff)) return "";
  const [unit, ms] = relativeTimeUnits.find(([, ms]) => Math.abs(diff) >= ms) || relativeTimeUnits.at(-1);
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(diff / ms), unit);
}

// ── HTML templates ──

const ICON_CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
const ICON_EYE = `<svg class="poster-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_BOOKMARK = `<svg class="poster-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`;

class PosterCard extends HTMLElement {
  variant = "next";
  type = "tv";
  item = null;
  watched = false;
  watchedAt = null;
  userRating = null;
  inWatchlist = false;
  watching = false;
  loggedIn = false;

  connectedCallback() {
    if (this._rendered) return;
    this._render();
    this._rendered = true;
  }

  get cardEl() { return this.querySelector(".item-card"); }

  _emit(name) {
    this.dispatchEvent(new CustomEvent(`poster:${name}`, { bubbles: true, detail: { item: this.item, type: this.type } }));
  }

  _render() {
    const { item, variant, type, watched, watchedAt, userRating, inWatchlist, watching, loggedIn } = this;
    if (!item) return;

    const isNext = variant === "next";
    const id = simklId(item) || String(item.ids?.simkl_id || item.ids?.simkl || "");
    const title = item.title || "";
    const year = item.year || "";
    const rating = item.ratings?.imdb?.rating;
    const urlBase = type === "movie" ? "movies" : "tv";
    const posterCode = item.poster || item.img || "";
    const img = isNext ? posterUrl(posterCode) : trendingPosterUrl(posterCode);
    const itemWithType = { ...item, type };
    const url = isNext ? buildSimklUrl(itemWithType) : buildTrendingUrl(item, urlBase);

    const ep = isNext && type === "tv" ? parseNextEpisode(item.next_to_watch) : null;
    const unstarted = isNext ? isUnstarted(item, type) : false;
    const epUrl = !unstarted && ep ? buildEpisodeUrl(itemWithType, ep) : "";
    const epCode = !unstarted && ep ? formatEpisode(ep) : "";
    const showEpCount = type === "tv" && !epCode && !watching && (isNext || !watched);
    const unstartedEpCount = showEpCount ? availableEpisodesLeft(item) : null;
    const unstartedEpLabel = Number.isFinite(unstartedEpCount) && unstartedEpCount > 0 ? `${unstartedEpCount} episode${unstartedEpCount === 1 ? "" : "s"}` : "";

    const showYear = isNext ? unstarted && year : !watched && year;
    const showMarkWatched = isNext;
    const showAddWatchlist = !isNext && loggedIn && id && !watched && !inWatchlist;
    const showImdb = !watched && rating && (!isNext || unstarted);
    const showWatchedBadge = !isNext && watched;
    const watchedAgo = showWatchedBadge && watchedAt ? formatWatchedAgo(watchedAt) : "";
    const watchedRating = showWatchedBadge && userRating != null ? userRating : null;
    const watchedBadgeLabel = `Watched${watchedAgo ? ` ${watchedAgo}` : ""}${watchedRating != null ? ` · rated ${watchedRating}/10` : ""}`;
    const showWatchlistBadge = !isNext && inWatchlist && !watched;

    const dataAttrs = isNext
      ? `data-simkl-id="${id}" data-type="${type}"`
      : `data-simkl-id="${id}" data-url-base="${urlBase}" data-title="${escapeHtml(title)}"`;
    const imgLazy = isNext ? "" : ` loading="lazy"`;
    const posterHref = isNext ? (epUrl || url) : url;
    const posterTooltip = isNext && !unstarted && item.episodeTitle ? (epCode ? `${epCode} — ${item.episodeTitle}` : item.episodeTitle) : "";

    this.innerHTML = `
      <article class="item-card${watched ? " trending-watched" : ""}${!watched && inWatchlist && !isNext ? " trending-watchlisted" : ""}" ${dataAttrs} aria-label="${escapeHtml(title)}">
        ${img ? `<a class="poster-anchor" href="${escapeHtml(posterHref)}" target="_blank" rel="noreferrer"${posterTooltip ? ` title="${escapeHtml(posterTooltip)}"` : ""}><img class="poster" src="${escapeHtml(img)}" alt=""${imgLazy} draggable="false" /></a>` : ""}
        <div class="poster-top">
          <div class="poster-top-text">
            <div class="poster-title">
              ${url ? `<a class="poster-title-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>` : `<span class="poster-title-link">${escapeHtml(title)}</span>`}
            </div>
            ${showYear ? `<span class="poster-title-meta">${escapeHtml(String(year))}</span>` : ""}
            ${unstartedEpLabel ? `<span class="poster-episode-count">${escapeHtml(unstartedEpLabel)}</span>` : ""}
            ${showImdb ? `<a class="imdb-badge" href="${escapeHtml(buildImdbUrl(item))}" target="_blank" rel="noreferrer">IMDb ${rating}</a>` : ""}
          </div>
        </div>
        <div class="poster-bottom">
          ${epCode ? `<a class="poster-episode" href="${escapeHtml(epUrl)}" target="_blank" rel="noreferrer">${escapeHtml(epCode)}${item.episodeTitle ? `: ${escapeHtml(item.episodeTitle)}` : ""}</a>` : ""}
          ${showWatchedBadge ? `<span class="poster-status poster-status--watched" title="${escapeHtml(watchedBadgeLabel)}" aria-label="${escapeHtml(watchedBadgeLabel)}">${ICON_EYE}${watchedAgo ? `<span>${escapeHtml(watchedAgo)}</span>` : ""}${watchedRating != null ? `<span class="poster-status-rating">${watchedRating}☆</span>` : ""}</span>` : ""}
          ${showWatchlistBadge ? `<span class="poster-status poster-status--watchlist" title="On watchlist" aria-label="On watchlist">${ICON_BOOKMARK}<span>Watchlist</span></span>` : ""}
        </div>
        ${showMarkWatched ? `<button class="mark-watched-btn" title="I've watched this" aria-label="Mark as watched">${ICON_CHECK}</button>` : ""}
        ${showAddWatchlist ? `<button class="add-watchlist-btn" title="Add to watchlist" aria-label="Add to watchlist" data-title="${escapeHtml(title)}">+</button>` : ""}
      </article>
    `;

    this.querySelector(".mark-watched-btn")?.addEventListener("click", () => this._emit("mark-watched"));
    this.querySelector(".add-watchlist-btn")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._emit("add-watchlist"); });
  }
}
customElements.define("poster-card", PosterCard);

class PostersRow extends HTMLElement {}
customElements.define("posters-row", PostersRow);

function shuffle(arr) {
  return arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
}

function formatBand(items, cap) {
  return shuffle(items).slice(0, cap).map((item) => `${item.title}${item.year ? ` (${item.year})` : ""}:${item.user_rating}`).join(", ");
}

function buildRatingsInput(mediaType, shows, movies, anime) {
  const includeTv = mediaType !== "movie";
  const includeFilm = mediaType !== "tv";
  const pool = [
    ...(includeTv ? [...(shows || []), ...(anime || [])] : []),
    ...(includeFilm ? (movies || []) : []),
  ].filter((item) => item.user_rating != null);
  const liked = pool.filter((i) => i.user_rating >= 8);
  const mixed = pool.filter((i) => i.user_rating >= 6 && i.user_rating < 8);
  const disliked = pool.filter((i) => i.user_rating < 6);
  const parts = [];
  const likedStr = formatBand(liked, 120);
  const mixedStr = formatBand(mixed, 30);
  const dislikedStr = formatBand(disliked, 20);
  if (likedStr) parts.push(`Liked (8-10): ${likedStr}`);
  if (mixedStr) parts.push(`Mixed (6-7): ${mixedStr}`);
  if (dislikedStr) parts.push(`Disliked (1-5): ${dislikedStr}`);
  return parts.join("\n");
}

// ── Storage ──

const STORAGE = {
  accessToken: "next-watch-access-token",
  syncCache: "simkl-cache-v3",
  ratingsCache: "next-watch-ratings-cache",
  trendingPeriod: "next-watch-trending-period",
  hideWatched: "next-watch-hide-watched",
  episodeCache: "next-watch-episode-cache",
  aiProvider: "next-watch-ai-provider",
  aiKeyGemini: "next-watch-ai-key-gemini",
  aiKeyOpenai: "next-watch-ai-key-openai",
  aiKeyClaude: "next-watch-ai-key-claude",
  aiKeyGrok: "next-watch-ai-key-grok",
  aiKeyGroq: "next-watch-ai-key-groq",
  aiKeyDeepseek: "next-watch-ai-key-deepseek",
  aiKeyOpenrouter: "next-watch-ai-key-openrouter",
  aiMediaType: "next-watch-ai-media-type",
};

function readStorage(key) { return localStorage.getItem(key) || ""; }
function readJsonStorage(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function writeStorage(key, value) { try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch {} }
function clearAllStorage() { for (const key of Object.values(STORAGE)) localStorage.removeItem(key); }

function getAccessToken() { return readStorage(STORAGE.accessToken); }
function isLoggedIn() { return !!getAccessToken(); }

const ApiError = simkl.ApiError;

// ── Dock effect (visual, self-contained) ──

function initDockEffect(row) {
  const MAX_EXTRA = 0.5, RADIUS = 2.5;
  let baseW = 0;

  function computeBase() {
    if (window.matchMedia("(max-width: 680px)").matches) {
      baseW = row.clientHeight * 2 / 3;
      row.style.setProperty("--dock-h", row.clientHeight + "px");
    } else {
      baseW = (Math.min(window.innerWidth, 680) - 64) / 3;
    }
  }

  function apply(cx) {
    if (!baseW) return;
    const cards = [...row.querySelectorAll(".item-card")];
    const rects = cards.map((c) => c.getBoundingClientRect());
    cards.forEach((card, i) => {
      const dist = Math.abs(cx - (rects[i].left + rects[i].width / 2));
      const t = Math.max(0, 1 - dist / (baseW * RADIUS));
      card.style.setProperty("--dock-scale", (1 + MAX_EXTRA * t * t).toFixed(3));
    });
  }

  function reset() {
    for (const c of row.querySelectorAll(".item-card")) c.style.removeProperty("--dock-scale");
  }

  requestAnimationFrame(() => {
    computeBase();
    if (window.matchMedia("(max-width: 680px)").matches) {
      row.addEventListener("scroll", () => { const r = row.getBoundingClientRect(); apply(r.left + r.width / 2); }, { passive: true });
    } else {
      row.addEventListener("mousemove", (e) => apply(e.clientX));
      row.addEventListener("mouseleave", reset);
    }
    window.addEventListener("resize", () => { computeBase(); reset(); }, { passive: true });
  });
}

// ── App (DOM + state + wiring) ──

(function app() {
  const $ = (id) => document.getElementById(id);
  const tpl = (id) => $(id).content.cloneNode(true);
  const setEmpty = (container, msg, isError = false) => {
    const p = tpl("tpl-empty").firstElementChild;
    p.textContent = msg;
    if (isError) p.style.color = "#fca5a5";
    container.replaceChildren(p);
  };
  const makeRowItem = () => {
    const frag = tpl("tpl-row-item");
    const card = document.createElement("poster-card");
    frag.firstElementChild.appendChild(card);
    return { frag, card };
  };
  const el = {
    topBar: $("topBar"), navNext: $("navNext"), navTrending: $("navTrending"), navAi: $("navAi"),
    nextSetup: $("nextSetup"), nextContent: $("nextContent"),
    logoutBtn: $("logoutBtn"), getStartedBtn: $("getStartedBtn"), aiSaveBtn: $("aiSaveBtn"),
    nextView: $("nextView"), tvRow: $("tvRow"), movieRow: $("movieRow"),
    trendingView: $("trendingView"), trendingPeriodTabs: $("trendingPeriodTabs"),
    hideTrendingWatched: $("hideTrendingWatched"),
    trendingTvContent: $("trendingTvContent"), trendingMoviesContent: $("trendingMoviesContent"),
    aiView: $("aiView"), aiSettings: $("aiSettings"), aiSettingsClose: $("aiSettingsClose"),
    aiKeyBtn: $("aiKeyBtn"), aiToggleTv: $("aiToggleTv"), aiToggleMovie: $("aiToggleMovie"),
    aiProviderSelect: $("aiProviderSelect"), aiKeyInput: $("aiKeyInput"), aiKeyLink: $("aiKeyLink"),
    aiPrompts: $("aiPrompts"), aiResults: $("aiResults"),
    spinner: $("loadingSpinner"), toast: $("toast"), installBtn: $("installButton"),
  };

  let currentView = null;
  let toastTimer = null;
  let libraryIndex = new Map();
  let resolveLibraryReady;
  let libraryReady = new Promise((r) => { resolveLibraryReady = r; });
  let tvItems = [];
  let movieItems = [];

  // ── Toast ──

  function showToast(msg, isError = false, undoFn = null) {
    clearTimeout(toastTimer);
    el.toast.hidden = false;
    el.toast.style.color = isError ? "#fca5a5" : "";
    if (typeof msg === "string") el.toast.textContent = msg
    else el.toast.replaceChildren(msg)
    if (undoFn) {
      const undo = tpl("tpl-toast-undo").firstElementChild;
      undo.addEventListener("click", () => { el.toast.hidden = true; undoFn(); });
      el.toast.append(" ", undo);
    }
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 8000);
  }

  function handleError(err) {
    console.error(err)
    showToast(err?.message || String(err), true)
  }

  // ── Viewport ──

  function syncViewportMetrics() {
    const h = window.visualViewport?.height || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`);
    if (el.topBar) document.documentElement.style.setProperty("--top-bar-height", `${Math.ceil(el.topBar.getBoundingClientRect().height)}px`);
  }

  // ── Render rows ──

  function renderRow(rowEl, items, type) {
    const scrollKey = `scroll:${rowEl.id}`;
    if (!items.length) { setEmpty(rowEl, "Nothing here."); return; }
    applyCachedDetails(items, type);
    rowEl.replaceChildren();
    items.forEach((item) => {
      const { frag, card } = makeRowItem();
      card.variant = "next";
      card.type = type;
      card.item = item;
      card.watching = item.status === "watching";
      card.addEventListener("poster:mark-watched", () => markWatched(item, type, card.cardEl));
      rowEl.appendChild(frag);
    });
    initDockEffect(rowEl);
    if (rowEl._scrollSave) rowEl.removeEventListener("scroll", rowEl._scrollSave);
    rowEl._scrollSave = () => { sessionStorage.setItem(scrollKey, rowEl.scrollLeft); };
    rowEl.addEventListener("scroll", rowEl._scrollSave, { passive: true });
    rowEl.scrollLeft = +(sessionStorage.getItem(scrollKey) || 0);
    annotateTrendingBadges(rowEl, items, (item) => isUnstarted(item, type));
    hydrateMissingDetails(rowEl, items, type);
  }

  // ── Mark watched ──

  function waitForWatchedAnimation(card) {
    if (!card) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      card.addEventListener("animationend", done, { once: true });
      setTimeout(done, 700);
    });
  }

  async function markWatched(item, type, card) {
    if (type === "movie") { promptRate(item, type, card); return; }
    if (card) card.classList.add("marking-watched");
    const snapshot = { ...item };
    try {
      await simkl.markWatched(item, type);
      showToast(toastFrag("Marked ", snapshot, type, " watched."), false, () => undoMarkWatched(snapshot, type));
      await waitForWatchedAnimation(card);
      await loadSuggestions();
    } catch (err) {
      if (card) card.classList.remove("marking-watched");
      handleError(err);
    }
  }

  async function undoMarkWatched(item, type) {
    try {
      await simkl.undoMarkWatched(item, type);
      showToast(toastFrag("Undone — ", item, type, " unmarked."));
      await loadSuggestions();
    } catch (err) { handleError(err); }
  }

  function toastFrag(prefix, item, type, suffix) {
    const ep = type === "tv" ? parseNextEpisode(item.next_to_watch) : null
    const typedItem = item.type ? item : { ...item, type }
    const url = ep ? buildEpisodeUrl(typedItem, ep) : buildSimklUrl(typedItem)
    const label = ep ? `${item.title} ${formatEpisode(ep)}` : item.title
    const link = Object.assign(document.createElement("a"), { href: url || "#", target: "_blank", rel: "noreferrer", textContent: label })
    link.style.color = "inherit"; link.style.textDecoration = "underline"
    const frag = document.createDocumentFragment()
    frag.append(prefix, link, suffix)
    return frag
  }

  function promptRate(item, type, card) {
    if (!card) return;
    const frag = tpl("tpl-rating-prompt");
    const prompt = frag.firstElementChild;
    prompt.querySelectorAll(".rating-btn").forEach((btn) =>
      btn.addEventListener("click", () => rateAndMarkWatched(item, type, Number(btn.dataset.rating), card)));
    prompt.querySelector(".rating-skip").addEventListener("click", () => {
      prompt.remove();
      markMovieWatched(item, card);
    });
    card.appendChild(prompt);
  }

  async function rateAndMarkWatched(item, type, rating, card) {
    if (card) card.classList.add("marking-watched");
    const snapshot = { ...item };
    try {
      await Promise.all([
        simkl.rate(item, type, rating),
        simkl.markWatched(item, type),
      ]);
      showToast(toastFrag("Rated ", snapshot, type, ` ${rating}/10 and marked watched.`), false, () => undoMarkWatched(snapshot, type));
      await waitForWatchedAnimation(card);
      await loadSuggestions();
    } catch (err) {
      if (card) card.classList.remove("marking-watched");
      handleError(err);
    }
  }

  async function markMovieWatched(item, card) {
    if (card) card.classList.add("marking-watched");
    const snapshot = { ...item };
    try {
      await simkl.markWatched(item, "movie");
      showToast(toastFrag("Marked ", snapshot, "movie", " watched."), false, () => undoMarkWatched(snapshot, "movie"));
      await waitForWatchedAnimation(card);
      await loadSuggestions();
    } catch (err) {
      if (card) card.classList.remove("marking-watched");
      handleError(err);
    }
  }

  // ── Episode title enrichment ──

  async function enrichEpisodeTitles() {
    const cache = readJsonStorage(STORAGE.episodeCache) || {};
    const results = await Promise.allSettled(tvItems.map(async (item) => {
      const ep = parseNextEpisode(item.next_to_watch);
      const id = simklId(item);
      if (!ep || !id || item.status === "plantowatch") return null;
      const cacheKey = `${id}:${ep.season}:${ep.episode}`;
      if (cache[cacheKey]) return cache[cacheKey];
      const episodes = await simkl.getEpisodes(id);
      const title = findEpisodeTitle(episodes, ep.season, ep.episode);
      if (title) cache[cacheKey] = title;
      return title;
    }));
    writeStorage(STORAGE.episodeCache, cache);
    let changed = false;
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        tvItems[i] = { ...tvItems[i], episodeTitle: r.value };
        changed = true;
      }
    });
    if (changed) renderRow(el.tvRow, tvItems, "tv");
  }

  // ── Load suggestions ──

  async function loadSuggestions() {
    if (!isLoggedIn()) { resolveLibraryReady(); return }
    el.spinner.hidden = false
    try {
      const data = await simkl.getLibrary()
      const allShows = [...(data.shows || []), ...(data.anime || [])]
      const allMovies = data.movies || []
      applyCachedDetails(allShows, "tv")
      applyCachedDetails(allMovies, "movie")
      tvItems = buildTvSuggestions(allShows)
      movieItems = buildMovieSuggestions(allMovies)
      libraryIndex = collectLibraryIndex(data)
      resolveLibraryReady()
      renderRow(el.tvRow, tvItems, "tv")
      renderRow(el.movieRow, movieItems, "movie")
      enrichEpisodeTitles()
      if (!tvItems.length && !movieItems.length && currentView === "next") showView("trending")
      if (data.fresh) showToast("Synced library.")
    } catch (err) {
      resolveLibraryReady()
      handleError(err)
    } finally {
      el.spinner.hidden = true
    }
  }

  // ── Trending ──

  function renderDiscoveryRow(containerEl, items, type) {
    const loggedIn = isLoggedIn();
    applyCachedDetails(items, type);
    containerEl.replaceChildren();
    items.forEach((item) => {
      const { frag, card } = makeRowItem();
      const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
      card.variant = "discovery";
      card.type = type;
      card.item = item;
      const entry = libraryIndex.get(id);
      card.watched = !!entry?.watched;
      card.watchedAt = entry?.watchedAt || null;
      card.userRating = entry?.userRating ?? null;
      card.inWatchlist = !!entry && !entry.watched;
      card.watching = !!entry?.watching;
      card.loggedIn = loggedIn;
      card.addEventListener("poster:add-watchlist", () => addToWatchlist(card));
      containerEl.appendChild(frag);
    });
    hydrateMissingDetails(containerEl, items, type);
  }

  async function addToWatchlist(card) {
    const item = card.item;
    const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
    const btn = card.cardEl?.querySelector(".add-watchlist-btn");
    if (!id || !btn) return;
    btn.disabled = true;
    try {
      await simkl.addToWatchlist(item, card.type);
      libraryIndex.set(id, { watched: false, watchedAt: null });
      card.inWatchlist = true;
      card._rendered = false;
      card._render();
      showToast(`Added "${item.title}" to watchlist.`);
      await loadSuggestions();
    } catch (err) {
      btn.disabled = false;
      handleError(err);
    }
  }

  function readRatingsCache() {
    const raw = readJsonStorage(STORAGE.ratingsCache);
    if (raw?.schema !== 3 || !raw.entries) return {};
    return raw.entries;
  }

  function writeRatingsCache(entries) {
    writeStorage(STORAGE.ratingsCache, { schema: 3, entries });
  }

  function getCachedInfo(entries, id) {
    const entry = entries[id];
    if (!entry) return null;
    const age = Date.now() - new Date(entry.fetchedAt).getTime();
    if (age > 30 * 24 * 60 * 60 * 1000) return null;
    return entry;
  }

  async function fetchItemDetails(type, id) {
    try {
      const data = await (type === "movie" ? simkl.getMovie(id) : simkl.getShow(id));
      const rating = data?.ratings?.imdb?.rating;
      return {
        rating: typeof rating === "number" ? rating : null,
        imdb: data?.ids?.imdb || null,
        total: data?.total_episodes,
        notAired: 0,
      };
    } catch {
      return null;
    }
  }

  async function chunkedForEach(items, size, fn) {
    for (let i = 0; i < items.length; i += size) {
      await Promise.all(items.slice(i, i + size).map(fn));
    }
  }

  function injectImdbBadge(card, item, rating) {
    const host = card?.cardEl?.querySelector(".poster-top-text");
    if (!host || host.querySelector(".imdb-badge")) return;
    const badge = tpl("tpl-imdb-badge").firstElementChild;
    badge.textContent = `IMDb ${rating}`;
    badge.href = buildImdbUrl(item);
    const anchor = host.querySelector(".trending-badge");
    if (anchor) host.insertBefore(badge, anchor);
    else host.appendChild(badge);
  }

  function injectEpisodeCount(card, count) {
    const host = card?.cardEl?.querySelector(".poster-top-text");
    if (!host || host.querySelector(".poster-episode-count")) return;
    const label = document.createElement("span");
    label.className = "poster-episode-count";
    label.textContent = `${count} episode${count === 1 ? "" : "s"}`;
    const anchor = host.querySelector(".imdb-badge, .trending-badge");
    if (anchor) host.insertBefore(label, anchor);
    else host.appendChild(label);
  }

  function applyCachedDetails(items, type) {
    const entries = readRatingsCache();
    for (const item of items) {
      const id = String(item?.ids?.simkl_id || item?.ids?.simkl || "");
      if (!id) continue;
      const cached = getCachedInfo(entries, id);
      if (!cached) continue;
      if (cached.imdb && !item.ids?.imdb) item.ids = { ...(item.ids || {}), imdb: cached.imdb };
      if (typeof cached.rating === "number") {
        if (item.ratings?.imdb?.rating == null) item.ratings = { ...(item.ratings || {}), imdb: { rating: cached.rating } };
      } else if (cached.rating === null) {
        item.release_status = "unreleased";
      }
      if (type === "tv" && typeof cached.total === "number") {
        if (!(item.total_episodes_count > 0)) item.total_episodes_count = cached.total;
        if (item.not_aired_episodes_count == null) item.not_aired_episodes_count = cached.notAired || 0;
      }
    }
  }

  async function hydrateMissingDetails(rowEl, items, typeOrFn) {
    const getType = typeof typeOrFn === "function" ? typeOrFn : () => typeOrFn;
    const entries = readRatingsCache();
    const cards = rowEl ? rowEl.querySelectorAll("poster-card") : [];
    const pending = [];
    items.forEach((item, i) => {
      const id = String(item?.ids?.simkl_id || item?.ids?.simkl || "");
      if (!id) return;
      const type = getType(item);
      const cached = getCachedInfo(entries, id);
      const needsRating = item.ratings?.imdb?.rating == null && isUnstarted(item, type);
      const needsCount = type === "tv" && !(item.total_episodes_count > 0);
      if (!needsRating && !needsCount) return;
      if (cached && (!needsRating || cached.rating != null) && (!needsCount || typeof cached.total === "number")) return;
      pending.push({ item, id, type, card: cards[i] });
    });
    if (!pending.length) return;
    await chunkedForEach(pending, 5, async ({ item, id, type, card }) => {
      const details = await fetchItemDetails(type, id);
      if (!details) return;
      entries[id] = { ...details, fetchedAt: new Date().toISOString() };
      if (details.rating == null && isUnstarted(item, type)) {
        item.release_status = "unreleased";
        card?.closest(".row-item")?.remove();
        return;
      }
      if (details.imdb && !item.ids?.imdb) item.ids = { ...(item.ids || {}), imdb: details.imdb };
      if (details.rating != null) {
        item.ratings = { ...(item.ratings || {}), imdb: { rating: details.rating } };
        if (card && isUnstarted(item, type)) injectImdbBadge(card, item, details.rating);
      }
      if (type === "tv" && typeof details.total === "number") {
        item.total_episodes_count = details.total;
        item.not_aired_episodes_count = details.notAired || 0;
        const count = availableEpisodesLeft(item);
        const showCount = card && !card.watching && (card.variant === "next" || !card.watched);
        if (showCount && Number.isFinite(count) && count > 0) injectEpisodeCount(card, count);
      }
    });
    writeRatingsCache(entries);
  }

  let trendingBadgeSetsPromise = null;
  function loadTrendingBadgeSets() {
    if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise;
    const periods = ["today", "week", "month"];
    trendingBadgeSetsPromise = Promise.all(periods.map((p) => simkl.getTrending(p)))
      .then((results) => {
        const sets = { today: new Set(), week: new Set(), month: new Set() };
        results.forEach(({ tv, movies }, i) => {
          const period = periods[i];
          for (const item of [...(tv || []), ...(movies || [])]) {
            const id = String(item?.ids?.simkl_id || item?.ids?.simkl || "");
            if (id) sets[period].add(id);
          }
        });
        return sets;
      })
      .catch(() => ({ today: new Set(), week: new Set(), month: new Set() }));
    return trendingBadgeSetsPromise;
  }

  async function annotateTrendingBadges(rowEl, items, isEligible) {
    const sets = await loadTrendingBadgeSets();
    const cards = rowEl.querySelectorAll("poster-card");
    items.forEach((item, i) => {
      const card = cards[i];
      if (!card) return;
      if (isEligible && !isEligible(item)) return;
      const id = String(item?.ids?.simkl_id || item?.ids?.simkl || "");
      const period = trendingPeriodFor(id, sets);
      if (!period) return;
      const info = trendingBadgeInfo(period);
      if (!info) return;
      const host = card.cardEl?.querySelector(".poster-top-text");
      if (!host || host.querySelector(".trending-badge")) return;
      const badge = tpl("tpl-trending-badge").firstElementChild;
      badge.classList.add(`trending-badge--${period}`);
      badge.title = info.tooltip;
      badge.setAttribute("aria-label", info.tooltip);
      badge.textContent = `🔥 ${info.label}`;
      host.appendChild(badge);
    });
  }

  async function loadTrending() {
    const period = el.trendingPeriodTabs.querySelector(".range-tab.active")?.dataset.period || "today";
    writeStorage(STORAGE.trendingPeriod, period);
    el.trendingTvContent.replaceChildren(tpl("tpl-spinner"));
    el.trendingMoviesContent.replaceChildren(tpl("tpl-spinner"));
    try {
      const [{ tv: tvData, movies: movieData }] = await Promise.all([simkl.getTrending(period), libraryReady]);
      const hideWatched = el.hideTrendingWatched.checked;
      const filterFn = (item) => !hideWatched || !libraryIndex.has(String(item.ids?.simkl_id || item.ids?.simkl || ""));
      const tv = tvData.filter(filterFn).slice(0, 12);
      const movies = movieData.filter(filterFn).slice(0, 12);
      if (tv.length) renderDiscoveryRow(el.trendingTvContent, tv, "tv");
      else setEmpty(el.trendingTvContent, "No results.");
      if (movies.length) renderDiscoveryRow(el.trendingMoviesContent, movies, "movie");
      else setEmpty(el.trendingMoviesContent, "No results.");
      initDockEffect(el.trendingTvContent);
      initDockEffect(el.trendingMoviesContent);
    } catch (err) {
      if (err instanceof ApiError) {
        setEmpty(el.trendingTvContent, err.message, true);
        setEmpty(el.trendingMoviesContent, err.message, true);
      } else console.error(err);
    }
  }

  // ── AI ──

  function hydrateAiView() {
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq";
    syncAiKeyLink();
    el.aiKeyBtn.hidden = !getAiKey(el.aiProviderSelect.value);
  }

  function openAiSettings() {
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq";
    syncAiKeyLink();
    el.aiSettings.showModal();
  }

  const AI_KEY_STORAGE = { gemini: STORAGE.aiKeyGemini, openai: STORAGE.aiKeyOpenai, claude: STORAGE.aiKeyClaude, grok: STORAGE.aiKeyGrok, groq: STORAGE.aiKeyGroq, deepseek: STORAGE.aiKeyDeepseek, openrouter: STORAGE.aiKeyOpenrouter };

  function getAiKey(provider) { return readStorage(AI_KEY_STORAGE[provider] || STORAGE.aiKeyGroq); }

  function syncAiKeyLink() {
    const opt = el.aiProviderSelect.selectedOptions[0];
    el.aiKeyLink.href = opt.dataset.url;
    el.aiKeyInput.value = getAiKey(el.aiProviderSelect.value);
    syncAiSaveLabel();
  }

  function syncAiSaveLabel() {
    const name = el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "");
    el.aiSaveBtn.textContent = `Save ${name} key`;
  }

  // ── AI Provider Adapters ──

  const AI_SYSTEM_TYPES = { both: "movies and TV shows", tv: "TV shows only", movie: "movies only" };
  function aiSystemPrompt(mediaType) {
    return `You are a film/TV recommender. Suggest exactly 10 ${AI_SYSTEM_TYPES[mediaType] || AI_SYSTEM_TYPES.both} with at least 6.5 IMDb rating. Do not suggest any title the user has rated — they are already in my library.

Taste:
- Treat 8-10 ratings as strong likes; 1-5 as dislikes (avoid similar).
- Infer across genre, tone, era, pacing, and country — not just genre.
- Mood is the primary filter; taste chooses which mood-fitting titles to pick.

Diversity within the 10:
- Max 2 sharing a franchise, director, or lead creator.
- Mix at least 3 decades and 3 countries/languages when plausible.
- Don't stack one subgenre.

Output: a JSON array only, no prose, no markdown:
[{"title":"...","year":1234}]`;
  }

  const AI_PROVIDERS = {
    gemini: {
      url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`,
      headers: () => ({ "Content-Type": "application/json" }),
      body: (systemPrompt, userMessage) => ({ contents: [{ parts: [{ text: systemPrompt + "\n\n" + userMessage }] }], generationConfig: { temperature: 0.9 } }),
      extract: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
    },
    openai: {
      url: () => "https://api.openai.com/v1/chat/completions",
      headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
      body: (systemPrompt, userMessage) => ({ model: "gpt-4o-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.9 }),
      extract: (data) => data.choices?.[0]?.message?.content,
    },
    claude: {
      url: () => "https://api.anthropic.com/v1/messages",
      headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" }),
      body: (systemPrompt, userMessage) => ({ model: "claude-sonnet-4-20250514", max_tokens: 512, system: systemPrompt, messages: [{ role: "user", content: userMessage }], temperature: 0.9 }),
      extract: (data) => data.content?.[0]?.text,
    },
    grok: {
      url: () => "https://api.x.ai/v1/chat/completions",
      headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
      body: (systemPrompt, userMessage) => ({ model: "grok-3-mini", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.9 }),
      extract: (data) => data.choices?.[0]?.message?.content,
    },
    groq: {
      url: () => "https://api.groq.com/openai/v1/chat/completions",
      headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
      body: (systemPrompt, userMessage) => ({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.9 }),
      extract: (data) => data.choices?.[0]?.message?.content,
    },
    deepseek: {
      url: () => "https://api.deepseek.com/chat/completions",
      headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
      body: (systemPrompt, userMessage) => ({ model: "deepseek-chat", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.9 }),
      extract: (data) => data.choices?.[0]?.message?.content,
    },
    openrouter: {
      url: () => "https://openrouter.ai/api/v1/chat/completions",
      headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
      body: (systemPrompt, userMessage) => ({ model: "google/gemini-2.5-flash-lite-preview:free", messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }], temperature: 0.9 }),
      extract: (data) => data.choices?.[0]?.message?.content,
    },
  };

  async function aiComplete(provider, key, userMessage, systemPrompt) {
    const config = AI_PROVIDERS[provider];
    if (!config) throw new ApiError("Unknown AI provider");
    const res = await fetch(config.url(key), {
      method: "POST",
      headers: config.headers(key),
      body: JSON.stringify(config.body(systemPrompt, userMessage)),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(res.status === 429 ? "AI quota exceeded. Try again later." : (data.error?.message || (typeof data.error === "string" ? data.error : null) || `${provider} error ${res.status}`));
    return config.extract(data) || "";
  }

  // ── Recommendation Flow ──

  async function resolveSimkl(suggestions, mediaType) {
    const results = await Promise.all(
      suggestions.map((s) => simkl.searchByTitle(s.title, s.year, mediaType))
    );
    return results.filter(Boolean);
  }

  async function fetchAiSuggestions(provider, key, userMessage, systemPrompt) {
    const raw = await aiComplete(provider, key, userMessage, systemPrompt);
    try {
      const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      throw new ApiError("Couldn't parse AI suggestions. Try again.");
    }
  }

  function getAiMediaType() {
    const tv = el.aiToggleTv.classList.contains("active");
    const movie = el.aiToggleMovie.classList.contains("active");
    if (tv && movie) return "both";
    if (tv) return "tv";
    if (movie) return "movie";
    return "both";
  }

  async function getRecommendations(mood) {
    const mediaType = getAiMediaType();
    const library = await simkl.getLibrary();
    const ratings = buildRatingsInput(mediaType, library.shows, library.movies, library.anime);
    if (!ratings) { showToast("No ratings found. Rate some titles first.", true); return []; }

    const provider = readStorage(STORAGE.aiProvider) || "groq";
    const key = getAiKey(provider);
    const systemPrompt = aiSystemPrompt(mediaType);
    const moodLine = mood.gloss ? `${mood.label} — ${mood.gloss}` : mood.label;
    const userMessage = `${ratings}\nMood: ${moodLine}`;

    const suggestions = await fetchAiSuggestions(provider, key, userMessage, systemPrompt);
    const resolved = await resolveSimkl(suggestions, mediaType);
    const getType = (item) => item.type === "movie" ? "movie" : "tv";
    applyCachedDetails(resolved.filter((i) => getType(i) === "tv"), "tv");
    applyCachedDetails(resolved.filter((i) => getType(i) === "movie"), "movie");
    await hydrateMissingDetails(null, resolved, getType);
    return resolved
      .filter((i) => i.release_status !== "unreleased")
      .sort((a, b) => {
        const ea = libraryIndex.get(String(a.ids?.simkl_id || a.ids?.simkl || ""));
        const eb = libraryIndex.get(String(b.ids?.simkl_id || b.ids?.simkl || ""));
        const aw = ea?.watched ? 1 : 0;
        const bw = eb?.watched ? 1 : 0;
        if (aw !== bw) return aw - bw;
        if (aw) return new Date(ea?.watchedAt || 0) - new Date(eb?.watchedAt || 0);
        return (b.ratings?.imdb?.rating || 0) - (a.ratings?.imdb?.rating || 0);
      });
  }

  // ── AI Result Rendering ──

  function renderAiResults(items) {
    if (!items.length) {
      setEmpty(el.aiResults, "No suggestions. Try another mood.");
      return;
    }
    const typed = items.map((item) => ({ item, type: item.type === "movie" ? "movie" : "tv" }));
    el.aiResults.replaceChildren();
    typed.forEach(({ item, type }) => {
      const { frag, card } = makeRowItem();
      const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
      card.variant = "discovery";
      card.type = type;
      card.item = item;
      const entry = libraryIndex.get(id);
      card.watched = !!entry?.watched;
      card.watchedAt = entry?.watchedAt || null;
      card.userRating = entry?.userRating ?? null;
      card.inWatchlist = !!entry && !entry.watched;
      card.watching = !!entry?.watching;
      card.loggedIn = true;
      card.addEventListener("poster:add-watchlist", () => addToWatchlist(card));
      el.aiResults.appendChild(frag);
    });
    annotateTrendingBadges(el.aiResults, typed.map(({ item }) => item), (item) => !libraryIndex.has(String(item.ids?.simkl_id || item.ids?.simkl || "")));
  }

  el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => { if (b.dataset.gloss) b.title = b.dataset.gloss })

  el.aiPrompts.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ai-prompt-btn");
    if (!btn) return;
    if (!getAiKey(readStorage(STORAGE.aiProvider) || "groq")) {
      openAiSettings()
      return
    }
    el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    el.aiResults.replaceChildren(tpl("tpl-spinner"));
    try {
      const items = await getRecommendations({ label: btn.textContent, gloss: btn.dataset.gloss || "" });
      renderAiResults(items);
    } catch (err) {
      el.aiResults.replaceChildren();
      handleError(err);
    }
  });

  [el.aiToggleTv, el.aiToggleMovie].forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const other = btn === el.aiToggleTv ? el.aiToggleMovie : el.aiToggleTv;
      if (btn.classList.contains("active") && !other.classList.contains("active")) return;
      btn.classList.toggle("active");
      writeStorage(STORAGE.aiMediaType, getAiMediaType());
      el.aiResults.replaceChildren();
      el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => b.classList.remove("active"));
    });
  });

  // ── Navigation ──

  function showView(name) {
    currentView = name;
    el.nextView.hidden = name !== "next";
    el.trendingView.hidden = name !== "trending";
    el.aiView.hidden = name !== "ai";
    [el.navNext, el.navTrending, el.navAi].forEach((btn) => btn.classList.remove("active-nav"));
    if (name === "next") el.navNext.classList.add("active-nav");
    if (name === "trending") el.navTrending.classList.add("active-nav");
    if (name === "ai") el.navAi.classList.add("active-nav");
    if (name === "trending") loadTrending();
    if (name === "ai") hydrateAiView();
    if (name === "next") hydrateNextView();
    const hash = name === "next" ? "" : `#${name}`;
    if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
  }

  // ── OAuth ──

  function startOAuth() {
    const clientId = window.__SIMKL_CLIENT_ID__;
    const redirectUri = window.__REDIRECT_URI__;
    if (!clientId) { showToast("Client ID is not configured.", true); return; }
    if (!redirectUri) { showToast(`Redirect URI is not set. Register ${location.origin}${location.pathname} on Simkl and set REDIRECT_URI.`, true); return; }
    const state = Math.random().toString(36).slice(2);
    sessionStorage.setItem("oauth-state", state);
    location.assign(`https://simkl.com/oauth/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`);
  }

  async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const error = params.get("error");
    if (!code && !error) return;
    history.replaceState(null, "", `${location.pathname}${location.hash || ""}`);
    el.spinner.hidden = false;
    try {
      if (error) throw new ApiError(`${error} (sent redirect_uri=${window.__REDIRECT_URI__ || "<unset>"})`);
      const expected = sessionStorage.getItem("oauth-state");
      const state = params.get("state") || "";
      if (expected && state && expected !== state) throw new ApiError("State mismatch.");
      const token = await simkl.exchangeOAuthCode(code, window.__REDIRECT_URI__);
      writeStorage(STORAGE.accessToken, token.access_token);
      sessionStorage.removeItem("oauth-state");
      hydrateUI();
      showView("next");
      showToast("Connected to Simkl.");
      await loadSuggestions();
    } catch (err) {
      handleError(err);
      showView("next");
    } finally {
      el.spinner.hidden = true;
    }
  }

  function logout() {
    clearAllStorage();
    tvItems = [];
    movieItems = [];
    libraryIndex.clear();
    hydrateUI();
    showView("next");
    showToast("Logged out.");
  }

  // ── UI hydration ──

  function hydrateNextView() {
    const loggedIn = isLoggedIn();
    el.nextSetup.hidden = loggedIn;
    el.nextContent.hidden = !loggedIn;
  }

  function hydrateUI() {
    const loggedIn = isLoggedIn();
    el.topBar.hidden = false;
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq";
    el.aiKeyInput.value = getAiKey(el.aiProviderSelect.value);
    el.hideTrendingWatched.closest("label").hidden = !loggedIn;
    el.logoutBtn.hidden = !loggedIn;
    hydrateNextView();
    syncViewportMetrics();
  }

  // ── Wire events ──

  el.aiSaveBtn.addEventListener("click", () => {
    const provider = el.aiProviderSelect.value;
    const aiKey = el.aiKeyInput.value.trim();
    if (!aiKey) { showToast("Enter an AI API key.", true); return; }
    writeStorage(STORAGE.aiProvider, provider);
    writeStorage(AI_KEY_STORAGE[provider], aiKey);
    syncAiSaveLabel();
    el.aiKeyBtn.hidden = false;
    el.aiSettings.close();
    showToast(`${el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "")} key saved.`);
  });
  el.aiKeyBtn.addEventListener("click", openAiSettings);
  el.aiSettingsClose.addEventListener("click", () => el.aiSettings.close());
  el.logoutBtn.addEventListener("click", logout);
  el.getStartedBtn.addEventListener("click", startOAuth);
  el.navNext.addEventListener("click", (e) => { e.preventDefault(); showView("next"); });
  el.navTrending.addEventListener("click", (e) => { e.preventDefault(); showView("trending"); });
  el.navAi.addEventListener("click", (e) => { e.preventDefault(); showView("ai"); });
  el.hideTrendingWatched.addEventListener("change", () => { writeStorage(STORAGE.hideWatched, el.hideTrendingWatched.checked); loadTrending(); });
  el.aiProviderSelect.addEventListener("change", () => { syncAiKeyLink(); syncAiSaveLabel(); });
  el.trendingPeriodTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".range-tab");
    if (!tab) return;
    el.trendingPeriodTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    loadTrending();
  });

  syncViewportMetrics();
  window.addEventListener("resize", syncViewportMetrics, { passive: true });
  window.visualViewport?.addEventListener("resize", syncViewportMetrics, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && isLoggedIn()) loadSuggestions(); });

  // PWA install
  let deferredInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstallPrompt = e; el.installBtn.classList.remove("hidden"); });
  el.installBtn.addEventListener("click", () => { if (deferredInstallPrompt) deferredInstallPrompt.prompt(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});

  // ── Boot ──

  hydrateUI();
  el.hideTrendingWatched.checked = readStorage(STORAGE.hideWatched) === "true";
  const savedMediaType = readStorage(STORAGE.aiMediaType);
  if (savedMediaType) {
    el.aiToggleTv.classList.toggle("active", savedMediaType === "both" || savedMediaType === "tv");
    el.aiToggleMovie.classList.toggle("active", savedMediaType === "both" || savedMediaType === "movie");
  }
  const savedPeriod = readStorage(STORAGE.trendingPeriod);
  if (savedPeriod) {
    el.trendingPeriodTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", t.dataset.period === savedPeriod));
  }
  handleOAuthCallback();
  const hash = location.hash.replace("#", "").split("/")[0];
  if (isLoggedIn()) {
    showView(hash === "trending" ? "trending" : hash === "ai" ? "ai" : "next");
    loadSuggestions();
  } else {
    resolveLibraryReady();
    showView(hash === "trending" ? "trending" : "next");
  }
})();
