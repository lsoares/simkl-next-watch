import { tmdbRepository } from "./tmdbRepository.js"

class PosterCard extends HTMLElement {
  variant = "next"
  type = "tv"
  item = null
  watched = false
  watchedAt = null
  userRating = null
  inWatchlist = false
  watching = false
  loggedIn = false
  episodeUrlFn = null

  connectedCallback() {
    if (this._rendered) return
    this._render()
    this._rendered = true
  }

  disconnectedCallback() {
    posterObserver?.unobserve(this)
  }

  get cardEl() { return this.querySelector(".item-card"); }

  refresh() {
    this._rendered = false
    this._render()
  }

  applyLibraryEntry(entry) {
    this.watched = !!entry?.watched
    this.watchedAt = entry?.watchedAt || null
    this.userRating = entry?.userRating ?? null
    this.inWatchlist = !!entry && !entry.watched
    this.watching = !!entry?.watching
  }

  _emit(name) {
    this.dispatchEvent(new CustomEvent(`poster:${name}`, { bubbles: true, detail: { item: this.item, type: this.type } }))
  }

  _render() {
    const { item, variant, type, watched, watchedAt, userRating, inWatchlist, watching, loggedIn } = this
    if (!item) return

    const isNext = variant === "next"
    const id = item.id || ""
    const title = item.title || ""
    const year = item.year || ""
    const rating = item.rating
    const img = item.posterUrl || ""
    const url = item.url || ""

    const ep = isNext && type === "tv" ? item.nextEpisode : null
    const unstarted = isNext ? isUnstarted(item, type) : false
    const epUrl = !unstarted && ep ? (this.episodeUrlFn?.(item, ep) || "") : ""
    const epCode = !unstarted && ep ? `${ep.season}x${ep.episode}` : ""
    const showEpCount = type === "tv" && !epCode && !watching && (isNext || !watched)
    const unstartedEpCount = showEpCount ? availableEpisodesLeft(item) : null
    const unstartedEpLabel = Number.isFinite(unstartedEpCount) && unstartedEpCount > 0 ? `${unstartedEpCount} episode${unstartedEpCount === 1 ? "" : "s"}` : ""

    const isCurrentlyWatching = !isNext && watching
    const showYear = isNext ? unstarted && year : !isCurrentlyWatching && year
    const totalEps = item.total_episodes_count || 0
    const watchedEps = item.watched_episodes_count || 0
    const showProgress = isNext && type === "tv" && totalEps > 0 && watchedEps > 0
    const progressPct = showProgress ? Math.min(100, Math.round((watchedEps / totalEps) * 100)) : 0
    const showMarkWatched = isNext
    const showAddWatchlist = !isNext && loggedIn && id && !watched && !inWatchlist && !watching
    const showMoreLike = variant === "discovery" && (watched || isCurrentlyWatching)
    const showRating = !isCurrentlyWatching && rating != null && (!isNext || unstarted)
    const ratingText = showRating ? (Number.isInteger(rating) ? rating : rating.toFixed(1)) : ""
    const ratingLabel = item.ids?.trakt ? "Trakt" : "Simkl"
    const showWatchedBadge = !isNext && watched && !isCurrentlyWatching
    const watchedAgo = showWatchedBadge && watchedAt ? formatWatchedAgo(watchedAt) : ""
    const watchedRating = !isNext && !isCurrentlyWatching && userRating != null ? userRating : null
    const showWatchingBadge = isCurrentlyWatching
    const showWatchlistBadge = !isNext && inWatchlist && !watched && !isCurrentlyWatching
    const isUnstartedItem = isNext ? unstarted : (!watched && !watching)
    const showRuntime = isUnstartedItem && Number.isFinite(item.runtime) && item.runtime > 0
    const runtimeLabel = showRuntime ? formatRuntime(item.runtime) : ""

    const dataAttrs = isNext
      ? `data-simkl-id="${id}" data-type="${type}"`
      : `data-simkl-id="${id}" data-title="${escapeHtml(title)}"`
    const imgLazy = isNext ? "" : ` loading="lazy"`
    const posterHref = isNext ? (epUrl || url) : url
    const posterTooltip = isNext && !unstarted && item.episodeTitle ? (epCode ? `${epCode} — ${item.episodeTitle}` : item.episodeTitle) : ""

    this.innerHTML = `
      <article class="item-card${watched && !isCurrentlyWatching ? " trending-watched" : ""}${(isCurrentlyWatching || (!watched && inWatchlist && !isNext)) ? " trending-watchlisted" : ""}" ${dataAttrs} aria-label="${escapeHtml(title)}">
        ${(() => {
          const inner = img ? `<img class="poster" src="${escapeHtml(img)}" alt=""${imgLazy} draggable="false" />` : `<div class="poster poster--placeholder" aria-hidden="true" style="background:${placeholderGradient(title)}"></div>`
          return posterHref
            ? `<a class="poster-anchor" href="${escapeHtml(posterHref)}" target="_blank" rel="noreferrer"${posterTooltip ? ` title="${escapeHtml(posterTooltip)}"` : ""}>${inner}</a>`
            : `<div class="poster-anchor">${inner}</div>`
        })()}
        <div class="poster-top">
          <div class="poster-top-text">
            <div class="poster-title">
              ${url ? `<a class="poster-title-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>` : `<span class="poster-title-link">${escapeHtml(title)}</span>`}
            </div>
            ${(showYear || showRuntime) ? `<div class="poster-meta-row">
              ${showYear ? `<span class="poster-title-meta">${escapeHtml(String(year))}</span>` : ""}
              ${showRuntime ? `<span class="poster-runtime">${escapeHtml(runtimeLabel)}</span>` : ""}
            </div>` : ""}
            ${unstartedEpLabel ? `<span class="poster-episode-count">${escapeHtml(unstartedEpLabel)}</span>` : ""}
            ${showRating ? `<span class="poster-status poster-status--${ratingLabel.toLowerCase()}" title="${ratingLabel} rating: ${ratingText}/10" aria-label="${ratingLabel} rating ${ratingText} out of 10">★ ${ratingText}</span>` : ""}
          </div>
        </div>
        <div class="poster-bottom">
          ${epCode ? `<a class="poster-episode" href="${escapeHtml(epUrl)}" target="_blank" rel="noreferrer">${escapeHtml(epCode)}${item.episodeTitle ? `: ${escapeHtml(item.episodeTitle)}` : ""}</a>` : ""}
          ${watchedRating != null ? `<span class="poster-status poster-status--rating" title="Rated ${watchedRating}/10" aria-label="Rated ${watchedRating} out of 10">★ ${watchedRating}</span>` : ""}
          ${showWatchingBadge ? `<span class="poster-status poster-status--watchlist" title="Watching" aria-label="Watching">${ICON_EYE}<span>Watching</span></span>` : ""}
          ${showWatchedBadge && watchedAgo ? `<span class="poster-status poster-status--watchlist" title="Watched ${escapeHtml(watchedAgo)}" aria-label="Watched ${escapeHtml(watchedAgo)}">${ICON_EYE}<span>${escapeHtml(watchedAgo)}</span></span>` : ""}
          ${showWatchlistBadge ? `<span class="poster-status poster-status--watchlist" title="On watchlist" aria-label="On watchlist">${ICON_BOOKMARK}<span>Watchlist</span></span>` : ""}
        </div>
        ${showProgress ? `<div class="poster-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPct}" aria-label="${watchedEps} of ${totalEps} episodes watched"><div class="poster-progress-fill" style="width: ${progressPct}%"></div></div>` : ""}
        ${showMarkWatched ? `<button class="mark-watched-btn" title="I've watched this" aria-label="Mark as watched">${ICON_CHECK}</button>` : ""}
        ${showAddWatchlist ? `<button class="add-watchlist-btn" title="Add to watchlist" aria-label="Add to watchlist" data-title="${escapeHtml(title)}">+</button>` : ""}
        ${showMoreLike ? `<button class="more-like-btn" title="More like this" aria-label="More like this">${ICON_SPARKLE}</button>` : ""}
      </article>
    `

    this.querySelector(".mark-watched-btn")?.addEventListener("click", () => this._emit("mark-watched"))
    this.querySelector(".add-watchlist-btn")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._emit("add-watchlist"); })
    this.querySelector(".more-like-btn")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._emit("more-like-this"); })

    this._maybeObservePoster()
  }

  _maybeObservePoster() {
    const { item, type } = this
    if (!item || item.posterUrl) return posterObserver?.unobserve(this)
    if (!item.ids?.tmdb && !item.ids?.imdb && !(item.title && item.year && type)) return
    getPosterObserver().observe(this)
  }

  async _hydratePoster() {
    const { item, type } = this
    if (!item || item.posterUrl) return
    const url = (item.ids?.tmdb || item.ids?.imdb)
      ? await tmdbRepository.getPosterByIds({ tmdb: item.ids.tmdb, imdb: item.ids.imdb, type })
      : await tmdbRepository.getPosterByTitle(item.title, item.year, type)
    if (!url || this.item !== item) return
    item.posterUrl = url
    this.refresh()
  }
}

let posterObserver = null
function getPosterObserver() {
  if (posterObserver) return posterObserver
  posterObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      posterObserver.unobserve(entry.target)
      entry.target._hydratePoster()
    }
  }, { rootMargin: "200px" })
  return posterObserver
}
customElements.define("poster-card", PosterCard)

class PostersRow extends HTMLElement {}
customElements.define("posters-row", PostersRow)

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

// ── Internal helpers ──

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
function formatWatchedAgo(iso) {
  const diff = new Date(iso).getTime() - Date.now()
  if (!iso || Number.isNaN(diff)) return ""
  const [unit, ms] = relativeTimeUnits.find(([, ms]) => Math.abs(diff) >= ms) || relativeTimeUnits.at(-1)
  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(Math.round(diff / ms), unit)
}

const ICON_EYE = `<svg class="poster-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`
const ICON_BOOKMARK = `<svg class="poster-status-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`
const ICON_CHECK = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
const ICON_SPARKLE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(255,255,255,0.75)" aria-hidden="true"><path d="M12 2l1.8 5.4L19 9l-5.2 1.6L12 16l-1.8-5.4L5 9l5.2-1.6L12 2z"/><path d="M18 14l.9 2.7L21.6 18l-2.7.9L18 21l-.9-2.1L14.4 18l2.7-.9L18 14z"/></svg>`
