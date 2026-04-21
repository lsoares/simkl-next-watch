import { simklCatalog } from "./simklCatalog.js"
import { simklUserData } from "./simklUserData.js"
import { traktUserData } from "./traktUserData.js"
import { fetchAiSuggestions } from "./aiProvider.js"
import { isUnstarted, availableEpisodesLeft } from "./posterCard.js"

function currentUserData() {
  return localStorage.getItem("next-watch-provider") === "trakt" ? traktUserData : simklUserData
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
  return [item?.id, ids.simkl_id, ids.simkl, ids.imdb, ids.trakt, ids.tmdb]
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
  return [ids.simkl_id, ids.simkl, ids.imdb, ids.tmdb]
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
  const el = {
    topBar: $("topBar"), navNext: $("navNext"), navTrending: $("navTrending"), navAi: $("navAi"),
    nextSetup: $("nextSetup"), nextContent: $("nextContent"),
    logoutBtn: $("logoutBtn"), getStartedBtn: $("getStartedBtn"), getStartedTraktBtn: $("getStartedTraktBtn"), aiSaveBtn: $("aiSaveBtn"),
    nextView: $("nextView"), tvRow: $("tvRow"), movieRow: $("movieRow"),
    trendingView: $("trendingView"), trendingPeriodTabs: $("trendingPeriodTabs"),
    hideTrendingWatched: $("hideTrendingWatched"),
    trendingTvContent: $("trendingTvContent"), trendingMoviesContent: $("trendingMoviesContent"),
    aiView: $("aiView"), aiSettings: $("aiSettings"), aiSettingsForm: $("aiSettingsForm"), aiProviderUsername: $("aiProviderUsername"), aiSettingsClose: $("aiSettingsClose"),
    aiKeyBtn: $("aiKeyBtn"), aiToggleTv: $("aiToggleTv"), aiToggleMovie: $("aiToggleMovie"),
    aiProviderSelect: $("aiProviderSelect"), aiKeyInput: $("aiKeyInput"), aiKeyLink: $("aiKeyLink"),
    aiPrompts: $("aiPrompts"), aiResults: $("aiResults"), aiNoRatingsNotice: $("aiNoRatingsNotice"),
    spinner: $("loadingSpinner"), toast: $("toast"), installBtn: $("installButton"),
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
    window.posthog?.captureException?.(err)
    showToast(err?.message || String(err), true)
  }

  // ── Viewport ──

  function syncViewportMetrics() {
    const h = window.visualViewport?.height || window.innerHeight
    document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`)
    if (el.topBar) document.documentElement.style.setProperty("--top-bar-height", `${Math.ceil(el.topBar.getBoundingClientRect().height)}px`)
  }

  // ── Render rows ──

  function renderRow(rowEl, items, type) {
    const scrollKey = `next-watch-scroll:${rowEl.id}`
    rowEl.replaceChildren()
    items.forEach((item) => {
      const { frag, card } = makeRowItem()
      card.variant = "next"
      card.type = type
      card.item = item
      card.watching = item.status === "watching"
      card.episodeUrlFn = currentUserData().episodeUrl
      card.addEventListener("poster:mark-watched", () => markWatched(item, type, card.cardEl))
      rowEl.appendChild(frag)
    })
    const browseUrl = currentUserData().browseUrl?.(type)
    if (browseUrl) {
      const tile = document.createElement("div")
      tile.className = "row-item row-item--add-more"
      const addLabel = type === "tv" ? "Add series" : "Add movie"
      tile.innerHTML = `<a class="add-more-card" href="${browseUrl}" target="_blank" rel="noreferrer" aria-label="${addLabel}"><span class="add-more-plus" aria-hidden="true">+</span><span class="add-more-label">${addLabel}</span></a>`
      rowEl.appendChild(tile)
    }
    initDockEffect(rowEl)
    if (rowEl._scrollSave) rowEl.removeEventListener("scroll", rowEl._scrollSave)
    rowEl._scrollSave = () => { sessionStorage.setItem(scrollKey, rowEl.scrollLeft); }
    rowEl.addEventListener("scroll", rowEl._scrollSave, { passive: true })
    rowEl.scrollLeft = +(sessionStorage.getItem(scrollKey) || 0)
    annotateTrendingBadges(rowEl, items, (item) => isUnstarted(item, type))
    observeLazyHydration(rowEl)
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
      await currentUserData().markWatched(item)
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
    const url = ep ? (currentUserData().episodeUrl?.(item, ep) || base) : base
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
      return simklCatalog.getEpisodeTitle(item.id, ep.season, ep.episode)
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
      const u = currentUserData()
      const [ws, wls, wlm, cs, cm] = await Promise.all([
        u.getWatchingShows(), u.getWatchlistShows(), u.getWatchlistMovies(),
        u.getCompletedShows(), u.getCompletedMovies(),
      ])
      const allShows = [...ws.items, ...wls.items, ...cs.items]
      const allMovies = [...wlm.items, ...cm.items]
      const data = { shows: allShows, movies: allMovies, fresh: ws.fresh || wls.fresh || wlm.fresh || cs.fresh || cm.fresh }
      tvItems = [...[...ws.items].sort(byWatchingPriority), ...[...wls.items].sort(byAddedDate)]
        .filter((i) => i.release_status !== "unreleased")
      movieItems = [...wlm.items].sort(byAddedDate).filter((i) => i.release_status !== "unreleased")
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

  function renderDiscoveryRow(containerEl, items, type) {
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
      containerEl.appendChild(frag)
    })
  }

  async function addToWatchlist(card) {
    const item = card.item
    const keys = itemLookupKeys(item)
    const btn = card.cardEl?.querySelector(".add-watchlist-btn")
    if (!keys.length || !btn) return
    btn.disabled = true
    try {
      await currentUserData().addToWatchlist(item)
      const entry = { watched: false, watchedAt: null }
      for (const key of keys) libraryIndex.set(key, entry)
      card.inWatchlist = true
      card._rendered = false
      card._render()
      showToast(`Added "${item.title}" to watchlist.`)
      await loadSuggestions()
    } catch (err) {
      btn.disabled = false
      handleError(err)
    }
  }

  function injectPoster(card, item) {
    const cardEl = card.cardEl
    if (!cardEl || !item.posterUrl) return
    const img = document.createElement("img")
    img.className = "poster"
    img.src = item.posterUrl
    img.alt = ""
    img.draggable = false
    img.loading = "lazy"
    const placeholder = cardEl.querySelector(".poster-anchor .poster--placeholder")
    if (placeholder) { placeholder.replaceWith(img); return }
    if (cardEl.querySelector(".poster-anchor")) return
    const anchor = document.createElement("a")
    anchor.className = "poster-anchor"
    anchor.href = item.url || "#"
    anchor.target = "_blank"
    anchor.rel = "noreferrer"
    anchor.appendChild(img)
    cardEl.insertBefore(anchor, cardEl.firstChild)
  }

  let lazyObserver = null
  function observeLazyHydration(rowEl) {
    if (!lazyObserver) {
      lazyObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          lazyObserver.unobserve(entry.target)
          hydrateLazy(entry.target)
        }
      }, { rootMargin: "200px" })
    }
    rowEl.querySelectorAll("poster-card").forEach((c) => {
      if (needsLazyHydration(c.item)) lazyObserver.observe(c)
    })
  }

  function needsLazyHydration(item) {
    if (!item) return false
    if (item.ids?.imdb && !item.posterUrl) return true
    if (currentUserData().getProgress && item.type === "tv" && item.status === "watching" && (item.ids?.slug || item.ids?.trakt)) return true
    return false
  }

  async function hydrateLazy(card) {
    const item = card.item
    if (!item) return
    if (item.ids?.imdb && !item.posterUrl) await hydratePoster(card)
    const getProgress = currentUserData().getProgress
    if (getProgress && item.type === "tv" && item.status === "watching" && (item.ids?.slug || item.ids?.trakt)) {
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
  }

  async function hydratePoster(card) {
    const item = card.item
    if (!item?.ids?.imdb) return
    const hit = await simklCatalog.lookupByImdb(item.ids.imdb)
    if (!hit?.poster) return
    item.ids = { ...item.ids, simkl: hit.simklId }
    if (!item.id) item.id = String(hit.simklId || "")
    item.poster = hit.poster
    item.posterUrl = `https://wsrv.nl/?url=https://simkl.in/posters/${hit.poster}_c.webp`
    injectPoster(card, item)
  }

  let trendingBadgeSetsPromise = null
  function loadTrendingBadgeSets() {
    if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise
    const periods = ["today", "week", "month"]
    trendingBadgeSetsPromise = Promise.all(periods.map((p) => simklCatalog.getTrending(p)))
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

  async function loadTrending() {
    const period = el.trendingPeriodTabs.querySelector(".range-tab.active")?.dataset.period || "today"
    writeStorage(STORAGE.trendingPeriod, period)
    el.trendingTvContent.replaceChildren(tpl("tpl-spinner"))
    el.trendingMoviesContent.replaceChildren(tpl("tpl-spinner"))
    try {
      const [{ tv: tvData, movies: movieData }] = await Promise.all([simklCatalog.getTrending(period), libraryReady])
      const hideWatched = el.hideTrendingWatched.checked
      const filterFn = (item) => item.release_status !== "unreleased"
        && (!hideWatched || !libraryLookup(libraryIndex, item))
      const tv = tvData.filter(filterFn).slice(0, 12)
      const movies = movieData.filter(filterFn).slice(0, 12)
      if (tv.length) renderDiscoveryRow(el.trendingTvContent, tv, "tv")
      else setEmpty(el.trendingTvContent, "No results.")
      if (movies.length) renderDiscoveryRow(el.trendingMoviesContent, movies, "movie")
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
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "groq"
    syncAiKeyLink()
    el.aiKeyBtn.hidden = !getAiKey(el.aiProviderSelect.value)
    libraryReady.then(() => {
      const hasRated = [...libraryIndex.values()].some((e) => e.userRating != null)
      el.aiNoRatingsNotice.hidden = hasRated
    })
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

  async function resolveSimkl(suggestions, mediaType) {
    const results = await Promise.all(
      suggestions.map((s) => simklCatalog.searchByTitle(s.title, s.year, mediaType))
    )
    return results.filter(Boolean)
  }

  function getAiMediaType() {
    const tv = el.aiToggleTv.classList.contains("active")
    const movie = el.aiToggleMovie.classList.contains("active")
    if (tv && movie) return "both"
    if (tv) return "tv"
    if (movie) return "movie"
    return "both"
  }

  async function getRecommendations(mood) {
    const mediaType = getAiMediaType()
    const u = currentUserData()
    const [ws, wls, wlm, cs, cm] = await Promise.all([
      u.getWatchingShows(), u.getWatchlistShows(), u.getWatchlistMovies(),
      u.getCompletedShows(), u.getCompletedMovies(),
    ])
    const provider = readStorage(STORAGE.aiProvider) || "groq"
    const suggestions = await fetchAiSuggestions({
      provider,
      key: getAiKey(provider),
      mediaType,
      library: {
        shows: [...ws.items, ...wls.items, ...cs.items],
        movies: [...wlm.items, ...cm.items],
      },
      mood,
    })
    if (!suggestions.length) return []
    const resolved = await resolveSimkl(suggestions, mediaType)
    const getType = (item) => item.type === "movie" ? "movie" : "tv"
    return resolved
      .filter((i) => i.release_status !== "unreleased")
      .sort((a, b) => {
        const ea = libraryLookup(libraryIndex, a)
        const eb = libraryLookup(libraryIndex, b)
        const aw = ea?.watched ? 1 : 0
        const bw = eb?.watched ? 1 : 0
        if (aw !== bw) return aw - bw
        if (aw) return new Date(ea?.watchedAt || 0) - new Date(eb?.watchedAt || 0)
        return (b.rating || 0) - (a.rating || 0)
      })
  }

  // ── AI Result Rendering ──

  function renderAiResults(items) {
    if (!items.length) {
      setEmpty(el.aiResults, "No suggestions. Try another mood.")
      return
    }
    const typed = items.map((item) => ({ item, type: item.type === "movie" ? "movie" : "tv" }))
    el.aiResults.replaceChildren()
    typed.forEach(({ item, type }) => {
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
      el.aiResults.appendChild(frag)
    })
    annotateTrendingBadges(el.aiResults, typed.map(({ item }) => item), (item) => !libraryLookup(libraryIndex, item))
  }

  el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => { if (b.dataset.gloss) b.title = b.dataset.gloss })

  el.aiPrompts.addEventListener("click", async (e) => {
    const btn = e.target.closest(".ai-prompt-btn")
    if (!btn) return
    if (!getAiKey(readStorage(STORAGE.aiProvider) || "groq")) {
      openAiSettings()
      return
    }
    el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => b.classList.remove("active"))
    btn.classList.add("active")
    el.aiResults.replaceChildren(tpl("tpl-spinner"))
    try {
      const items = await getRecommendations({ label: btn.textContent, gloss: btn.dataset.gloss || "" })
      renderAiResults(items)
    } catch (err) {
      el.aiResults.replaceChildren()
      handleError(err)
    }
  })

  ;[el.aiToggleTv, el.aiToggleMovie].forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation()
      const other = btn === el.aiToggleTv ? el.aiToggleMovie : el.aiToggleTv
      if (btn.classList.contains("active") && !other.classList.contains("active")) return
      btn.classList.toggle("active")
      writeStorage(STORAGE.aiMediaType, getAiMediaType())
      el.aiResults.replaceChildren()
      el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => b.classList.remove("active"))
    })
  })

  // ── Navigation ──

  function showView(name) {
    currentView = name
    el.nextView.hidden = name !== "next"
    el.trendingView.hidden = name !== "trending"
    el.aiView.hidden = name !== "ai"
    ;[el.navNext, el.navTrending, el.navAi].forEach((btn) => btn.classList.remove("active-nav"))
    if (name === "next") el.navNext.classList.add("active-nav")
    if (name === "trending") el.navTrending.classList.add("active-nav")
    if (name === "ai") el.navAi.classList.add("active-nav")
    if (name === "trending") loadTrending()
    if (name === "ai") hydrateAiView()
    if (name === "next") hydrateNextView()
    const hash = name === "next" ? "" : `#${name}`
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
      if (error) throw new Error(error)
      const expected = sessionStorage.getItem("next-watch-oauth-state")
      const state = params.get("state") || ""
      if (expected && state && expected !== state) throw new Error("State mismatch.")
      const provider = sessionStorage.getItem("next-watch-oauth-provider") || "simkl"
      const userData = provider === "trakt" ? traktUserData : simklUserData
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
    location.reload()
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
    el.logoutBtn.hidden = !loggedIn
    if (loggedIn) el.logoutBtn.title = `Logout from ${currentUserData().name}`
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
    el.aiKeyBtn.hidden = false
    el.aiSettings.close()
    showToast(`${el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "")} key saved.`)
  })
  el.aiKeyBtn.addEventListener("click", openAiSettings)
  el.aiSettingsClose.addEventListener("click", () => el.aiSettings.close())
  el.logoutBtn.addEventListener("click", logout)
  el.getStartedBtn.addEventListener("click", () => simklUserData.startOAuth())
  el.getStartedTraktBtn.addEventListener("click", () => traktUserData.startOAuth())
  el.getStartedTraktBtn.hidden = false
  el.navNext.addEventListener("click", (e) => { e.preventDefault(); showView("next"); })
  el.navTrending.addEventListener("click", (e) => { e.preventDefault(); showView("trending"); })
  el.navAi.addEventListener("click", (e) => { e.preventDefault(); showView("ai"); })
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

  // PWA install
  let deferredInstallPrompt = null
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstallPrompt = e; el.installBtn.classList.remove("hidden"); })
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
  if (isLoggedIn()) {
    showView(hash === "trending" ? "trending" : hash === "ai" ? "ai" : "next")
    loadSuggestions()
  } else {
    resolveLibraryReady()
    showView(hash === "trending" ? "trending" : "next")
  }
})()
