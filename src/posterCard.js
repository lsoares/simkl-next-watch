import { tmdbRepository } from "./tmdbRepository.js"

export function renderPoster(row, item, opts = {}) {
  const { loggedIn = false, trendingPeriod = null, fetchProgress = null, onMarkWatched, onAddWatchlist, onMoreLike } = opts
  const { frag, card } = makeRowItem()
  card.item = item
  card.loggedIn = loggedIn
  card.trendingPeriod = trendingPeriod
  card.fetchProgress = fetchProgress
  card.handlers = { onMarkWatched, onAddWatchlist, onMoreLike }
  row.appendChild(frag)
  hydrationObserver.observe(card)
}

const hydrationObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    hydrationObserver.unobserve(entry.target)
    hydratePoster(entry.target)
  }
}, { rootMargin: "200px" })

export function renderSkeletons(row, count = 10) {
  row.replaceChildren()
  for (let i = 0; i < count; i++) row.appendChild(makeRowItem().frag)
}

export function appendAddMore(row, { href, icon, label }) {
  const frag = document.getElementById("tpl-add-more").content.cloneNode(true)
  const anchor = frag.querySelector(".add-more-card")
  anchor.href = href
  anchor.setAttribute("aria-label", label)
  anchor.querySelector(".add-more-plus").textContent = icon
  anchor.querySelector(".add-more-label").textContent = label
  row.appendChild(frag)
}

export function asTVShowPoster(item) {
  return { ...item, nextEpisode: null, episodeUrl: "", episodeTitle: "" }
}

export function isUnstarted(item, type) {
  if (type === "tv") {
    return item.status === "plantowatch" || (item.watched_episodes_count === 0 && item.nextEpisode?.episode === 1)
  }
  return item.status === "plantowatch"
}

export function availableEpisodesLeft(show) {
  const total = show.total_episodes_count || 0
  const watched = show.watched_episodes_count || 0
  return total > 0 ? Math.max(0, total - watched) : Infinity
}

// ── Internal ──

class PosterCard extends HTMLElement {
  item = null
  loggedIn = false
  trendingPeriod = null
  fetchProgress = null
  handlers = {}

  connectedCallback() {
    if (this._rendered) return
    this._render()
    this._rendered = true
    this._hydrateAsync()
  }

  async _hydrateAsync() {
    const item = this.item
    if (!item) return
    if (this.fetchProgress && item.type === "tv" && item.status === "watching" && !item.nextEpisode) {
      const progress = await this.fetchProgress(item)
      if (this.item !== item) return
      if (progress === null) {
        this.closest(".row-item")?.remove()
        return
      }
      if (progress?.nextEpisode) {
        item.nextEpisode = progress.nextEpisode
        item.episodeUrl = progress.episodeUrl || ""
        this._refresh()
      }
    }
    if (this.item?.nextEpisode && !this.item.episodeTitle && this.item.ids?.tmdb && this.item.status !== "plantowatch") {
      const ep = this.item.nextEpisode
      const episodes = await tmdbRepository.getSeason(this.item.ids.tmdb, ep.season)
      if (this.item !== item) return
      const title = episodes.find((e) => Number(e.episode) === Number(ep.episode))?.name
      if (!title) return
      this.item.episodeTitle = title
      this.querySelector(".poster-episode")?.append(`: ${title}`)
    }
  }

  disconnectedCallback() { hydrationObserver.unobserve(this) }

  _refresh() {
    this._rendered = false
    this._render()
  }

  async _onMarkWatchedClick() {
    const btn = this.querySelector(".mark-watched-btn")
    btn.disabled = true
    try {
      await this.handlers.onMarkWatched?.(this.item)
    } finally {
      btn.disabled = false
    }
  }

  async _onAddWatchlistClick() {
    const btn = this.querySelector(".add-watchlist-btn")
    btn.disabled = true
    try {
      await this.handlers.onAddWatchlist?.(this.item)
      this._refresh()
    } finally {
      btn.disabled = false
    }
  }

  _applyTrendingBadge() {
    const period = this.trendingPeriod
    if (!period) return
    if (typeof period.then === "function") {
      const item = this.item
      period.then((resolved) => {
        if (this.item !== item) return
        this._renderTrendingBadge(resolved)
      })
      return
    }
    this._renderTrendingBadge(period)
  }

  _renderTrendingBadge(period) {
    if (!period) return
    const info = TRENDING_BADGE_INFO[period]
    if (!info) return
    const host = this.querySelector(".poster-top-text")
    if (!host || host.querySelector(".trending-badge")) return
    const badge = document.getElementById("tpl-trending-badge").content.cloneNode(true).firstElementChild
    badge.classList.add(`trending-badge--${period}`)
    badge.title = info.tooltip
    badge.setAttribute("aria-label", info.tooltip)
    badge.textContent = `🔥 ${info.label}`
    host.appendChild(badge)
  }

  _render() {
    const { item, loggedIn } = this
    if (!item) {
      this.innerHTML = `<article class="item-card"><div class="poster-anchor"><div class="poster poster--placeholder" aria-hidden="true" style="background:${placeholderGradient(Math.random().toString())}"></div></div></article>`
      return
    }

    const status = item.status
    const watched = status === "completed"
    const watching = status === "watching"
    const inWatchlist = !!status && !watched
    const notStarted = !status
    const watchedAt = item.last_watched_at
    const userRating = item.user_rating

    const id = item.id || ""
    const title = item.title || ""
    const year = item.year || ""
    const type = item.type
    const rating = item.rating
    const img = (this.closest(".simple-view") ? bigPoster(item.posterUrl) : item.posterUrl) || ""
    const url = item.url || ""

    const ep = watching && type === "tv" ? item.nextEpisode : null
    const epUrl = ep ? (item.episodeUrl || "") : ""
    const epCode = ep ? `${ep.season}x${ep.episode}` : ""
    const totalEps = item.total_episodes_count || 0
    const watchedEps = item.watched_episodes_count || 0
    const showProgress = watching && type === "tv" && totalEps > 0 && watchedEps > 0
    const progressPct = showProgress ? Math.min(100, Math.round((watchedEps / totalEps) * 100)) : 0
    const showEpCount = type === "tv" && !epCode && !watching && !watched
    const unstartedEpCount = showEpCount ? availableEpisodesLeft(item) : null
    const unstartedEpLabel = Number.isFinite(unstartedEpCount) && unstartedEpCount > 0 ? `${unstartedEpCount} episode${unstartedEpCount === 1 ? "" : "s"}` : ""

    const hasEpisodeInfo = type === "tv" && !!item.nextEpisode
    const showAddWatchlist = loggedIn && id && notStarted
    const showMarkWatched = inWatchlist && (type !== "tv" || hasEpisodeInfo)
    const showMoreLike = watched || (type === "tv" && inWatchlist && !hasEpisodeInfo)

    const suppressMeta = watching && !!ep
    const showYear = !suppressMeta && year
    const showRating = rating != null && !suppressMeta
    const ratingText = showRating ? (Number.isInteger(rating) ? rating : rating.toFixed(1)) : ""
    const ratingLabel = { imdb: "IMDb", trakt: "Trakt", simkl: "Simkl", tmdb: "TMDB" }[item.ratingSource] || ""
    const watchedAgo = watched && watchedAt ? formatWatchedAgo(watchedAt) : ""
    const watchedRating = userRating != null && !suppressMeta ? userRating : null
    const showWatchingBadge = watching && !ep
    const showWatchlistBadge = inWatchlist && !watching
    const showRuntime = !watched && !watching && item.runtime > 0
    const runtimeLabel = showRuntime ? formatRuntime(item.runtime) : ""

    const posterHref = epUrl || url
    const titleId = `poster-title-${++posterIdSeq}`

    this.innerHTML = `
      <article class="item-card${watched ? " trending-watched" : ""}${watching || (inWatchlist && !watched) ? " trending-watchlisted" : ""}" data-simkl-id="${id}" data-type="${type || ""}" data-title="${escapeHtml(title)}"${!status && !userRating && item.overview ? ` title="${escapeHtml(item.overview)}"` : ""} aria-labelledby="${titleId}">
        ${(() => {
        const inner = img ? `<img class="poster" src="${escapeHtml(img)}" alt="${escapeHtml(title)}" loading="lazy" draggable="false" />` : `<div class="poster poster--placeholder" aria-hidden="true" style="background:${placeholderGradient(title)}"></div>`
        const anchorLabel = epCode ? `Watch ${title} ${epCode}` : `Open ${title} poster`
        return posterHref
          ? `<a class="poster-anchor" href="${escapeHtml(posterHref)}" target="_blank" rel="noreferrer" aria-label="${escapeHtml(anchorLabel)}">${inner}</a>`
          : `<div class="poster-anchor">${inner}</div>`
      })()}
        <div class="poster-top">
          <div class="poster-top-text">
            <div class="poster-title">
              ${url ? `<a class="poster-title-link" id="${titleId}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>` : `<span class="poster-title-link" id="${titleId}">${escapeHtml(title)}</span>`}
            </div>
            ${(showYear || showRuntime) ? `<div class="poster-meta-row">
              ${showYear ? `<span class="poster-title-meta">${escapeHtml(String(year))}</span>` : ""}
              ${showRuntime ? `<span class="poster-runtime">${escapeHtml(runtimeLabel)}</span>` : ""}
            </div>` : ""}
            ${unstartedEpLabel ? `<span class="poster-episode-count">${escapeHtml(unstartedEpLabel)}</span>` : ""}
            ${showRating ? `<span class="poster-status poster-status--rating" title="${ratingLabel} rating: ${ratingText}/10" aria-label="${ratingLabel} rating ${ratingText} out of 10">${ratingText} ☆</span>` : ""}
          </div>
        </div>
        <div class="poster-bottom">
          ${epCode ? `<a class="poster-episode" href="${escapeHtml(epUrl)}" target="_blank" rel="noreferrer">${escapeHtml(epCode)}${item.episodeTitle ? `: ${escapeHtml(item.episodeTitle)}` : ""}</a>` : ""}
          ${watchedRating != null ? (() => {
        const statusPrefix = watched && watchedAgo ? `Watched ${escapeHtml(watchedAgo)}` : watched ? "Watched" : watching ? "Watching" : null
        const title = statusPrefix ?? "Rated"
        const body = `${ICON_EYE} ${watchedRating} ☆`
        const ariaLabel = statusPrefix ? `${statusPrefix} · Rated ${watchedRating} out of 10` : `Rated ${watchedRating} out of 10`
        return url
          ? `<a class="poster-status poster-status--watched" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" title="${title}" aria-label="${ariaLabel}">${body}</a>`
          : `<span class="poster-status poster-status--watched" title="${title}" aria-label="${ariaLabel}">${body}</span>`
      })() : (watched || showWatchingBadge) ? (() => {
        const text = watching ? "Watching" : watchedAgo ? `Watched ${escapeHtml(watchedAgo)}` : "Watched"
        return url
          ? `<a class="poster-status poster-status--watched" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" title="${text}" aria-label="${text}">${ICON_EYE}</a>`
          : `<span class="poster-status poster-status--watched" title="${text}" aria-label="${text}">${ICON_EYE}</span>`
      })() : ""}
          ${showWatchlistBadge ? `<span class="poster-status poster-status--watchlist" title="On watchlist" aria-label="On watchlist">${ICON_BOOKMARK}</span>` : ""}
        </div>
        ${showProgress ? `<div class="poster-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}" aria-label="${watchedEps} of ${totalEps} episodes watched"><div class="poster-progress-fill" style="width: ${progressPct}%"></div></div>` : ""}
        ${showMarkWatched ? `<button class="mark-watched-btn" title="I've watched this" aria-label="Mark as watched">${ICON_CHECK}</button>` : ""}
        ${showAddWatchlist ? `<button class="add-watchlist-btn" title="Add to watchlist" aria-label="Add to watchlist" data-title="${escapeHtml(title)}">+</button>` : ""}
        ${showMoreLike ? `<button class="more-like-btn" title="More like this" aria-label="More like this">${ICON_SPARKLE}</button>` : ""}
      </article>
    `

    this.querySelector(".mark-watched-btn")?.addEventListener("click", () => this._onMarkWatchedClick())
    this.querySelector(".add-watchlist-btn")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._onAddWatchlistClick(); })
    this.querySelector(".more-like-btn")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this.handlers.onMoreLike?.(this.item); })

    this._applyTrendingBadge()
  }
}

class PostersRow extends HTMLElement { }

customElements.define("poster-card", PosterCard)
customElements.define("posters-row", PostersRow)

let posterIdSeq = 0

function makeRowItem() {
  const frag = document.getElementById("tpl-row-item").content.cloneNode(true)
  const card = document.createElement("poster-card")
  frag.firstElementChild.appendChild(card)
  return { frag, card }
}

async function hydratePoster(card) {
  const item = card.item
  if (!item || item.posterUrl) return
  if (!item.ids?.tmdb && !item.ids?.imdb) return
  const meta = await tmdbRepository.getDetails(item)
  if (card.item !== item) return
  if (meta.released === false) {
    card.closest(".row-item")?.remove()
    return
  }
  const runtime = (item.type === "movie" ? meta.runtime : meta.lastEpisode?.runtime) || 0
  const runtimeChanged = runtime !== (item.runtime || 0)
  item.runtime = runtime
  item.backdropUrl = meta.backdropUrl || ""
  item.overview = meta.overview || ""
  if (item.backdropUrl) new Image().src = item.backdropUrl
  if (item.overview && !item.status && !item.user_rating) card.querySelector(".item-card")?.setAttribute("title", item.overview)
  card.dispatchEvent(new CustomEvent("backdropready", { bubbles: true }))
  if (!meta.url) {
    if (runtimeChanged) card._refresh()
    return
  }
  item.posterUrl = meta.url
  const oldPoster = card.querySelector(".poster")
  if (!oldPoster || runtimeChanged) return card._refresh()
  const img = document.createElement("img")
  img.className = "poster"
  img.alt = item.title || ""
  img.loading = "lazy"
  img.draggable = false
  img.src = card.closest(".simple-view") ? bigPoster(meta.url) : meta.url
  oldPoster.replaceWith(img)
}

function bigPoster(url) {
  return url?.includes("/t/p/w342") ? url.replace("/t/p/w342", "/t/p/w780") : url
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

function placeholderGradient(title) {
  let h = 0
  for (const c of String(title)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const hue1 = h % 360
  const hue2 = (h * 7 + 137) % 360
  const x1 = 15 + (h % 45)
  const y1 = 10 + ((h >>> 3) % 45)
  const x2 = 50 + ((h >>> 5) % 45)
  const y2 = 50 + ((h >>> 7) % 45)
  return `radial-gradient(circle at ${x1}% ${y1}%, hsla(${hue1},60%,55%,0.25), transparent 55%),radial-gradient(circle at ${x2}% ${y2}%, hsla(${hue2},55%,50%,0.18), transparent 55%),linear-gradient(145deg,#1a2340 0%,#0b1220 100%)`
}

function formatRuntime(mins) {
  if (mins < 60) return `${mins}m`
  const halves = Math.round(mins / 30) / 2
  return `~${halves}h`
}

const relativeTimeUnits = [["year", 31536e6], ["month", 2592e6], ["week", 6048e5], ["day", 864e5], ["hour", 36e5], ["minute", 6e4], ["second", 1e3]]
function formatWatchedAgo(date) {
  if (!date) return ""
  const diff = date.getTime() - Date.now()
  const [unit, ms] = relativeTimeUnits.find(([, ms]) => Math.abs(diff) >= ms) || relativeTimeUnits.at(-1)
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(diff / ms), unit)
}

const TRENDING_BADGE_INFO = {
  today: { label: "Today", tooltip: "Trending today" },
  week: { label: "Week", tooltip: "Trending this week" },
  month: { label: "Month", tooltip: "Trending this month" },
}

const ICON_EYE = `<svg class="poster-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const ICON_BOOKMARK = `<svg class="poster-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
const ICON_CHECK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`
const ICON_SPARKLE = `<svg width="20" height="20" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z"/><path d="M18 14l.9 2.7L21.6 18l-2.7.9L18 21l-.9-2.1L14.4 18l2.7-.9L18 14z"/></svg>`
