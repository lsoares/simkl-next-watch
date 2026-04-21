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

  get cardEl() { return this.querySelector(".item-card"); }

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

    const showYear = isNext ? unstarted && year : !watched && year
    const showMarkWatched = isNext
    const showAddWatchlist = !isNext && loggedIn && id && !watched && !inWatchlist
    const showRating = !watched && rating != null && (!isNext || unstarted)
    const ratingText = showRating ? (Number.isInteger(rating) ? rating : rating.toFixed(1)) : ""
    const ratingLabel = item.ids?.trakt ? "Trakt" : "Simkl"
    const showWatchedBadge = !isNext && watched
    const watchedAgo = showWatchedBadge && watchedAt ? formatWatchedAgo(watchedAt) : ""
    const watchedRating = showWatchedBadge && userRating != null ? userRating : null
    const showWatchlistBadge = !isNext && inWatchlist && !watched

    const dataAttrs = isNext
      ? `data-simkl-id="${id}" data-type="${type}"`
      : `data-simkl-id="${id}" data-title="${escapeHtml(title)}"`
    const imgLazy = isNext ? "" : ` loading="lazy"`
    const posterHref = isNext ? (epUrl || url) : url
    const posterTooltip = isNext && !unstarted && item.episodeTitle ? (epCode ? `${epCode} — ${item.episodeTitle}` : item.episodeTitle) : ""

    this.innerHTML = `
      <article class="item-card${watched ? " trending-watched" : ""}${!watched && inWatchlist && !isNext ? " trending-watchlisted" : ""}" ${dataAttrs} aria-label="${escapeHtml(title)}">
        ${posterHref ? `<a class="poster-anchor" href="${escapeHtml(posterHref)}" target="_blank" rel="noreferrer"${posterTooltip ? ` title="${escapeHtml(posterTooltip)}"` : ""}>${img ? `<img class="poster" src="${escapeHtml(img)}" alt=""${imgLazy} draggable="false" />` : `<div class="poster poster--placeholder" aria-hidden="true"><span class="poster-placeholder-title">${escapeHtml(title)}</span>${year ? `<span class="poster-placeholder-year">${escapeHtml(String(year))}</span>` : ""}</div>`}</a>` : ""}
        <div class="poster-top">
          <div class="poster-top-text">
            <div class="poster-title">
              ${url ? `<a class="poster-title-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>` : `<span class="poster-title-link">${escapeHtml(title)}</span>`}
            </div>
            ${showYear ? `<span class="poster-title-meta">${escapeHtml(String(year))}</span>` : ""}
            ${unstartedEpLabel ? `<span class="poster-episode-count">${escapeHtml(unstartedEpLabel)}</span>` : ""}
            ${showRating ? `<span class="poster-status poster-status--${ratingLabel.toLowerCase()}" title="${ratingLabel} rating: ${ratingText}/10" aria-label="${ratingLabel} rating ${ratingText} out of 10">★ ${ratingText}</span>` : ""}
          </div>
        </div>
        <div class="poster-bottom">
          ${epCode ? `<a class="poster-episode" href="${escapeHtml(epUrl)}" target="_blank" rel="noreferrer">${escapeHtml(epCode)}${item.episodeTitle ? `: ${escapeHtml(item.episodeTitle)}` : ""}</a>` : ""}
          ${watchedRating != null ? `<span class="poster-status poster-status--watched" title="Rated ${watchedRating}/10" aria-label="Rated ${watchedRating} out of 10">★ ${watchedRating}</span>` : ""}
          ${showWatchedBadge && watchedAgo ? `<span class="poster-status poster-status--watched" title="Watched ${escapeHtml(watchedAgo)}" aria-label="Watched ${escapeHtml(watchedAgo)}">${ICON_EYE}<span>${escapeHtml(watchedAgo)}</span></span>` : ""}
          ${showWatchlistBadge ? `<span class="poster-status poster-status--watchlist" title="On watchlist" aria-label="On watchlist">${ICON_BOOKMARK}<span>Watchlist</span></span>` : ""}
        </div>
        ${showMarkWatched ? `<button class="mark-watched-btn" title="I've watched this" aria-label="Mark as watched">${ICON_CHECK}</button>` : ""}
        ${showAddWatchlist ? `<button class="add-watchlist-btn" title="Add to watchlist" aria-label="Add to watchlist" data-title="${escapeHtml(title)}">+</button>` : ""}
      </article>
    `

    this.querySelector(".mark-watched-btn")?.addEventListener("click", () => this._emit("mark-watched"))
    this.querySelector(".add-watchlist-btn")?.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); this._emit("add-watchlist"); })
  }
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
  const notAired = show.not_aired_episodes_count || 0
  const watched = show.watched_episodes_count || 0
  return total > 0 ? Math.max(0, total - notAired - watched) : Infinity
}

// ── Internal helpers ──

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
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
