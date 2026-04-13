window.createTrendingFeature = function createTrendingFeature({
  els,
  escapeHtml,
  fetchSimklDetails,
  getAccessToken,
  getAllSimklIds,
  getSimklId,
  initDockEffect,
  loadSuggestions,
  renderPosterCard,
  renderPosterMedia,
  renderPosterTopText,
  setGlobalStatus,
  simklFetch,
  state,
}) {
  const ADD_WATCHLIST_BTN_IMG = `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAArCAMAAAAHZIWCAAAAM1BMVEX+/v7////////////////5+fn////y8vLv7+/////////////19fX///8AAADw8PD///9qscvVAAAAD3RSTlOhUEBwkLUg3O8wgGDIEAAqdR4JAAABw0lEQVR42qWX25aDIAxFUS7FhED+/2tnudpOtAnRzpxHhW1uhBj6XGWB3Aa/NVqGpTjrZyzCPNhSDUhfsTCzp7zcZRFUvlKNdINFafAdDaALFoEmPTIAhObTNGtRpIYk2VCeLlNWaYq09u4uyEWxbKNGVOGNytHFYgW1bOtam4pCUix6zFFlXcmBNTqzikLx+t68hzweQqETTcKyPsbwPgK8C7soadgmLANVTyg+5pOqLjV6sXSsxJDCTwlJ+MrNnSUoZVZ+hbefVFmpPVmJteLZrKSqTAl21sqGytmbeGYVNrT1IB4aLoLUx5WT/OgBWUni0w52FQwN5bkWBrPvpY89A0I9fiPZ3ZstwWRPEt8N2XbBJGHg2uXHa1O5cuNl58ROWHXzOKsvMpsC+vVl1730hcyi7BxIhtl5lANIWbWp6YZgNhGpdMl/+kWtVp9w+lc7jhappVjkgTZrFLevxj5T1CjpqzusGu9tbbaD/j1UbNSYoITV6a/3Y7DubVT3NioUDvfeFm3fzxOtTOec+N2cM9Cfv/jf85eoBL6lkejWvDouSRXo5hxN2FxSxq/m+xLzsH3Lznw/14bQPv47sDjrfwC+y7YtuwdeggAAAABJRU5ErkJggg==" alt="" style="width:20px;height:auto;display:block;opacity:0.55;filter:brightness(10)" />`;

  let trendingLoadedPeriod = null;

  function renderTrendingRow(items, urlBaseOverride) {
    return `<div class="trending-carousel"><div class="trending-row">${items.map((m) => {
      const title = m.title || "";
      const year = m.year || "";
      const imgCode = m.poster || m.img || "";
      const posterUrl = imgCode ? `https://wsrv.nl/?url=https://simkl.in/posters/${imgCode}_m.webp` : "";
      const simklId = getSimklId(m);
      const fixedPath = m.url ? m.url.replace(/^\/movie\//, "/movies/") : null;
      const url = fixedPath ? `https://simkl.com${fixedPath}` : simklId ? `https://simkl.com/${urlBaseOverride}/${simklId}` : "#";
      const watched = simklId && state.libraryIds.has(String(simklId));
      const loggedIn = !!getAccessToken();
      const media = renderPosterMedia({ posterUrl, title, loading: "lazy" });
      const topText = renderPosterTopText({
        title,
        imdbRating: !watched ? m.ratings?.imdb?.rating : "",
        subtext: year ? String(year) : "",
      });
      const body = loggedIn && simklId && !watched
        ? `<button class="add-watchlist-btn" title="Add ${escapeHtml(title)} to watchlist" data-title="${escapeHtml(title)}" data-year="${year}">${ADD_WATCHLIST_BTN_IMG}</button>`
        : "";
      return renderPosterCard({
        cardTag: "a",
        cardClass: watched ? "trending-watched" : "",
        cardAttrs: `href="${escapeHtml(url)}" target="_blank" rel="noreferrer" data-simkl-id="${simklId || ""}" data-url-base="${escapeHtml(urlBaseOverride)}" data-title="${escapeHtml(title)}" data-year="${year || ""}"`,
        media,
        topText,
        body,
      });
    }).join("")}</div></div>`;
  }

  async function ensureLibraryIds() {
    if (state.libraryIds.size > 0 || !getAccessToken()) return;
    try {
      const [sRes, mRes] = await Promise.all([
        simklFetch("https://api.simkl.com/sync/all-items/shows/?status=watching,plantowatch,completed").catch(() => ({})),
        simklFetch("https://api.simkl.com/sync/all-items/movies/?status=watching,plantowatch,completed").catch(() => ({})),
      ]);
      state.libraryIds = new Set([
        ...(sRes.shows || []).flatMap(getAllSimklIds),
        ...(mRes.movies || []).flatMap(getAllSimklIds),
      ]);
    } catch (_) {}
  }

  async function enrichTrendingRatings(items, apiType, containerEl) {
    const details = await fetchSimklDetails(apiType, items);
    details.forEach((detail, i) => {
      if (!detail?.ratings?.imdb?.rating) return;
      const simklId = getSimklId(items[i]);
      const card = containerEl.querySelector(`[data-simkl-id="${simklId}"]`);
      if (!card || card.classList.contains("trending-watched") || card.querySelector(".imdb-badge")) return;
      const badge = `<span class="imdb-badge">IMDb ${detail.ratings.imdb.rating}</span>`;
      const textContainer = card.querySelector(".poster-top-text");
      (textContainer || card).insertAdjacentHTML("beforeend", badge);
    });
  }

  function setupWatchlistBtn(btn) {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest(".item-card");
      const simklId = card?.dataset.simklId;
      const urlBase = card?.dataset.urlBase;
      const title = btn.dataset.title;
      if (!simklId || !urlBase) return;
      btn.disabled = true;
      const key = urlBase === "movies" ? "movies" : "shows";
      try {
        await simklFetch("https://api.simkl.com/sync/add-to-list", {
          method: "POST",
          body: JSON.stringify({ [key]: [{ to: "plantowatch", ids: { simkl: Number(simklId) } }] }),
        });
        state.libraryIds.add(simklId);
        btn.remove();
        card.classList.add("trending-watched");
        setGlobalStatus(`Added "${title}" to watchlist.`);
        loadSuggestions();
      } catch (err) {
        btn.disabled = false;
        setGlobalStatus(err.message || "Failed to add to watchlist.", true);
      }
    });
  }

  function restoreTrendingCards(simklId) {
    state.libraryIds.delete(String(simklId));
    if (!getAccessToken()) return;
    for (const card of document.querySelectorAll(`#trendingMoviesContent [data-simkl-id="${simklId}"], #trendingTvContent [data-simkl-id="${simklId}"]`)) {
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
    history.replaceState(null, "", `#trending/${period}`);
    const moviesEl = document.getElementById("trendingMoviesContent");
    const tvEl = document.getElementById("trendingTvContent");
    moviesEl.innerHTML = tvEl.innerHTML = `<p class="empty">Loading…</p>`;
    const load = (type) => fetch(`https://data.simkl.in/discover/trending/${type}/${encodeURIComponent(period)}_100.json`).then((r) => r.json());
    try {
      const [moviesData, tvData] = await Promise.all([load("movies"), load("tv"), ensureLibraryIds()]);
      const movies = Array.isArray(moviesData) ? moviesData.slice(0, 12) : [];
      const tv = Array.isArray(tvData) ? tvData.slice(0, 12) : [];
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
