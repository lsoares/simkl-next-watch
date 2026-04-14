window.createTrendingFeature = function createTrendingFeature({
  els,
  escapeHtml,
  getProvider,
  initDockEffect,
  loadSuggestions,
  renderPosterEntry,
  setGlobalStatus,
  state,
}) {
  const ADD_WATCHLIST_BTN_IMG = `+`;
  const VISIBLE_TRENDING_SLOTS = 12;

  let trendingLoadedPeriod = null;

  function getTrendingYear(item) {
    const directYear = item?.year ?? item?.release_year ?? item?.start_year;
    if (directYear) return String(directYear);
    const datedValue = item?.released || item?.release_date || item?.first_aired || item?.aired || item?.premiered;
    const match = String(datedValue || "").match(/\b(\d{4})\b/);
    return match ? match[1] : "";
  }

  function renderTrendingRow(items, urlBaseOverride) {
    const provider = getProvider();
    return `<div class="trending-carousel"><div class="trending-row">${items.map((m) => {
      const title = m.title || "";
      const year = getTrendingYear(m);
      const posterSource = m.poster || m.img || "";
      const posterUrl = /^https?:\/\//i.test(String(posterSource || ""))
        ? posterSource
        : posterSource ? `https://wsrv.nl/?url=https://simkl.in/posters/${posterSource}_m.webp` : "";
      const itemId = provider.getPrimaryId(m);
      const fixedPath = m.url ? m.url.replace(/^\/movie\//, "/movies/") : null;
      const url = fixedPath ? `https://simkl.com${fixedPath}` : itemId ? `https://simkl.com/${urlBaseOverride}/${itemId}` : "#";
      const watched = itemId && state.libraryIds.has(String(itemId));
      const loggedIn = !!provider.getAccessToken();
      return renderPosterEntry({
        title,
        titleMeta: !watched && year ? String(year) : "",
        posterUrl,
        loading: "lazy",
        imdbRating: !watched ? m.ratings?.imdb?.rating : "",
        cardTag: "a",
        cardClass: watched ? "trending-watched" : "",
        cardAttrs: `href="${escapeHtml(url)}" target="_blank" rel="noreferrer" data-item-id="${itemId || ""}" data-url-base="${escapeHtml(urlBaseOverride)}" data-title="${escapeHtml(title)}" data-year="${year || ""}"`,
        body: loggedIn && itemId && !watched
          ? `<button class="add-watchlist-btn" title="Add ${escapeHtml(title)} to watchlist" data-title="${escapeHtml(title)}" data-year="${year}">${ADD_WATCHLIST_BTN_IMG}</button>`
          : "",
      });
    }).join("")}</div></div>`;
  }

  async function ensureLibraryIds() {
    const provider = getProvider();
    if (state.libraryIds.size > 0 || !provider.getAccessToken()) return;
    try {
      const [sRes, mRes] = await Promise.all([
        provider.fetch("https://api.simkl.com/sync/all-items/shows/?status=watching,plantowatch,completed").catch(() => ({})),
        provider.fetch("https://api.simkl.com/sync/all-items/movies/?status=watching,plantowatch,completed").catch(() => ({})),
      ]);
      state.libraryIds = new Set([
        ...(sRes.shows || []).flatMap(provider.getAllIds),
        ...(mRes.movies || []).flatMap(provider.getAllIds),
      ]);
    } catch (_) {}
  }

  async function enrichTrendingRatings(items, apiType, containerEl) {
    const provider = getProvider();
    const details = await provider.fetchDetails(apiType, items);
    details.forEach((detail, i) => {
      if (!detail?.ratings?.imdb?.rating) return;
      const itemId = provider.getPrimaryId(items[i]);
      const card = containerEl.querySelector(`[data-item-id="${itemId}"]`);
      if (!card || card.classList.contains("trending-watched") || card.querySelector(".imdb-badge")) return;
      const badge = `<span class="imdb-badge">IMDb ${detail.ratings.imdb.rating}</span>`;
      const textContainer = card.querySelector(".poster-top-text");
      (textContainer || card).insertAdjacentHTML("beforeend", badge);
    });
  }

  function setupWatchlistBtn(btn) {
    btn.addEventListener("click", async (e) => {
      const provider = getProvider();
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest(".item-card");
      const itemId = card?.dataset.itemId;
      const urlBase = card?.dataset.urlBase;
      const title = btn.dataset.title;
      if (!itemId || !urlBase) return;
      btn.disabled = true;
      try {
        await provider.addToWatchlist(urlBase === "movies" ? "movie" : "tv", itemId);
        state.libraryIds.add(itemId);
        btn.remove();
        card.classList.add("trending-watched");
        setGlobalStatus(`Added "${title}" to watchlist.`);
        await loadSuggestions();
        if (els.hideTrendingWatched?.checked) loadTrending();
      } catch (err) {
        btn.disabled = false;
        setGlobalStatus(err.message || "Failed to add to watchlist.", true);
      }
    });
  }

  function selectTrendingItems(items) {
    const provider = getProvider();
    const list = Array.isArray(items) ? items : [];
    if (!els.hideTrendingWatched?.checked) return list.slice(0, VISIBLE_TRENDING_SLOTS);
    return list
      .filter((item) => {
        const itemId = provider.getPrimaryId(item);
        return !itemId || !state.libraryIds.has(String(itemId));
      })
      .slice(0, VISIBLE_TRENDING_SLOTS);
  }

  function restoreTrendingCards(itemId) {
    const provider = getProvider();
    state.libraryIds.delete(String(itemId));
    if (!provider.getAccessToken()) return;
    for (const card of document.querySelectorAll(`#trendingMoviesContent [data-item-id="${itemId}"], #trendingTvContent [data-item-id="${itemId}"]`)) {
      card.classList.remove("trending-watched");
      if (!card.querySelector(".add-watchlist-btn")) {
        const title = card.dataset.title || "";
        const year = card.dataset.year || "";
        card.insertAdjacentHTML("beforeend", `<button class="add-watchlist-btn" title="Add ${escapeHtml(title)} to watchlist" data-title="${escapeHtml(title)}" data-year="${escapeHtml(year)}">${ADD_WATCHLIST_BTN_IMG}</button>`);
        setupWatchlistBtn(card.querySelector(".add-watchlist-btn"));
      }
    }
  }

  async function loadTrending() {
    const period = els.trendingPeriodTabs.querySelector(".range-tab.active")?.dataset.period || "today";
    try { localStorage.setItem("next-watch-trending-period", period); } catch {}
    history.replaceState(null, "", `#trending/${period}`);
    const moviesEl = document.getElementById("trendingMoviesContent");
    const tvEl = document.getElementById("trendingTvContent");
    moviesEl.innerHTML = tvEl.innerHTML = `<p class="empty">Loading…</p>`;
    const load = (type) => fetch(`https://data.simkl.in/discover/trending/${type}/${encodeURIComponent(period)}_100.json`).then((r) => r.json());
    try {
      const [moviesData, tvData] = await Promise.all([load("movies"), load("tv"), ensureLibraryIds()]);
      const movies = selectTrendingItems(moviesData);
      const tv = selectTrendingItems(tvData);
      moviesEl.innerHTML = movies.length ? renderTrendingRow(movies, "movies") : `<p class="empty">No results.</p>`;
      tvEl.innerHTML = tv.length ? renderTrendingRow(tv, "tv") : `<p class="empty">No results.</p>`;
      if (movies.length) enrichTrendingRatings(movies, "movies", moviesEl);
      if (tv.length) enrichTrendingRatings(tv, "tv", tvEl);
      for (const row of document.querySelectorAll("#trendingMoviesContent .trending-row, #trendingTvContent .trending-row")) initDockEffect(row);
      for (const btn of document.querySelectorAll("#trendingMoviesContent .add-watchlist-btn, #trendingTvContent .add-watchlist-btn")) setupWatchlistBtn(btn);
      trendingLoadedPeriod = period;
    } catch (err) {
      const msg = `<p class="empty" style="color:#fca5a5">${escapeHtml(err.message || "Failed to load.")}</p>`;
      moviesEl.innerHTML = tvEl.innerHTML = msg;
    }
  }

  function showTrendingView(showView) {
    showView("trending");
    const period = els.trendingPeriodTabs.querySelector(".range-tab.active")?.dataset.period || "today";
    if (trendingLoadedPeriod !== period) loadTrending();
  }

  return { ensureLibraryIds, enrichTrendingRatings, loadTrending, restoreTrendingCards, setupWatchlistBtn, showTrendingView };
};
