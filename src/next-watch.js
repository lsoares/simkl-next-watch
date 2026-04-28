import { clearAi, fetchAiSuggestions, fetchSimilarSuggestions } from "./aiProvider.js"
import { isUnstarted, availableEpisodesLeft, renderPoster, renderSkeletons, appendAddMore, asTVShowPoster } from "./posterCard.js"
import { simklRepository } from "./simklRepository.js"
import { traktRepository } from "./traktRepository.js"
import { tmdbRepository } from "./tmdbRepository.js"
import { idbGet, idbSet } from "./idbStore.js"

const repos = { simkl: simklRepository, trakt: traktRepository }

// ── Pure domain functions (no DOM, no storage, no fetch) ──

function byAiPickRelevance(a, b) {
  const aWatched = !!a.last_watched_at
  const bWatched = !!b.last_watched_at
  if (aWatched !== bWatched) return aWatched ? 1 : -1
  if (!aWatched) return (b.rating ?? 0) - (a.rating ?? 0)
  return a.last_watched_at - b.last_watched_at
}

function byWatchingPriority(a, b) {
  const aLeft = availableEpisodesLeft(a), bLeft = availableEpisodesLeft(b)
  if ((aLeft === 1) !== (bLeft === 1)) return aLeft === 1 ? -1 : 1
  if (aLeft === 1) return (a.runtime ?? Infinity) - (b.runtime ?? Infinity)
  return (b.last_watched_at ?? 0) - (a.last_watched_at ?? 0)
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

function trendingPeriodFor(candidateIds, sets) {
  if (!sets) return null
  const ids = candidateIds.filter(Boolean).map(String)
  if (!ids.length) return null
  for (const period of ["today", "week", "month"]) {
    if (ids.some((id) => sets[period].has(id))) return period
  }
  return null
}

// ── Storage ──

let repo
async function refreshLoggedIn() {
  repo = repos[(await idbGet("auth"))?.provider]
  if (repo) localStorage.setItem("next-watch-auth", "1")
}

// ── App (DOM + state + wiring) ──

(async function app() {
  const $ = (id) => document.getElementById(id)
  const tpl = (id) => $(id).content.cloneNode(true)
  const setEmpty = (container, msg, isError = false) => {
    const p = tpl("tpl-empty").firstElementChild
    p.textContent = msg
    if (isError) p.style.color = "#fca5a5"
    container.replaceChildren(p)
  }
  const showPoster = (row, item, opts = {}) =>
    renderPoster(row, item, {
      loggedIn: repo != null,
      fetchProgress: repo ? (it) => repo.getProgress(it) : null,
      onMarkWatched: markWatched,
      onAddWatchlist: addToWatchlist,
      onMoreLike: openSimilar,
      ...opts,
    })
  const el = {
    topBar: $("topBar"), navNext: $("navNext"), navTrending: $("navTrending"), navAi: $("navAi"),
    homepageView: $("homepageView"),
    nextSetup: $("nextSetup"), nextContent: $("nextContent"),
    menu: $("menu"), menuAiKey: $("menuAiKey"), menuInstall: $("menuInstall"), menuLogout: $("menuLogout"), aiSaveBtn: $("aiSaveBtn"),
    nextView: $("nextView"), tvRow: $("tvRow"), movieRow: $("movieRow"),
    trendingView: $("trendingView"), trendingSetup: $("trendingSetup"), trendingContent: $("trendingContent"), trendingPeriodTabs: $("trendingPeriodTabs"),
    trendingTvContent: $("trendingTvContent"), trendingMoviesContent: $("trendingMoviesContent"),
    aiView: $("aiView"), aiSetup: $("aiSetup"), aiContent: $("aiContent"),
    aiSettings: $("aiSettings"), aiSettingsForm: $("aiSettingsForm"), aiProviderUsername: $("aiProviderUsername"), aiSettingsClose: $("aiSettingsClose"),
    aiProviderSelect: $("aiProviderSelect"), aiKeyInput: $("aiKeyInput"), aiKeyLink: $("aiKeyLink"),
    aiPrompts: $("aiPrompts"),
    aiDialog: $("aiDialog"), aiDialogTitle: $("aiDialogTitle"), aiDialogBack: $("aiDialogBack"),
    aiDialogClose: $("aiDialogClose"), aiDialogResults: $("aiDialogResults"),
    navSimilar: $("navSimilar"),
    similarView: $("similarView"), similarSetup: $("similarSetup"), similarContent: $("similarContent"),
    similarReload: $("similarReload"), similarGrid: $("similarGrid"),
    menuStats: $("menuStats"), similarRatingTabs: $("similarRatingTabs"),
    toast: $("toast"),
    attributionProviderLink: $("attributionProviderLink"),
  }

  let currentView = null
  let toastTimer = null
  let libraryIndex = new Map()
  let resolveLibraryReady
  let libraryReady = new Promise((r) => { resolveLibraryReady = r; })
  let tvItems = []
  let movieItems = []
  let moviesShuffled = false

  // ── Toast ──

  function showToast(msg, isError = false) {
    clearTimeout(toastTimer)
    el.toast.hidden = false
    el.toast.style.color = isError ? "#fca5a5" : ""
    if (typeof msg === "string") el.toast.textContent = msg
    else el.toast.replaceChildren(msg)
    scheduleToastHide()
  }

  function scheduleToastHide() {
    toastTimer = setTimeout(() => { el.toast.hidden = true }, 8000)
  }

  function handleError(err) {
    console.error(err)
    if (!err?.user) window.posthog?.captureException?.(err)
    showToast(err?.message || String(err), true)
  }

  function showRetrySignInToast(provider, message) {
    const link = Object.assign(document.createElement("a"), { href: "#", textContent: "Try again" })
    link.style.color = "inherit"
    link.addEventListener("click", (e) => { e.preventDefault(); repos[provider].startOAuth() })
    const frag = document.createDocumentFragment()
    frag.append(`${message} `, link)
    showToast(frag, true)
  }

  function showPostLoginToast(providerName) {
    pendingInstallToastPrefix = null
    clearTimeout(pendingInstallTimer)
    const connected = `Connected to ${providerName}.`
    if (window.matchMedia("(display-mode: standalone)").matches) return showToast(connected)
    if (deferredInstallPrompt) return showToast(buildInstallToastFrag(`${connected} `))
    if (isIOSSafari()) return showToast(`${connected} Tap Share → Add to Home Screen to install.`)
    showToast(connected)
    pendingInstallToastPrefix = `${connected} `
    pendingInstallTimer = setTimeout(() => { pendingInstallToastPrefix = null }, 4000)
  }

  function buildInstallToastFrag(prefix) {
    const link = Object.assign(document.createElement("a"), { href: "#", textContent: "Install Next Watch" })
    link.style.color = "inherit"
    link.style.textDecoration = "underline"
    link.addEventListener("click", (e) => { e.preventDefault(); if (deferredInstallPrompt) deferredInstallPrompt.prompt() })
    const frag = document.createDocumentFragment()
    frag.append(prefix, link, " for quick access.")
    return frag
  }

  function isIOSSafari() {
    const ua = navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    return iOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  }

  // ── Viewport ──

  function syncViewportMetrics() {
    const h = window.visualViewport?.height || window.innerHeight
    document.documentElement.style.setProperty("--app-height", `${Math.round(h)}px`)
    if (el.topBar) document.documentElement.style.setProperty("--top-bar-height", `${Math.ceil(el.topBar.getBoundingClientRect().height)}px`)
    syncSimilarRows?.()
  }

  // ── Render rows ──

  async function renderRow(rowEl, items, type) {
    const fp = items.map((i) => `${i.ids?.simkl ?? i.ids?.imdb ?? i.ids?.tmdb ?? i.title}|${i.status ?? ""}|${i.watched_episodes_count ?? 0}|${i.last_watched_at ?? ""}`).join(",")
    if (rowEl._fingerprint === fp) return
    rowEl._fingerprint = fp
    rowEl.replaceChildren()
    const setsPromise = loadTrendingBadgeSets()
    items.forEach((item) => {
      const merged = mergeWithLibrary(item, libraryIndex)
      showPoster(rowEl, merged, {
        trendingPeriod: isUnstarted(merged, type)
          ? setsPromise.then((sets) => trendingPeriodFor([merged.ids?.simkl, merged.ids?.imdb, merged.ids?.tmdb], sets))
          : null,
      })
    })
    appendAddMore(rowEl, { href: repo.getBrowseUrl(type), icon: "+", label: type === "tv" ? "Add TV show" : "Add movie" })
  }

  // ── Mark watched ──

  async function markWatched(item) {
    const snapshot = { ...item }
    try {
      await repo.markWatched(item)
      showToast(await toastFrag("Marked ", snapshot, " watched."))
      await loadSuggestions()
    } catch (err) {
      handleError(err)
      throw err
    }
  }

  async function toastFrag(prefix, item, suffix) {
    const ep = item.type === "tv" ? item.nextEpisode : null
    const base = item.url || ""
    const url = ep ? (item.episodeUrl || base) : base
    const label = ep ? `${item.title} ${ep.season}x${ep.episode}` : item.title
    const link = Object.assign(document.createElement("a"), { href: url || "#", target: "_blank", rel: "noreferrer", textContent: label })
    link.style.color = "inherit"; link.style.textDecoration = "underline"
    const frag = document.createDocumentFragment()
    frag.append(prefix, link, suffix)
    return frag
  }

  // ── Load suggestions ──

  async function loadSuggestions() {
    if (!el.tvRow.children.length) renderSkeletons(el.tvRow)
    if (!el.movieRow.children.length) renderSkeletons(el.movieRow)
    try {
      const [ws, wls, wlm, cs, cm] = await Promise.all([
        repo.getWatchingShows(), repo.getWatchlistShows(), repo.getWatchlistMovies(),
        repo.getCompletedShows(), repo.getCompletedMovies(),
      ])
      const allShows = [...ws.items, ...wls.items, ...cs.items]
      const allMovies = [...wlm.items, ...cm.items]
      const data = { shows: allShows, movies: allMovies, fresh: ws.fresh || wls.fresh || wlm.fresh || cs.fresh || cm.fresh }
      tvItems = [
        ...ws.items.toSorted(byWatchingPriority),
        ...wls.items.toSorted((a, b) => (a.added_at || 0) - (b.added_at || 0)),
      ]
      movieItems = wlm.items
      if (!moviesShuffled) {
        movieItems = movieItems.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
        moviesShuffled = true
      }
      libraryIndex = collectLibraryIndex(data)
      resolveLibraryReady()
      renderStats(allShows, allMovies)
      renderRow(el.tvRow, tvItems, "tv")
      renderRow(el.movieRow, movieItems, "movie")
      if (data.fresh && el.toast.hidden) showToast("Synced library.")
    } catch (err) {
      resolveLibraryReady()
      handleError(err)
    }
  }

  // ── Trending ──

  async function renderDiscoveryRow(containerEl, items, type, browseParams = {}) {
    containerEl.replaceChildren()
    items.forEach((item) => showPoster(containerEl, asTVShowPoster(mergeWithLibrary(item, libraryIndex))))
    appendAddMore(containerEl, { href: repo.getTrendingBrowseUrl(type, browseParams), icon: "→", label: type === "tv" ? "View all TV shows" : "View all movies" })
  }

  async function addToWatchlist(item) {
    const keys = itemLookupKeys(item)
    if (!keys.length) return
    try {
      await repo.addToWatchlist(item)
      item.status = "plantowatch"
      for (const key of keys) libraryIndex.set(key, item)
      showToast(await toastFrag("Added ", item, " to watchlist."))
      await loadSuggestions()
    } catch (err) {
      handleError(err)
      throw err
    }
  }

  let trendingBadgeSetsPromise = null
  function loadTrendingBadgeSets() {
    if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise
    const periods = ["today", "week", "month"]
    trendingBadgeSetsPromise = new Promise((resolve) => requestIdleCallback(resolve, { timeout: 2000 }))
      .then(() => repo)
      .then((c) => Promise.all(periods.map((p) => c.getTrending(p))))
      .then((results) => {
        const sets = { today: new Set(), week: new Set(), month: new Set() }
        results.forEach(({ tv, movies }, i) => {
          const period = periods[i]
          for (const item of [...(tv || []), ...(movies || [])]) {
            for (const id of [item.ids?.simkl, item.ids?.imdb, item.ids?.tmdb]) {
              if (id) sets[period].add(String(id))
            }
          }
        })
        return sets
      })
      .catch(() => ({ today: new Set(), week: new Set(), month: new Set() }))
    return trendingBadgeSetsPromise
  }

  async function loadTrending() {
    const period = el.trendingPeriodTabs.querySelector(".range-tab.active")?.dataset.period || "today"
    await idbSet("trendingPeriod", period)
    renderSkeletons(el.trendingTvContent)
    renderSkeletons(el.trendingMoviesContent)
    try {
      const [{ tv: tvData, movies: movieData }] = await Promise.all([repo.getTrending(period), libraryReady])
      const filterFn = (item) => !libraryLookup(libraryIndex, item)
      const tv = tvData.filter(filterFn).slice(0, 12)
      const movies = movieData.filter(filterFn).slice(0, 12)
      if (tv.length) await renderDiscoveryRow(el.trendingTvContent, tv, "tv", { period })
      else setEmpty(el.trendingTvContent, "No results.")
      if (movies.length) await renderDiscoveryRow(el.trendingMoviesContent, movies, "movie", { period })
      else setEmpty(el.trendingMoviesContent, "No results.")
    } catch (err) {
      console.error(err)
      setEmpty(el.trendingTvContent, err.message, true)
      setEmpty(el.trendingMoviesContent, err.message, true)
    }
  }

  // ── AI ──

  const SIMILAR_BATCH = 20
  let similarPool = []
  let similarCursor = 0
  let similarObserver = null

  async function renderSimilar() {
    renderSkeletons(el.similarGrid)
    const { shows, movies } = await gatherLibrary()
    const all = [...shows, ...movies]
    const minRating = await resolveSimilarMinRating(all)
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
    slice.forEach((item) => showPoster(el.similarGrid, asTVShowPoster(mergeWithLibrary(item, libraryIndex))))
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

  function renderStats(shows, movies) {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000
    const watchedMovies = movies.filter((m) => m.status === "completed")
    const watchedShows = shows.filter((s) => (s.watched_episodes_count || 0) > 0 || s.status === "completed")
    const watchedEpisodes = shows.reduce((sum, s) => sum + (s.watched_episodes_count || 0), 0)
    let recentEpisodes = 0
    let recentShows = 0
    for (const s of shows) {
      const recent = (s.watched_episodes_at || []).filter((d) => d?.getTime() >= since).length
      if (recent) { recentEpisodes += recent; recentShows++ }
    }
    const recentMovies = watchedMovies.filter((m) => m.last_watched_at?.getTime() >= since).length
    el.menuStats.replaceChildren(
      statLi("📺", `30d: ${fmt(recentShows)} shows · ${fmt(recentEpisodes)} eps`, `all-time: ${fmt(watchedShows.length)} · ${fmt(watchedEpisodes)} eps`),
      statLi("🎬", `30d: ${fmt(recentMovies)} movies`, `all-time: ${fmt(watchedMovies.length)}`),
    )
    el.menuStats.hidden = false
  }

  function fmt(n) { return n.toLocaleString() }

  function statLi(icon, primary, sub) {
    const li = document.createElement("li")
    li.append(`${icon} ${primary}`)
    const subEl = document.createElement("div")
    subEl.className = "menu-stats-sub"
    subEl.textContent = sub
    li.append(subEl)
    return li
  }

  async function resolveSimilarMinRating(items) {
    const saved = await idbGet("similarMinRating")
    if (saved) return Number.parseInt(saved, 10) || 0
    const sevenPlus = items.filter((i) => (i.user_rating || 0) >= 7).length
    const minRating = sevenPlus < 10 ? 0 : 7
    el.similarRatingTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", Number.parseInt(t.dataset.minRating, 10) === minRating))
    return minRating
  }

  async function openAiSettings() {
    el.aiProviderSelect.value = await getAiProvider()
    await syncAiKeyLink()
    el.aiSettings.showModal()
  }

  async function getAiProvider() { return (await idbGet("aiProvider")) || "groq" }
  async function getAiKey(provider) { return (await idbGet(`aiKey:${provider}`)) || "" }

  async function syncAiKeyLink() {
    const opt = el.aiProviderSelect.selectedOptions[0]
    el.aiKeyLink.href = opt.dataset.url
    el.aiKeyInput.value = await getAiKey(el.aiProviderSelect.value)
    el.aiProviderUsername.value = el.aiProviderSelect.value
    syncAiSaveLabel()
  }

  function syncAiSaveLabel() {
    const name = el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "")
    el.aiSaveBtn.textContent = `Save ${name} key`
  }

  // ── Recommendation Flow ──

  async function gatherLibrary() {
    const [ws, wls, wlm, cs, cm] = await Promise.all([
      repo.getWatchingShows(), repo.getWatchlistShows(), repo.getWatchlistMovies(),
      repo.getCompletedShows(), repo.getCompletedMovies(),
    ])
    return {
      shows: [...ws.items, ...wls.items, ...cs.items],
      movies: [...wlm.items, ...cm.items],
    }
  }

  async function getRecommendations(mood) {
    const [library, provider] = await Promise.all([gatherLibrary(), getAiProvider()])
    return await fetchAiSuggestions({ provider, key: await getAiKey(provider), library, mood })
  }

  async function getSimilar(seed) {
    const [library, provider] = await Promise.all([gatherLibrary(), getAiProvider()])
    const suggestions = await fetchSimilarSuggestions({ provider, key: await getAiKey(provider), library, seed })
    return suggestions.filter((s) => !(s.title === seed.title && s.year === seed.year))
  }

  // ── AI Result Rendering ──

  const dialogStack = []
  let pendingDialogEntry = null

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

  async function pushDialog(entry) {
    if (!(await getAiKey(await getAiProvider()))) {
      pendingDialogEntry = entry
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
    el.aiDialogResults.replaceChildren()
    if (el.aiDialog.open) el.aiDialog.close()
  }

  async function renderDialogTop() {
    const entry = dialogStack.at(-1)
    el.aiDialogTitle.replaceChildren(typeof entry.title === "string" ? entry.title : entry.title.cloneNode(true))
    el.aiDialogBack.hidden = dialogStack.length <= 1
    renderSkeletons(el.aiDialogResults)
    try {
      const suggestions = await entry.fetch()
      if (dialogStack.at(-1) !== entry) return
      const items = await resolveAiSuggestions(suggestions)
      if (dialogStack.at(-1) !== entry) return
      if (!items.length) {
        setEmpty(el.aiDialogResults, entry.emptyMsg)
        return
      }
      el.aiDialogResults.replaceChildren()
      items.forEach((item) => showPoster(el.aiDialogResults, asTVShowPoster(item)))
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

  async function resolveAiSuggestions(suggestions) {
    const resolved = await Promise.all(suggestions.map(async (s) => {
      const query = `${s.title} ${s.year || ""}`.trim()
      const url = repo.getSearchUrl(query, s.type)
      const r = await tmdbRepository.searchByTitle(s.title, s.year, s.type).catch(() => null)
      if (r) return mergeWithLibrary({ ...r, type: s.type, url }, libraryIndex)
      return { title: s.title, year: s.year, type: s.type, ids: {}, url }
    }))
    return resolved.filter(Boolean).sort(byAiPickRelevance)
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
    if (repo == null) {
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
      homepage: { view: el.homepageView, nav: null },
      next: { view: el.nextView, nav: el.navNext },
      trending: { view: el.trendingView, nav: el.navTrending, onShow: () => repo != null && loadTrending() },
      similar: { view: el.similarView, nav: el.navSimilar, onShow: () => repo != null && !similarPool.length && libraryReady.then(renderSimilar) },
      mood: { view: el.aiView, nav: el.navAi },
    }
    for (const [key, { view, nav }] of Object.entries(views)) {
      view.hidden = key !== name
      if (nav) nav.classList.toggle("active-nav", key === name)
    }
    views[name].onShow?.()
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
    try {
      const provider = sessionStorage.getItem("next-watch-oauth-provider") || "simkl"
      const name = repos[provider].name
      if (error) {
        if (error !== "access_denied") console.error(`${name} OAuth error: ${error}`)
        const message = error === "access_denied"
          ? `${name} sign-in was cancelled.`
          : `Couldn't finish signing in to ${name}.`
        showRetrySignInToast(provider, message)
        showView("next")
        return
      }
      const expected = sessionStorage.getItem("next-watch-oauth-state")
      const state = params.get("state") || ""
      if (expected && state && expected !== state) throw Object.assign(new Error("State mismatch."), { user: true })
      const token = await repos[provider].exchangeOAuthCode(code)
      await idbSet("auth", { token: token.access_token, provider })
      await refreshLoggedIn()
      sessionStorage.removeItem("next-watch-oauth-state")
      sessionStorage.removeItem("next-watch-oauth-provider")
      await hydrateUI()
      showView("next")
      showPostLoginToast(name)
      await loadSuggestions()
    } catch (err) {
      sessionStorage.removeItem("next-watch-oauth-state")
      sessionStorage.removeItem("next-watch-oauth-provider")
      handleError(err)
      showView("next")
    }
  }

  async function logout() {
    unregisterPeriodicSync().catch(() => {})
    await Promise.all([idbSet("auth", null), clearAi(), ...Object.values(repos).map((r) => r.clear())])
    localStorage.removeItem("next-watch-auth")
    location.href = location.pathname
  }

  async function unregisterPeriodicSync() {
    if (!("serviceWorker" in navigator)) return
    const reg = await navigator.serviceWorker.ready
    if (!("periodicSync" in reg)) return
    await reg.periodicSync.unregister("next-watch-check-episodes")
  }

  // ── UI hydration ──

  async function hydrateUI() {
    document.body.classList.toggle("logged-in", repo != null)
    el.topBar.classList.toggle("logged-out", repo == null)
    el.aiProviderSelect.value = await getAiProvider()
    el.aiKeyInput.value = await getAiKey(el.aiProviderSelect.value)
    el.menu.hidden = repo == null
    if (repo) {
      el.attributionProviderLink.textContent = repo.name
      el.attributionProviderLink.href = repo.siteUrl
    }
    syncViewportMetrics()
  }

  async function enableNotifs() {
    if (!("serviceWorker" in navigator)) return
    const permission = await Notification.requestPermission()
    if (permission !== "granted") return
    const reg = await navigator.serviceWorker.ready
    if (!("periodicSync" in reg)) return
    await reg.periodicSync.register("next-watch-check-episodes", { minInterval: 24 * 60 * 60 * 1000 })
    showToast("Notifications on. You'll hear about new episodes once a day.")
  }

  // ── Wire events ──

  el.aiSettingsForm.addEventListener("submit", async (e) => {
    e.preventDefault()
    const provider = el.aiProviderSelect.value
    const aiKey = el.aiKeyInput.value.trim()
    const retryEntry = aiKey ? pendingDialogEntry : null
    pendingDialogEntry = null
    await idbSet("aiProvider", provider)
    await idbSet(`aiKey:${provider}`, aiKey)
    syncAiSaveLabel()
    el.aiSettings.close()
    showToast(`${el.aiProviderSelect.selectedOptions[0].textContent.replace(/ \(free\)/, "")} key saved.`)
    if (retryEntry) {
      dialogStack.push(retryEntry)
      if (!el.aiDialog.open) el.aiDialog.showModal()
      renderDialogTop()
    }
  })
  el.menuAiKey.addEventListener("click", () => { el.menu.open = false; openAiSettings() })
  el.menuInstall.addEventListener("click", () => { el.menu.open = false; if (deferredInstallPrompt) deferredInstallPrompt.prompt() })
  el.menuLogout.addEventListener("click", () => { el.menu.open = false; logout() })
  document.addEventListener("click", (e) => {
    if (el.menu.open && !el.menu.contains(e.target)) el.menu.open = false
  }, true)
  document.addEventListener("touchmove", (e) => { if (el.menu.open && !el.menu.contains(e.target)) el.menu.open = false }, { passive: true, capture: true })
  el.aiSettingsClose.addEventListener("click", () => el.aiSettings.close())
  el.aiSettings.addEventListener("close", () => { pendingDialogEntry = null })
  for (const container of document.querySelectorAll("[data-signin-ctas]")) {
    if (!container.firstElementChild) container.appendChild(tpl("tpl-signin-ctas"))
    container.addEventListener("click", (e) => {
      const provider = e.target.closest("[data-provider]")?.dataset.provider
      repos[provider]?.startOAuth()
    })
  }
  for (const link of document.querySelectorAll("[data-back-home]")) {
    link.addEventListener("click", (e) => { e.preventDefault(); showView("homepage"); })
  }
  el.navNext.addEventListener("click", (e) => { e.preventDefault(); showView("next"); })
  el.navTrending.addEventListener("click", (e) => { e.preventDefault(); showView("trending"); })
  el.navSimilar.addEventListener("click", (e) => { e.preventDefault(); showView("similar"); })
  el.navAi.addEventListener("click", (e) => { e.preventDefault(); showView("mood"); })
  el.similarReload.addEventListener("click", () => renderSimilar())
  el.similarRatingTabs.addEventListener("click", async (e) => {
    const tab = e.target.closest(".range-tab")
    if (!tab) return
    el.similarRatingTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.remove("active"))
    tab.classList.add("active")
    await idbSet("similarMinRating", tab.dataset.minRating)
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
  document.addEventListener("visibilitychange", () => { if (document.hidden) el.menu.open = false; else if (repo != null) loadSuggestions() })

  let deferredInstallPrompt = null
  let pendingInstallToastPrefix = null
  let pendingInstallTimer = null
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault()
    deferredInstallPrompt = e
    if (!window.matchMedia("(display-mode: standalone)").matches) el.menuInstall.hidden = false
    if (pendingInstallToastPrefix) {
      const prefix = pendingInstallToastPrefix
      pendingInstallToastPrefix = null
      clearTimeout(pendingInstallTimer)
      showToast(buildInstallToastFrag(prefix))
    }
  })
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null
    el.menuInstall.hidden = true
    enableNotifs()
  })
  el.toast.addEventListener("mouseenter", () => clearTimeout(toastTimer))
  el.toast.addEventListener("mouseleave", () => { if (!el.toast.hidden) scheduleToastHide() })
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js", { type: "module" }).catch(() => {})

  // ── Boot ──

  await idbSet("clientIds", {
    simkl: window.__SIMKL_CLIENT_ID__ || "",
    trakt: window.__TRAKT_CLIENT_ID__ || "",
  }).catch(() => {})
  await refreshLoggedIn()
  await hydrateUI()
  const [savedPeriod, savedMinRating] = await Promise.all([
    idbGet("trendingPeriod"),
    idbGet("similarMinRating"),
  ])
  if (savedPeriod) {
    el.trendingPeriodTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", t.dataset.period === savedPeriod))
  }
  if (savedMinRating) {
    el.similarRatingTabs.querySelectorAll(".range-tab").forEach((t) => t.classList.toggle("active", t.dataset.minRating === savedMinRating))
  }
  await handleOAuthCallback()
  const hash = location.hash.replace("#", "").split("/")[0]
  showView(["next", "trending", "similar", "mood"].includes(hash) ? hash : repo != null ? "next" : "homepage")
  if (repo != null) loadSuggestions()
  else resolveLibraryReady()
})()
