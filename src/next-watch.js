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
    const entry = {
      watched: item.status === "completed",
      watchedAt: item.status === "completed" ? (item.last_watched_at || null) : null,
      watching: item.status === "watching",
      userRating: item.user_rating ?? null,
    }
    for (const key of itemLookupKeys(item)) index.set(key, entry)
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
    const entry = libraryIndex.get(key)
    if (entry) return entry
  }
  return null
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
  hideWatched: "next-watch-hide-watched",
  aiProvider: "next-watch-ai-provider",
  aiKeyGemini: "next-watch-ai-key-gemini",
  aiKeyOpenai: "next-watch-ai-key-openai",
  aiKeyClaude: "next-watch-ai-key-claude",
  aiKeyGrok: "next-watch-ai-key-grok",
  aiKeyGroq: "next-watch-ai-key-groq",
  aiKeyDeepseek: "next-watch-ai-key-deepseek",
  aiKeyOpenrouter: "next-watch-ai-key-openrouter",
  aiMediaType: "next-watch-ai-media-type",
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
    hideTrendingWatched: $("hideTrendingWatched"),
    trendingTvContent: $("trendingTvContent"), trendingMoviesContent: $("trendingMoviesContent"),
    aiView: $("aiView"), aiSetup: $("aiSetup"), aiContent: $("aiContent"), aiToolbar: $("aiToolbar"),
    aiSettings: $("aiSettings"), aiSettingsForm: $("aiSettingsForm"), aiProviderUsername: $("aiProviderUsername"), aiSettingsClose: $("aiSettingsClose"),
    aiKeyBtn: $("aiKeyBtn"), aiToggleTv: $("aiToggleTv"), aiToggleMovie: $("aiToggleMovie"),
    aiProviderSelect: $("aiProviderSelect"), aiKeyInput: $("aiKeyInput"), aiKeyLink: $("aiKeyLink"),
    aiPrompts: $("aiPrompts"), aiNoRatingsNotice: $("aiNoRatingsNotice"),
    aiDialog: $("aiDialog"), aiDialogTitle: $("aiDialogTitle"), aiDialogBack: $("aiDialogBack"),
    aiDialogClose: $("aiDialogClose"), aiDialogResults: $("aiDialogResults"),
    aiFavorites: $("aiFavorites"), aiFavoritesRow: $("aiFavoritesRow"),
    spinner: $("loadingSpinner"), toast: $("toast"), installBtn: $("installButton"),
  }

  let currentView = null
  let toastTimer = null
  let libraryIndex = new Map()
  let resolveLibraryReady
  let libraryReady = new Promise((r) => { resolveLibraryReady = r; })
  let tvItems = []
  let movieItems = []
  const movieOrder = new Map()
  const orderOf = (item) => {
    const keys = itemLookupKeys(item)
    for (const k of keys) if (movieOrder.has(k)) return movieOrder.get(k)
    const o = Math.random()
    for (const k of keys) movieOrder.set(k, o)
    return o
  }

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
    window.posthog?.captureException?.(err)
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
  }

  // ── Render rows ──

  function renderRow(rowEl, items, type) {
    rowEl.replaceChildren()
    items.forEach((item) => {
      const { frag, card } = makeRowItem()
      card.variant = "next"
      card.type = type
      card.item = item
      card.watching = item.status === "watching"
      card.episodeUrlFn = mediaRepository().episodeUrl
      card.addEventListener("poster:mark-watched", () => markWatched(item, type, card.cardEl))
      rowEl.appendChild(frag)
    })
    appendAddMoreTile(rowEl, { href: mediaRepository().browseUrl(type), icon: "+", label: type === "tv" ? "Add series" : "Add movie" })
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

  async function markWatched(item, type, card) {
    if (card) card.classList.add("marking-watched")
    const snapshot = { ...item }
    try {
      await mediaRepository().markWatched(item)
      showToast(toastFrag("Marked ", snapshot, type, " watched — rate it?"))
      await waitForWatchedAnimation(card)
      await loadSuggestions()
    } catch (err) {
      if (card) card.classList.remove("marking-watched")
      handleError(err)
    }
  }

  function toastFrag(prefix, item, type, suffix) {
    const ep = type === "tv" ? item.nextEpisode : null
    const base = item.url || ""
    const url = ep ? (mediaRepository().episodeUrl?.(item, ep) || base) : base
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
      movieItems = wlm.items.filter((i) => i.release_status !== "unreleased").sort((a, b) => orderOf(a) - orderOf(b))
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
    const loggedIn = isLoggedIn()
    containerEl.replaceChildren()
    items.forEach((item) => {
      const { frag, card } = makeRowItem()
      card.variant = "discovery"
      card.type = type
      card.item = item
      const entry = libraryLookup(libraryIndex, item)
      card.watched = !!entry?.watched
      card.watchedAt = entry?.watchedAt || null
      card.userRating = entry?.userRating ?? null
      card.inWatchlist = !!entry && !entry.watched
      card.watching = !!entry?.watching
      card.loggedIn = loggedIn
      card.addEventListener("poster:add-watchlist", () => addToWatchlist(card))
      card.addEventListener("poster:more-like-this", () => openSimilar({ ...item, type }))
      containerEl.appendChild(frag)
    })
    const u = mediaRepository()
    appendAddMoreTile(containerEl, { href: u.trendingBrowseUrl(type, browseParams), icon: "→", label: type === "tv" ? "View all series" : "View all movies" })
  }

  async function addToWatchlist(card) {
    const item = card.item
    const keys = itemLookupKeys(item)
    const btn = card.cardEl?.querySelector(".add-watchlist-btn")
    if (!keys.length || !btn) return
    btn.disabled = true
    try {
      await mediaRepository().addToWatchlist(item)
      const entry = { watched: false, watchedAt: null }
      for (const key of keys) libraryIndex.set(key, entry)
      card.inWatchlist = true
      card._rendered = false
      card._render()
      showToast(toastFrag("Added ", item, card.type, " to watchlist."))
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
      if (progress.title) item.episodeTitle = progress.title
      card._rendered = false
      card._render()
    }
  }

  let trendingBadgeSetsPromise = null
  function loadTrendingBadgeSets() {
    if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise
    const periods = ["today", "week", "month"]
    trendingBadgeSetsPromise = Promise.all(periods.map((p) => mediaRepository().getTrending(p)))
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
      if (isEligible && !isEligible(item)) return
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
      const hideWatched = el.hideTrendingWatched.checked
      const filterFn = (item) => item.release_status !== "unreleased"
        && (!hideWatched || !libraryLookup(libraryIndex, item))
      const tv = tvData.filter(filterFn).slice(0, 12)
      const movies = movieData.filter(filterFn).slice(0, 12)
      const browseParams = { period, ignoreWatched: hideWatched }
      if (tv.length) renderDiscoveryRow(el.trendingTvContent, tv, "tv", browseParams)
      else setEmpty(el.trendingTvContent, "No results.")
      if (movies.length) renderDiscoveryRow(el.trendingMoviesContent, movies, "movie", browseParams)
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
    libraryReady.then(() => {
      const hasRated = [...libraryIndex.values()].some((e) => e.userRating != null)
      el.aiNoRatingsNotice.hidden = hasRated
      renderFavorites()
    })
  }

  async function renderFavorites() {
    const { shows, movies } = await gatherLibrary()
    const pool = [
      ...shows.filter((s) => (s.user_rating || 0) >= 7).map((s) => ({ item: s, type: "tv" })),
      ...movies.filter((m) => (m.user_rating || 0) >= 7).map((m) => ({ item: m, type: "movie" })),
    ]
    const picks = pool
      .map((p) => [Math.random(), p])
      .sort((a, b) => a[0] - b[0])
      .slice(0, 10)
      .map(([, p]) => p)
    el.aiFavorites.hidden = picks.length === 0
    if (!picks.length) return
    el.aiFavoritesRow.replaceChildren()
    picks.forEach(({ item, type }) => {
      const card = renderDiscoveryCard(el.aiFavoritesRow, item, type)
      card.addEventListener("poster:more-like-this", () => openSimilar({ ...item, type }))
    })
    attachCatalogLinkResolver(el.aiFavoritesRow)
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

  function getAiMediaType() {
    const tv = el.aiToggleTv.classList.contains("active")
    const movie = el.aiToggleMovie.classList.contains("active")
    if (tv && movie) return "both"
    if (tv) return "tv"
    if (movie) return "movie"
    return "both"
  }

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
    return await fetchAiSuggestions({ provider, key: getAiKey(provider), mediaType: getAiMediaType(), library, mood })
  }

  async function getSimilar(seed) {
    const library = await gatherLibrary()
    const provider = readStorage(STORAGE.aiProvider) || "groq"
    const suggestions = await fetchSimilarSuggestions({ provider, key: getAiKey(provider), mediaType: getAiMediaType(), library, seed })
    return suggestions.filter((s) => !(s.title === seed.title && s.year === seed.year))
  }

  function attachCatalogLinkResolver(row) {
    row.addEventListener("click", async (e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = e.target.closest("a[href]")
      if (!anchor || !row.contains(anchor)) return
      const card = anchor.closest("poster-card")
      if (!card?.item) return
      const resolve = mediaRepository().catalogUrl
      if (!resolve) return
      e.preventDefault()
      const win = window.open("", "_blank")
      try {
        const target = await resolve(card.item, card.type)
        if (win) win.location.href = target || anchor.href
      } catch {
        if (win) win.location.href = anchor.href
      }
    })
  }


  // ── AI Result Rendering ──


  function renderDiscoveryCard(row, item, type) {
    const { frag, card } = makeRowItem()
    card.variant = "discovery"
    card.type = type
    card.item = item
    const entry = libraryLookup(libraryIndex, item)
    card.watched = !!entry?.watched
    card.watchedAt = entry?.watchedAt || null
    card.userRating = entry?.userRating ?? null
    card.inWatchlist = !!entry && !entry.watched
    card.watching = !!entry?.watching
    card.loggedIn = true
    card.addEventListener("poster:add-watchlist", () => addToWatchlist(card))
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
      const mediaType = getAiMediaType()
      const placeholderType = mediaType === "tv" ? "tv" : "movie"
      el.aiDialogResults.replaceChildren()
      suggestions.forEach((s) => {
        const item = { title: s.title, year: s.year, ids: {} }
        const card = renderDiscoveryCard(el.aiDialogResults, item, placeholderType)
        card.addEventListener("poster:more-like-this", () => openSimilar({ ...card.item, type: card.type }))
      })
      attachCatalogLinkResolver(el.aiDialogResults)
      observeAiLazyHydration(el.aiDialogResults, mediaType)
    } catch (err) {
      closeDialog()
      handleError(err)
    }
  }

  function observeAiLazyHydration(row, mediaType) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        observer.unobserve(entry.target)
        hydrateAiCard(entry.target, mediaType)
      }
    }, { root: row, rootMargin: "400px" })
    row.querySelectorAll("poster-card").forEach((c) => observer.observe(c))
  }

  async function hydrateAiCard(card, mediaType) {
    const { title, year } = card.item
    const resolved = await mediaRepository().searchByTitle(title, year, mediaType)
    if (!resolved) return
    if (resolved.release_status === "unreleased") {
      card.closest(".row-item")?.remove()
      return
    }
    const entry = libraryLookup(libraryIndex, resolved)
    card.item = resolved
    card.type = resolved.type
    card.watched = !!entry?.watched
    card.watchedAt = entry?.watchedAt || null
    card.userRating = entry?.userRating ?? null
    card.inWatchlist = !!entry && !entry.watched
    card.watching = !!entry?.watching
    card._rendered = false
    card._render()
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
    openMood({ label: btn.textContent, gloss: btn.dataset.gloss || "" })
  })

  ;[el.aiToggleTv, el.aiToggleMovie].forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const other = btn === el.aiToggleTv ? el.aiToggleMovie : el.aiToggleTv
      if (btn.classList.contains("active") && !other.classList.contains("active")) return
      btn.classList.toggle("active")
      writeStorage(STORAGE.aiMediaType, getAiMediaType())
    })
  })

  // ── Navigation ──

  function showView(name) {
    currentView = name
    const views = {
      homepage: { view: el.homepageView, nav: null, hydrate: () => {} },
      next: { view: el.nextView, nav: el.navNext, hydrate: hydrateNextView },
      trending: { view: el.trendingView, nav: el.navTrending, hydrate: hydrateTrendingView },
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
      if (expected && state && expected !== state) throw new Error("State mismatch.")
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
    el.hideTrendingWatched.closest("label").hidden = !loggedIn
    el.navHome.hidden = loggedIn
    el.logoutBtn.hidden = !loggedIn
    el.coffeeLink.hidden = !loggedIn
    el.aiKeyBtn.hidden = !loggedIn
    if (loggedIn) el.logoutBtn.title = `Logout from ${mediaRepository().name}`
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
  el.navAi.addEventListener("click", (e) => { e.preventDefault(); showView("mood"); })
  el.hideTrendingWatched.addEventListener("change", () => { writeStorage(STORAGE.hideWatched, el.hideTrendingWatched.checked); loadTrending(); })
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
  el.hideTrendingWatched.checked = readStorage(STORAGE.hideWatched) === "true"
  const savedMediaType = readStorage(STORAGE.aiMediaType)
  if (savedMediaType) {
    el.aiToggleTv.classList.toggle("active", savedMediaType === "both" || savedMediaType === "tv")
    el.aiToggleMovie.classList.toggle("active", savedMediaType === "both" || savedMediaType === "movie")
  }
  const savedPeriod = readStorage(STORAGE.trendingPeriod)
  if (savedPeriod) {
    el.trendingPeriodTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", t.dataset.period === savedPeriod))
  }
  handleOAuthCallback()
  const hash = location.hash.replace("#", "").split("/")[0]
  showView(["next", "trending", "mood"].includes(hash) ? hash : isLoggedIn() ? "next" : "homepage")
  if (isLoggedIn()) loadSuggestions()
  else resolveLibraryReady()
})()
