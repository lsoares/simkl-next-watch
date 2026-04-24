import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"
import { fetchAiSuggestions, fetchSimilarSuggestions } from "./aiProvider.js"
import { isUnstarted, availableEpisodesLeft } from "./posterCard.js"

function mediaRepository() {
  return localStorage.getItem("next-watch-provider") === "trakt" ? traktRepository : simklRepository
}

// ── Pure domain functions (no DOM, no storage, no fetch) ──

const byAddedDate = (a, b) => new Date(a.added_at || 0) - new Date(b.added_at || 0)

function byWatchingPriority(a, b) {
  const aLeft = availableEpisodesLeft(a), bLeft = availableEpisodesLeft(b)
  if ((aLeft === 1) !== (bLeft === 1)) return aLeft === 1 ? -1 : 1
  if (aLeft === 1) return (a.runtime || Infinity) - (b.runtime || Infinity)
  return new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0)
}

function collectLibraryIndex(data) {
  const index = new Map()
  for (const item of [...(data.shows || []), ...(data.movies || [])]) {
    for (const key of itemLookupKeys(item)) index.set(key, item)
  }
  return index
}

function itemLookupKeys(item) {
  const ids = item?.ids || {}
  return [ids.simkl, ids.imdb, ids.trakt, ids.tmdb, ids.slug]
    .filter((k) => k != null && k !== "")
    .map(String)
}

function libraryLookup(libraryIndex, item) {
  for (const key of itemLookupKeys(item)) {
    const match = libraryIndex.get(key)
    if (match) return match
  }
  return null
}

function mergeWithLibrary(item, libraryIndex) {
  const match = libraryLookup(libraryIndex, item)
  return match ? { ...item, ...match, ids: { ...item.ids, ...match.ids } } : item
}

function trendingBadgeInfo(period) {
  if (period === "today") return { label: "Today", tooltip: "Trending today" }
  if (period === "week") return { label: "Week", tooltip: "Trending this week" }
  if (period === "month") return { label: "Month", tooltip: "Trending this month" }
  return null
}

function trendingPeriodFor(candidateIds, sets) {
  if (!sets) return null
  const ids = candidateIds.filter(Boolean).map(String)
  if (!ids.length) return null
  for (const period of ["today", "week", "month"]) {
    if (ids.some((id) => sets[period].has(id))) return period
  }
  return null
}

function trendingIdsOf(item) {
  const ids = item?.ids || {}
  return [ids.simkl, ids.imdb, ids.tmdb]
}

// ── Storage ──

const STORAGE = {
  accessToken: "next-watch-access-token",
  provider: "next-watch-provider",
  trendingPeriod: "next-watch-trending-period",
  similarMinRating: "next-watch-similar-min-rating",
  aiProvider: "next-watch-ai-provider",
  aiKeyGemini: "next-watch-ai-key-gemini",
  aiKeyOpenai: "next-watch-ai-key-openai",
  aiKeyClaude: "next-watch-ai-key-claude",
  aiKeyGrok: "next-watch-ai-key-grok",
  aiKeyGroq: "next-watch-ai-key-groq",
  aiKeyDeepseek: "next-watch-ai-key-deepseek",
  aiKeyOpenrouter: "next-watch-ai-key-openrouter",
}

function readStorage(key) { return localStorage.getItem(key) || ""; }
function writeStorage(key, value) { try { localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value)); } catch {} }
function clearAllStorage() {
  for (const storage of [localStorage, sessionStorage]) {
    Object.keys(storage).forEach((k) => { if (k.startsWith("next-watch-")) storage.removeItem(k) })
  }
}

function getAccessToken() { return readStorage(STORAGE.accessToken); }
function isLoggedIn() { return !!getAccessToken(); }

// ── Dock effect (visual, self-contained) ──

function initDockEffect(row) {
  const MAX_EXTRA = 0.5, RADIUS = 2.5
  let baseW = 0

  function computeBase() {
    if (window.matchMedia("(max-width: 680px)").matches) {
      baseW = row.clientHeight * 2 / 3
      row.style.setProperty("--dock-h", row.clientHeight + "px")
    } else {
      baseW = (Math.min(window.innerWidth, 680) - 64) / 3
    }
  }

  function apply(cx) {
    if (!baseW) return
    const cards = [...row.querySelectorAll(".item-card")]
    const rects = cards.map((c) => c.getBoundingClientRect())
    cards.forEach((card, i) => {
      const dist = Math.abs(cx - (rects[i].left + rects[i].width / 2))
      const t = Math.max(0, 1 - dist / (baseW * RADIUS))
      card.style.setProperty("--dock-scale", (1 + MAX_EXTRA * t * t).toFixed(3))
    })
  }

  function reset() {
    for (const c of row.querySelectorAll(".item-card")) c.style.removeProperty("--dock-scale");
  }

  requestAnimationFrame(() => {
    computeBase()
    if (window.matchMedia("(max-width: 680px)").matches) {
      row.addEventListener("scroll", () => { const r = row.getBoundingClientRect(); apply(r.left + r.width / 2); }, { passive: true })
    } else {
      row.addEventListener("mousemove", (e) => apply(e.clientX))
      row.addEventListener("mouseleave", reset)
    }
    window.addEventListener("resize", () => { computeBase(); reset(); }, { passive: true })
  })
}

// ── App (DOM + state + wiring) ──

(function app() {
  const $ = (id) => document.getElementById(id)
  const tpl = (id) => $(id).content.cloneNode(true)
  const setEmpty = (container, msg, isError = false) => {
    const p = tpl("tpl-empty").firstElementChild
    p.textContent = msg
    if (isError) p.style.color = "#fca5a5"
    container.replaceChildren(p)
  }
  const makeRowItem = () => {
    const frag = tpl("tpl-row-item")
    const card = document.createElement("poster-card")
    frag.firstElementChild.appendChild(card)
    return { frag, card }
  }
  const fillPosterSkeletons = (row, count = 10) => {
    row.replaceChildren()
    for (let i = 0; i < count; i++) row.appendChild(tpl("tpl-poster-skeleton"))
  }
  const appendAddMoreTile = (rowEl, { href, icon, label }) => {
    const frag = tpl("tpl-add-more")
    const anchor = frag.querySelector(".add-more-card")
    anchor.href = href
    anchor.setAttribute("aria-label", label)
    anchor.querySelector(".add-more-plus").textContent = icon
    anchor.querySelector(".add-more-label").textContent = label
    rowEl.appendChild(frag)
  }
  const el = {
    topBar: $("topBar"), navHome: $("navHome"), navNext: $("navNext"), navTrending: $("navTrending"), navAi: $("navAi"),
    homepageView: $("homepageView"),
    nextSetup: $("nextSetup"), nextContent: $("nextContent"),
    logoutBtn: $("logoutBtn"), coffeeLink: $("coffeeLink"), aiSaveBtn: $("aiSaveBtn"),
    nextView: $("nextView"), tvRow: $("tvRow"), movieRow: $("movieRow"),
    trendingView: $("trendingView"), trendingSetup: $("trendingSetup"), trendingContent: $("trendingContent"), trendingPeriodTabs: $("trendingPeriodTabs"),
    trendingTvContent: $("trendingTvContent"), trendingMoviesContent: $("trendingMoviesContent"),
    aiView: $("aiView"), aiSetup: $("aiSetup"), aiContent: $("aiContent"),
    aiSettings: $("aiSettings"), aiSettingsForm: $("aiSettingsForm"), aiProviderUsername: $("aiProviderUsername"), aiSettingsClose: $("aiSettingsClose"),
    aiKeyBtn: $("aiKeyBtn"),
    aiProviderSelect: $("aiProviderSelect"), aiKeyInput: $("aiKeyInput"), aiKeyLink: $("aiKeyLink"),
    aiPrompts: $("aiPrompts"),
    aiDialog: $("aiDialog"), aiDialogTitle: $("aiDialogTitle"), aiDialogBack: $("aiDialogBack"),
    aiDialogClose: $("aiDialogClose"), aiDialogResults: $("aiDialogResults"),
    navSimilar: $("navSimilar"),
    similarView: $("similarView"), similarSetup: $("similarSetup"), similarContent: $("similarContent"),
    similarReload: $("similarReload"), similarGrid: $("similarGrid"),
    similarStats: $("similarStats"), similarRatingTabs: $("similarRatingTabs"),
    spinner: $("loadingSpinner"), toast: $("toast"), installBtn: $("installButton"),
    attribution: $("attribution"), attributionProviderLink: $("attributionProviderLink"),
  }

  let currentView = null
  let toastTimer = null
  let libraryIndex = new Map()
  let resolveLibraryReady
  let libraryReady = new Promise((r) => { resolveLibraryReady = r; })
  let tvItems = []
  let movieItems = []

  // ── Toast ──

  function showToast(msg, isError = false) {
    clearTimeout(toastTimer)
    el.toast.hidden = false
    el.toast.style.color = isError ? "#fca5a5" : ""
    if (typeof msg === "string") el.toast.textContent = msg
    else el.toast.replaceChildren(msg)
    toastTimer = setTimeout(() => { el.toast.hidden = true; }, 8000)
  }

  function handleError(err) {
    console.error(err)
    if (!err?.user) window.posthog?.captureException?.(err)
    showToast(err?.message || String(err), true)
  }

  function showRetrySignInToast(userData, message) {
    const link = Object.assign(document.createElement("a"), { href: "#", textContent: "Try again" })
    link.style.color = "inherit"
    link.addEventListener("click", (e) => { e.preventDefault(); userData.startOAuth() })
    const frag = document.createDocumentFragment()
    frag.append(`${message} `, link)
    showToast(frag, true)
  }

  // ── Viewport ──

  function syncViewportMetrics() {
    const h = window.visualViewport?.height || window.innerHeight
    document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`)
    if (el.topBar) document.documentElement.style.setProperty("--top-bar-height", `${Math.ceil(el.topBar.getBoundingClientRect().height)}px`)
    syncSimilarRows?.()
  }

  // ── Render rows ──

  function renderRow(rowEl, items, type) {
    rowEl.replaceChildren()
    items.forEach((item) => renderPosterCard(rowEl, mergeWithLibrary(item, libraryIndex)))
    appendAddMoreTile(rowEl, { href: mediaRepository().getBrowseUrl(type), icon: "+", label: type === "tv" ? "Add series" : "Add movie" })
    initDockEffect(rowEl)
    annotateTrendingBadges(rowEl, items, (item) => isUnstarted(item, type))
    observeProgressHydration(rowEl)
  }

  // ── Mark watched ──

  function waitForWatchedAnimation(card) {
    if (!card) return Promise.resolve()
    return new Promise((resolve) => {
      const done = () => resolve()
      card.addEventListener("animationend", done, { once: true })
      setTimeout(done, 700)
    })
  }

  async function markWatched(item, card) {
    if (card) card.classList.add("marking-watched")
    const snapshot = { ...item }
    try {
      await mediaRepository().markWatched(item)
      showToast(toastFrag("Marked ", snapshot, " watched."))
      await waitForWatchedAnimation(card)
      await loadSuggestions()
    } catch (err) {
      if (card) card.classList.remove("marking-watched")
      handleError(err)
    }
  }

  function toastFrag(prefix, item, suffix) {
    const ep = item.type === "tv" ? item.nextEpisode : null
    const base = item.url || ""
    const url = ep ? (mediaRepository().getEpisodeUrl?.(item, ep) || base) : base
    const label = ep ? `${item.title} ${ep.season}x${ep.episode}` : item.title
    const link = Object.assign(document.createElement("a"), { href: url || "#", target: "_blank", rel: "noreferrer", textContent: label })
    link.style.color = "inherit"; link.style.textDecoration = "underline"
    const frag = document.createDocumentFragment()
    frag.append(prefix, link, suffix)
    return frag
  }

  // ── Episode title enrichment ──

  async function enrichEpisodeTitles() {
    const results = await Promise.allSettled(tvItems.map((item) => {
      const ep = item.nextEpisode
      if (!ep || !item.id || item.status === "plantowatch") return null
      return mediaRepository().getEpisodeTitle?.(item.id, ep.season, ep.episode)
    }))
    let changed = false
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        tvItems[i] = { ...tvItems[i], episodeTitle: r.value }
        changed = true
      }
    })
    if (changed) renderRow(el.tvRow, tvItems, "tv")
  }

  // ── Load suggestions ──

  async function loadSuggestions() {
    if (!isLoggedIn()) { resolveLibraryReady(); return }
    el.spinner.hidden = false
    try {
      const u = mediaRepository()
      const [ws, wls, wlm, cs, cm] = await Promise.all([
        u.getWatchingShows(), u.getWatchlistShows(), u.getWatchlistMovies(),
        u.getCompletedShows(), u.getCompletedMovies(),
      ])
      const allShows = [...ws.items, ...wls.items, ...cs.items]
      const allMovies = [...wlm.items, ...cm.items]
      const data = { shows: allShows, movies: allMovies, fresh: ws.fresh || wls.fresh || wlm.fresh || cs.fresh || cm.fresh }
      tvItems = [...[...ws.items].sort(byWatchingPriority), ...[...wls.items].sort(byAddedDate)]
        .filter((i) => i.release_status !== "unreleased")
      movieItems = wlm.items.filter((i) => i.release_status !== "unreleased")
        .map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
      libraryIndex = collectLibraryIndex(data)
      resolveLibraryReady()
      renderRow(el.tvRow, tvItems, "tv")
      renderRow(el.movieRow, movieItems, "movie")
      enrichEpisodeTitles()
      if (data.fresh && el.toast.hidden) showToast("Synced library.")
    } catch (err) {
      resolveLibraryReady()
      handleError(err)
    } finally {
      el.spinner.hidden = true
    }
  }

  // ── Trending ──

  function renderDiscoveryRow(containerEl, items, type, browseParams = {}) {
    containerEl.replaceChildren()
    items.forEach((item) => renderPosterCard(containerEl, asSeriesPoster(mergeWithLibrary(item, libraryIndex)), { fade: true }))
    const u = mediaRepository()
    appendAddMoreTile(containerEl, { href: u.getTrendingBrowseUrl(type, browseParams), icon: "→", label: type === "tv" ? "View all series" : "View all movies" })
  }

  async function addToWatchlist(card) {
    const item = card.item
    const keys = itemLookupKeys(item)
    const btn = card.cardEl?.querySelector(".add-watchlist-btn")
    if (!keys.length || !btn) return
    btn.disabled = true
    try {
      await mediaRepository().addToWatchlist(item)
      const plantowatchItem = { ...item, status: "plantowatch" }
      for (const key of keys) libraryIndex.set(key, plantowatchItem)
      card.item = plantowatchItem
      card.refresh()
      showToast(toastFrag("Added ", item, " to watchlist."))
      await loadSuggestions()
    } catch (err) {
      btn.disabled = false
      handleError(err)
    }
  }

  let progressObserver = null
  function observeProgressHydration(rowEl) {
    if (!progressObserver) {
      progressObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          progressObserver.unobserve(entry.target)
          hydrateProgress(entry.target)
        }
      }, { rootMargin: "200px" })
    }
    rowEl.querySelectorAll("poster-card").forEach((c) => {
      if (needsProgressHydration(c.item)) progressObserver.observe(c)
    })
  }

  function needsProgressHydration(item) {
    if (!item) return false
    return !!(mediaRepository().getProgress && item.type === "tv" && item.status === "watching" && (item.ids?.slug || item.ids?.trakt))
  }

  async function hydrateProgress(card) {
    const item = card.item
    if (!item) return
    const getProgress = mediaRepository().getProgress
    if (!getProgress) return
    const key = item.ids.slug || item.ids.trakt
    const progress = await getProgress(key)
    if (progress === null) {
      card.closest(".row-item")?.remove()
      return
    }
    if (progress?.nextEpisode) {
      item.nextEpisode = progress.nextEpisode
      item.episodeUrl = item.url ? `${item.url}/seasons/${progress.nextEpisode.season}/episodes/${progress.nextEpisode.episode}` : ""
      if (progress.title) item.episodeTitle = progress.title
      card.refresh()
    }
  }

  let trendingBadgeSetsPromise = null
  function loadTrendingBadgeSets() {
    if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise
    const periods = ["today", "week", "month"]
    trendingBadgeSetsPromise = new Promise((resolve) => requestIdleCallback(resolve, { timeout: 2000 }))
      .then(() => Promise.all(periods.map((p) => mediaRepository().getTrending(p))))
      .then((results) => {
        const sets = { today: new Set(), week: new Set(), month: new Set() }
        results.forEach(({ tv, movies }, i) => {
          const period = periods[i]
          for (const item of [...(tv || []), ...(movies || [])]) {
            for (const id of trendingIdsOf(item)) {
              if (id) sets[period].add(String(id))
            }
          }
        })
        return sets
      })
      .catch(() => ({ today: new Set(), week: new Set(), month: new Set() }))
    return trendingBadgeSetsPromise
  }

  async function annotateTrendingBadges(rowEl, items, isEligible) {
    const sets = await loadTrendingBadgeSets()
    const cards = rowEl.querySelectorAll("poster-card")
    items.forEach((item, i) => {
      const card = cards[i]
      if (!card) return
      if (isEligible?.(item) === false) return
      const period = trendingPeriodFor(trendingIdsOf(item), sets)
      if (!period) return
      const info = trendingBadgeInfo(period)
      if (!info) return
      const host = card.cardEl?.querySelector(".poster-top-text")
      if (!host || host.querySelector(".trending-badge")) return
      const badge = tpl("tpl-trending-badge").firstElementChild
      badge.classList.add(`trending-badge--${period}`)
      badge.title = info.tooltip
      badge.setAttribute("aria-label", info.tooltip)
      badge.textContent = `🔥 ${info.label}`
      host.appendChild(badge)
    })
  }

  function hydrateTrendingView() {
    const loggedIn = isLoggedIn()
    el.trendingSetup.hidden = loggedIn
    el.trendingContent.hidden = !loggedIn
    if (loggedIn) loadTrending()
  }

  async function loadTrending() {
    const period = el.trendingPeriodTabs.querySelector(".range-tab.active")?.dataset.period || "today"
    writeStorage(STORAGE.trendingPeriod, period)
    el.trendingTvContent.replaceChildren(tpl("tpl-spinner"))
    el.trendingMoviesContent.replaceChildren(tpl("tpl-spinner"))
    try {
      const [{ tv: tvData, movies: movieData }] = await Promise.all([mediaRepository().getTrending(period), libraryReady])
      const filterFn = (item) => item.release_status !== "unreleased" && !libraryLookup(libraryIndex, item)
      const tv = tvData.filter(filterFn).slice(0, 12)
      const movies = movieData.filter(filterFn).slice(0, 12)
      if (tv.length) renderDiscoveryRow(el.trendingTvContent, tv, "tv", { period })
      else setEmpty(el.trendingTvContent, "No results.")
      if (movies.length) renderDiscoveryRow(el.trendingMoviesContent, movies, "movie", { period })
      else setEmpty(el.trendingMoviesContent, "No results.")
      initDockEffect(el.trendingTvContent)
      initDockEffect(el.trendingMoviesContent)
    } catch (err) {
      console.error(err)
      setEmpty(el.trendingTvContent, err.message, true)
      setEmpty(el.trendingMoviesContent, err.message, true)
    }
  }

  // ── AI ──

  function hydrateAiView() {
    const loggedIn = isLoggedIn()
    el.aiSetup.hidden = loggedIn
    el.aiContent.hidden = !loggedIn
    if (!loggedIn) return
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq"
    syncAiKeyLink()
  }

  function hydrateSimilarView() {
    const loggedIn = isLoggedIn()
    el.similarSetup.hidden = loggedIn
    el.similarContent.hidden = !loggedIn
    if (!loggedIn) return
    libraryReady.then(() => renderSimilar())
  }

  const SIMILAR_BATCH = 20
  let similarPool = []
  let similarCursor = 0
  let similarObserver = null

  async function renderSimilar() {
    const { shows, movies } = await gatherLibrary()
    renderSimilarStats(shows, movies)
    const all = [...shows, ...movies]
    const minRating = resolveSimilarMinRating(all)
    const pool = minRating === 0 ? all : all.filter((i) => (i.user_rating || 0) >= minRating)
    similarPool = pool
      .map((p) => [Math.random(), p])
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => p)
    similarCursor = 0
    similarObserver?.disconnect()
    similarObserver = null
    el.similarGrid.replaceChildren()
    el.similarGrid.scrollLeft = 0
    syncSimilarRows()
    appendSimilarBatch()
    observeSimilarTail()
  }

  function syncSimilarRows() {
    if (el.similarView.hidden) return
    const grid = el.similarGrid
    const cs = getComputedStyle(grid)
    const colWidth = parseFloat(cs.gridAutoColumns)
    if (!Number.isFinite(colWidth) || colWidth <= 0) return
    const gap = parseFloat(cs.rowGap) || 10
    // On mobile the grid is flex-bounded; measure it directly. On desktop the
    // grid is content-sized, so fall back to viewport minus its top offset.
    const isMobile = window.matchMedia("(max-width: 680px)").matches
    const appHeight = window.visualViewport?.height || window.innerHeight
    const availHeight = isMobile ? grid.clientHeight : appHeight - grid.getBoundingClientRect().top - 16
    if (availHeight <= 0) return
    const rowHeight = colWidth * 1.5 + gap
    const rows = Math.max(1, Math.floor((availHeight + gap) / rowHeight))
    grid.style.setProperty("--rows", rows)
  }
  new ResizeObserver(syncSimilarRows).observe(el.similarGrid)

  function appendSimilarBatch() {
    const slice = similarPool.slice(similarCursor, similarCursor + SIMILAR_BATCH)
    similarCursor += slice.length
    slice.forEach((item) => renderPosterCard(el.similarGrid, asSeriesPoster(mergeWithLibrary(item, libraryIndex))))
  }

  function observeSimilarTail() {
    if (similarCursor >= similarPool.length) return
    similarObserver ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        similarObserver.unobserve(entry.target)
        appendSimilarBatch()
        observeSimilarTail()
      }
    }, { root: el.similarGrid, rootMargin: "0px 800px 0px 0px" })
    const items = el.similarGrid.querySelectorAll(".row-item")
    if (items.length) similarObserver.observe(items[items.length - 1])
  }

  function renderSimilarStats(shows, movies) {
    const watchedMovies = movies.filter((m) => m.status === "completed")
    const watchedShows = shows.filter((s) => (s.watched_episodes_count || 0) > 0 || s.status === "completed")
    const watchedEpisodes = shows.reduce((sum, s) => sum + (s.watched_episodes_count || 0), 0)
    const movieMinutes = watchedMovies.reduce((sum, m) => sum + (m.runtime || 0), 0)
    const showMinutes = shows.reduce((sum, s) => sum + (s.watched_episodes_count || 0) * (s.runtime || 0), 0)
    el.similarStats.replaceChildren(
      statLi("📺", [
        [watchedShows.length, "shows watched"],
        [watchedEpisodes, "episodes watched"],
        [formatDays(showMinutes), "days spent on shows"],
      ]),
      statLi("🎬", [
        [watchedMovies.length, "movies watched"],
        [formatDays(movieMinutes), "days spent on movies"],
      ]),
    )
    el.similarStats.hidden = false
  }

  function statLi(icon, entries) {
    const li = document.createElement("li")
    li.append(`${icon} `)
    entries.forEach(([value, tooltip], i) => {
      if (i > 0) li.append(" · ")
      const span = document.createElement("span")
      span.title = tooltip
      span.textContent = typeof value === "number" ? value.toLocaleString() : value
      li.append(span)
    })
    return li
  }

  function resolveSimilarMinRating(items) {
    const saved = readStorage(STORAGE.similarMinRating)
    if (saved) return Number.parseInt(saved, 10) || 0
    const sevenPlus = items.filter((i) => (i.user_rating || 0) >= 7).length
    const minRating = sevenPlus < 10 ? 0 : 7
    el.similarRatingTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", Number.parseInt(t.dataset.minRating, 10) === minRating))
    return minRating
  }

  function formatDays(minutes) {
    if (minutes <= 0) return "~0d"
    const days = minutes / 1440
    if (days < 10) return `~${(Math.round(days * 2) / 2).toLocaleString()}d`
    return `~${Math.round(days).toLocaleString()}d`
  }

  function openAiSettings() {
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq"
    syncAiKeyLink()
    el.aiSettings.showModal()
  }

  const AI_KEY_STORAGE = { gemini: STORAGE.aiKeyGemini, openai: STORAGE.aiKeyOpenai, claude: STORAGE.aiKeyClaude, grok: STORAGE.aiKeyGrok, groq: STORAGE.aiKeyGroq, deepseek: STORAGE.aiKeyDeepseek, openrouter: STORAGE.aiKeyOpenrouter }

  function getAiKey(provider) { return readStorage(AI_KEY_STORAGE[provider] || STORAGE.aiKeyGroq); }

  function syncAiKeyLink() {
    const opt = el.aiProviderSelect.selectedOptions[0]
    el.aiKeyLink.href = opt.dataset.url
    el.aiKeyInput.value = getAiKey(el.aiProviderSelect.value)
    el.aiProviderUsername.value = el.aiProviderSelect.value
    syncAiSaveLabel()
  }

  function syncAiSaveLabel() {
    const name = el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "")
    el.aiSaveBtn.textContent = `Save ${name} key`
  }

  // ── Recommendation Flow ──

  async function gatherLibrary() {
    const u = mediaRepository()
    const [ws, wls, wlm, cs, cm] = await Promise.all([
      u.getWatchingShows(), u.getWatchlistShows(), u.getWatchlistMovies(),
      u.getCompletedShows(), u.getCompletedMovies(),
    ])
    return {
      shows: [...ws.items, ...wls.items, ...cs.items],
      movies: [...wlm.items, ...cm.items],
    }
  }

  async function getRecommendations(mood) {
    const library = await gatherLibrary()
    const provider = readStorage(STORAGE.aiProvider) || "groq"
    return await fetchAiSuggestions({ provider, key: getAiKey(provider), library, mood })
  }

  async function getSimilar(seed) {
    const library = await gatherLibrary()
    const provider = readStorage(STORAGE.aiProvider) || "groq"
    const suggestions = await fetchSimilarSuggestions({ provider, key: getAiKey(provider), library, seed })
    return suggestions.filter((s) => !(s.title === seed.title && s.year === seed.year))
  }

  // ── AI Result Rendering ──


  function asSeriesPoster(item) {
    return { ...item, nextEpisode: null, episodeUrl: "", episodeTitle: "" }
  }

  function renderPosterCard(row, item, { fade = false } = {}) {
    const { frag, card } = makeRowItem()
    card.item = item
    card.loggedIn = isLoggedIn()
    card.fade = fade
    card.addEventListener("poster:mark-watched", () => markWatched(card.item, card.cardEl))
    card.addEventListener("poster:add-watchlist", () => addToWatchlist(card))
    card.addEventListener("poster:more-like-this", () => openSimilar(card.item))
    row.appendChild(frag)
    return card
  }

  const dialogStack = []

  function openMood(mood) {
    pushDialog({
      title: mood.label,
      emptyMsg: "No suggestions. Try another mood.",
      fetch: () => getRecommendations(mood),
    })
  }

  function openSimilar(seed) {
    pushDialog({
      title: buildSimilarTitle(seed),
      emptyMsg: "No similar picks. Try another.",
      fetch: () => getSimilar(seed),
    })
  }

  function buildSimilarTitle(seed) {
    const frag = document.createDocumentFragment()
    const em = document.createElement("em")
    em.textContent = `${seed.title}${seed.year ? ` (${seed.year})` : ""}`
    frag.append("More like ", em)
    return frag
  }

  function pushDialog(entry) {
    if (!getAiKey(readStorage(STORAGE.aiProvider) || "groq")) {
      openAiSettings()
      return
    }
    dialogStack.push(entry)
    if (!el.aiDialog.open) el.aiDialog.showModal()
    renderDialogTop()
  }

  function backDialog() {
    dialogStack.pop()
    if (!dialogStack.length) return closeDialog()
    renderDialogTop()
  }

  function closeDialog() {
    dialogStack.length = 0
    if (el.aiDialog.open) el.aiDialog.close()
  }

  async function renderDialogTop() {
    const entry = dialogStack.at(-1)
    el.aiDialogTitle.replaceChildren(typeof entry.title === "string" ? entry.title : entry.title.cloneNode(true))
    el.aiDialogBack.hidden = dialogStack.length <= 1
    fillPosterSkeletons(el.aiDialogResults)
    try {
      const suggestions = await entry.fetch()
      if (dialogStack.at(-1) !== entry) return
      if (!suggestions.length) {
        setEmpty(el.aiDialogResults, entry.emptyMsg)
        return
      }
      el.aiDialogResults.replaceChildren()
      suggestions.forEach((s) => {
        renderPosterCard(el.aiDialogResults, asSeriesPoster(mergeWithLibrary({ title: s.title, year: s.year, ids: {}, type: "movie" }, libraryIndex)), { fade: true })
      })
      observeAiLazyHydration(el.aiDialogResults)
    } catch (err) {
      closeDialog()
      if (err?.message === "AI quota exceeded.") {
        const link = Object.assign(document.createElement("a"), { href: "#", textContent: "set another API key" })
        link.style.color = "inherit"; link.style.textDecoration = "underline"
        link.addEventListener("click", (e) => { e.preventDefault(); openAiSettings() })
        const frag = document.createDocumentFragment()
        frag.append("AI quota exceeded. Please try again later or ", link, ".")
        showToast(frag, true)
        return
      }
      handleError(err)
    }
  }

  function observeAiLazyHydration(row) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        hydrateAiCard(entry.target)
      }
    }, { root: row, rootMargin: "400px" })
    row.querySelectorAll("poster-card").forEach((c) => observer.observe(c))
  }

  async function hydrateAiCard(card) {
    const { title, year } = card.item
    const resolved = await mediaRepository().searchByTitle(title, year)
    if (!resolved) {
      card.item = { ...card.item, url: mediaRepository().getSearchUrl(title) }
      card.refresh()
      return
    }
    if (resolved.release_status === "unreleased") {
      card.closest(".row-item")?.remove()
      return
    }
    card.item = asSeriesPoster(mergeWithLibrary(resolved, libraryIndex))
    card.refresh()
  }

  el.aiDialogClose.addEventListener("click", () => closeDialog())
  el.aiDialogBack.addEventListener("click", () => backDialog())
  el.aiDialog.addEventListener("close", () => { dialogStack.length = 0 })

  ;[el.aiDialog, el.aiSettings].forEach((d) => {
    d.addEventListener("click", (e) => { if (e.target === d) d.close() })
  })

  el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => { if (b.dataset.gloss) b.title = b.dataset.gloss })

  el.aiPrompts.addEventListener("click", (e) => {
    const btn = e.target.closest(".ai-prompt-btn")
    if (!btn) return
    if (!isLoggedIn()) {
      showToast("Sign in to get personalized picks.")
      return
    }
    const icon = btn.querySelector(".ai-prompt-icon")?.textContent ?? ""
    const label = btn.querySelector(".ai-prompt-label")?.textContent ?? ""
    openMood({ label: `${icon} ${label}`.trim(), gloss: btn.dataset.gloss || "" })
  })

  // ── Navigation ──

  function showView(name) {
    currentView = name
    const views = {
      homepage: { view: el.homepageView, nav: null, hydrate: () => {} },
      next: { view: el.nextView, nav: el.navNext, hydrate: hydrateNextView },
      trending: { view: el.trendingView, nav: el.navTrending, hydrate: hydrateTrendingView },
      similar: { view: el.similarView, nav: el.navSimilar, hydrate: hydrateSimilarView },
      mood: { view: el.aiView, nav: el.navAi, hydrate: hydrateAiView },
    }
    for (const [key, { view, nav }] of Object.entries(views)) {
      view.hidden = key !== name
      if (nav) nav.classList.toggle("active-nav", key === name)
    }
    views[name].hydrate()
    const hash = name === "homepage" ? "" : `#${name}`
    if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname)
  }

  // ── OAuth ──

  async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search)
    const code = params.get("code")
    const error = params.get("error")
    if (!code && !error) return
    history.replaceState(null, "", `${location.pathname}${location.hash || ""}`)
    el.spinner.hidden = false
    try {
      const provider = sessionStorage.getItem("next-watch-oauth-provider") || "simkl"
      const userData = provider === "trakt" ? traktRepository : simklRepository
      if (error) {
        if (error !== "access_denied") console.error(`${userData.name} OAuth error: ${error}`)
        const message = error === "access_denied"
          ? `${userData.name} sign-in was cancelled.`
          : `Couldn't finish signing in to ${userData.name}.`
        showRetrySignInToast(userData, message)
        showView("next")
        return
      }
      const expected = sessionStorage.getItem("next-watch-oauth-state")
      const state = params.get("state") || ""
      if (expected && state && expected !== state) throw Object.assign(new Error("State mismatch."), { user: true })
      const token = await userData.exchangeOAuthCode(code)
      writeStorage(STORAGE.accessToken, token.access_token)
      writeStorage(STORAGE.provider, provider)
      sessionStorage.removeItem("next-watch-oauth-state")
      sessionStorage.removeItem("next-watch-oauth-provider")
      hydrateUI()
      showView("next")
      showToast(`Connected to ${userData.name}.`)
      await loadSuggestions()
    } catch (err) {
      sessionStorage.removeItem("next-watch-oauth-state")
      sessionStorage.removeItem("next-watch-oauth-provider")
      handleError(err)
      showView("next")
    } finally {
      el.spinner.hidden = true
    }
  }

  function logout() {
    clearAllStorage()
    location.href = location.pathname
  }

  // ── UI hydration ──

  function hydrateNextView() {
    const loggedIn = isLoggedIn()
    el.nextSetup.hidden = loggedIn
    el.nextContent.hidden = !loggedIn
  }

  function hydrateUI() {
    const loggedIn = isLoggedIn()
    el.topBar.hidden = false
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq"
    el.aiKeyInput.value = getAiKey(el.aiProviderSelect.value)
    el.navHome.hidden = loggedIn
    el.logoutBtn.hidden = !loggedIn
    el.coffeeLink.hidden = !loggedIn
    el.aiKeyBtn.hidden = !loggedIn
    el.attribution.hidden = !loggedIn
    if (loggedIn) {
      const repo = mediaRepository()
      el.attributionProviderLink.textContent = repo.name
      el.attributionProviderLink.href = repo.siteUrl
    }
    hydrateNextView()
    syncViewportMetrics()
  }

  // ── Wire events ──

  el.aiSettingsForm.addEventListener("submit", (e) => {
    e.preventDefault()
    const provider = el.aiProviderSelect.value
    const aiKey = el.aiKeyInput.value.trim()
    writeStorage(STORAGE.aiProvider, provider)
    writeStorage(AI_KEY_STORAGE[provider], aiKey)
    syncAiSaveLabel()
    el.aiSettings.close()
    showToast(`${el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "")} key saved.`)
  })
  el.aiKeyBtn.addEventListener("click", openAiSettings)
  el.aiSettingsClose.addEventListener("click", () => el.aiSettings.close())
  el.logoutBtn.addEventListener("click", logout)
  for (const container of document.querySelectorAll("[data-signin-ctas]")) {
    container.appendChild(tpl("tpl-signin-ctas"))
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-provider]")
      if (btn?.dataset.provider === "simkl") simklRepository.startOAuth()
      if (btn?.dataset.provider === "trakt") traktRepository.startOAuth()
    })
  }
  el.navHome.addEventListener("click", (e) => { e.preventDefault(); showView("homepage"); })
  el.navNext.addEventListener("click", (e) => { e.preventDefault(); showView("next"); })
  el.navTrending.addEventListener("click", (e) => { e.preventDefault(); showView("trending"); })
  el.navSimilar.addEventListener("click", (e) => { e.preventDefault(); showView("similar"); })
  el.navAi.addEventListener("click", (e) => { e.preventDefault(); showView("mood"); })
  el.similarReload.addEventListener("click", () => renderSimilar())
  el.similarRatingTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".range-tab")
    if (!tab) return
    el.similarRatingTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.remove("active"))
    tab.classList.add("active")
    writeStorage(STORAGE.similarMinRating, tab.dataset.minRating)
    renderSimilar()
  })
  el.aiProviderSelect.addEventListener("change", () => { syncAiKeyLink(); syncAiSaveLabel(); })
  el.trendingPeriodTabs.addEventListener("click", (e) => {
    const tab = e.target.closest(".range-tab")
    if (!tab) return
    el.trendingPeriodTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.remove("active"))
    tab.classList.add("active")
    loadTrending()
  })

  syncViewportMetrics()
  window.addEventListener("resize", syncViewportMetrics, { passive: true })
  window.visualViewport?.addEventListener("resize", syncViewportMetrics, { passive: true })
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && isLoggedIn()) loadSuggestions(); })

  let deferredInstallPrompt = null
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
    if (isLoggedIn() && !window.matchMedia("(display-mode: standalone)").matches) el.installBtn.classList.remove("hidden")
  })
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null
    el.installBtn.classList.add("hidden")
  })
  el.installBtn.addEventListener("click", () => { if (deferredInstallPrompt) deferredInstallPrompt.prompt(); })
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {})

  // ── Boot ──

  if (readStorage(STORAGE.accessToken) && !readStorage(STORAGE.provider)) {
    clearAllStorage()
  }
  hydrateUI()
  const savedPeriod = readStorage(STORAGE.trendingPeriod)
  if (savedPeriod) {
    el.trendingPeriodTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", t.dataset.period === savedPeriod))
  }
  const savedMinRating = readStorage(STORAGE.similarMinRating)
  if (savedMinRating) {
    el.similarRatingTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", t.dataset.minRating === savedMinRating))
  }
  handleOAuthCallback()
  const hash = location.hash.replace("#", "").split("/")[0]
  showView(["next", "trending", "similar", "mood"].includes(hash) ? hash : isLoggedIn() ? "next" : "homepage")
  if (isLoggedIn()) loadSuggestions()
  else resolveLibraryReady()
})()
