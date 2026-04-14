window.createStatsFeature = function createStatsFeature({
  Chart,
  countBy,
  escapeHtml,
  makeBarChart,
  normalizeList,
  normalizeStatus,
  provider,
  showView,
  statsContent,
  statsView,
  makePieChart,
  genreColors,
}) {
  let statsRawData = null;

  function minsToDaysHours(mins) {
    const totalHours = Math.floor(mins / 60);
    const d = Math.floor(totalHours / 24);
    const h = totalHours % 24;
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    return h > 0 ? `${h}h` : "0h";
  }

  function renderStatsShell({ rangeLabel, showMins, movieMins }) {
    return `
      <div class="stats-time">
        <div class="stats-time-item">
          <span class="stats-time-label">${escapeHtml(rangeLabel)}</span>
          <span class="stats-time-value">${escapeHtml(minsToDaysHours(showMins + movieMins))}</span>
          <span class="stats-time-sub">
            <span class="stats-time-tv">${escapeHtml(minsToDaysHours(showMins))} TV</span>
            <span class="stats-time-movie">${escapeHtml(minsToDaysHours(movieMins))} movies</span>
          </span>
        </div>
      </div>
      <div id="statsStatus" class="stats-status"></div>
      <div class="stats-charts">
        <div class="stats-chart-wrap">
          <h3>Watch activity
            <span class="chart-mode-tabs">
              <button class="chart-mode-tab active" data-mode="count">Count</button>
              <button class="chart-mode-tab" data-mode="runtime">Runtime</button>
            </span>
          </h3>
          <canvas id="chartActivity"></canvas>
        </div>
        <div class="stats-row">
          <div class="stats-chart-wrap">
            <h3>Your ratings</h3>
            <canvas id="chartRatings"></canvas>
          </div>
          <div class="stats-chart-wrap">
            <h3>Day of week</h3>
            <canvas id="chartDow"></canvas>
          </div>
        </div>
        <div class="stats-chart-wrap">
          <h3>Release year</h3>
          <div class="chart-scroll-x">
            <canvas id="chartYear"></canvas>
          </div>
        </div>
        <div class="stats-genres">
          <div class="stats-chart-wrap">
            <h3>Movie genres</h3>
            <canvas id="chartMovieGenres"></canvas>
          </div>
          <div class="stats-chart-wrap">
            <h3>TV genres</h3>
            <canvas id="chartTvGenres"></canvas>
          </div>
        </div>
      </div>`;
  }

  function topN(countMap, n) {
    return Object.entries(countMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }

  function initStatsCharts(shows, movies, tvDetails, movieDetails, range = "all") {
    const STATUS_META = {
      watching: { label: "Watching", color: "#22c55e" },
      completed: { label: "Completed", color: "#60a5fa" },
      hold: { label: "On hold", color: "#f59e0b" },
      dropped: { label: "Dropped", color: "#ef4444" },
      plantowatch: { label: "Plan to watch", color: "#8b5cf6" },
    };
    const allItems = [...shows, ...movies];
    const statusCounts = countBy(allItems.map((i) => ({ s: normalizeStatus(i.status) })), "s");
    const statusEl = document.getElementById("statsStatus");
    statusEl.innerHTML = Object.entries(STATUS_META)
      .filter(([k]) => statusCounts[k])
      .map(([k, { label, color }]) => `
        <div class="stats-status-item">
          <span class="stats-status-count" style="color:${color}">${statusCounts[k]}</span>
          <span class="stats-status-label">${escapeHtml(label)}</span>
        </div>`)
      .join("");

    const now = new Date();
    let buckets;
    if (range === "30d") {
      buckets = Array.from({ length: 30 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const label = d.toLocaleString("default", { month: "short", day: "numeric" });
        return { key, label, match: (item) => item.last_watched_at?.slice(0, 10) === key };
      });
    } else if (range === "6m") {
      buckets = Array.from({ length: 26 }, (_, i) => {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (25 - i) * 7);
        const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6);
        const label = weekStart.toLocaleString("default", { month: "short", day: "numeric" });
        return {
          label,
          match: (item) => {
            if (!item.last_watched_at) return false;
            const d = new Date(item.last_watched_at);
            return d >= weekStart && d <= weekEnd;
          },
        };
      });
    } else {
      const allWatched = [...shows, ...movies].map((i) => i.last_watched_at).filter(Boolean);
      const minYear = allWatched.length ? Math.min(...allWatched.map((d) => new Date(d).getFullYear())) : now.getFullYear();
      const maxYear = now.getFullYear();
      buckets = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
        const year = minYear + i;
        return { label: String(year), match: (item) => item.last_watched_at && new Date(item.last_watched_at).getFullYear() === year };
      });
    }

    const bucketLabels = buckets.map(({ label }) => label);
    function activityDatasets(mode) {
      const agg = (items) => buckets.map(({ match }) => {
        const matched = items.filter(match);
        return mode === "runtime"
          ? Math.round(matched.reduce((s, i) => s + (i.runtime || 0), 0) / 60)
          : matched.length;
      });
      return [
        { label: "TV Shows", data: agg(shows), backgroundColor: "#22c55ecc", borderColor: "#22c55e", borderWidth: 1, borderRadius: 4 },
        { label: "Movies", data: agg(movies), backgroundColor: "#60a5facc", borderColor: "#60a5fa", borderWidth: 1, borderRadius: 4 },
      ];
    }
    function yActivityLabel(mode) {
      return mode === "runtime" ? { title: { display: true, text: "Hours", color: "#94a3b8", font: { size: 11 } } } : {};
    }
    function renderActivityChart(mode) {
      const canvas = document.getElementById("chartActivity");
      Chart.getChart(canvas)?.destroy();
      new Chart(canvas, {
        type: "bar",
        data: { labels: bucketLabels, datasets: activityDatasets(mode) },
        options: {
          responsive: true,
          plugins: {
            legend: { labels: { color: "#f9fafb", boxWidth: 12, padding: 10 } },
            tooltip: { mode: "index", callbacks: mode === "runtime" ? { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y}h` } : {} },
          },
          scales: {
            x: { ticks: { color: "#94a3b8" }, grid: { color: "#1f2937" } },
            y: { ticks: { color: "#94a3b8" }, grid: { color: "#1f2937" }, ...yActivityLabel(mode) },
          },
        },
      });
    }
    renderActivityChart("count");
    statsContent.querySelectorAll(".chart-mode-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        statsContent.querySelectorAll(".chart-mode-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderActivityChart(btn.dataset.mode);
      });
    });

    const ratingLabels = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];
    const showRatings = countBy(shows, "user_rating");
    const movieRatings = countBy(movies, "user_rating");
    makeBarChart("chartRatings", ratingLabels, [
      { label: "TV Shows", data: ratingLabels.map((r) => showRatings[r] || 0), backgroundColor: "#22c55ecc", borderColor: "#22c55e", borderWidth: 1, borderRadius: 4 },
      { label: "Movies", data: ratingLabels.map((r) => movieRatings[r] || 0), backgroundColor: "#60a5facc", borderColor: "#60a5fa", borderWidth: 1, borderRadius: 4 },
    ]);

    const dowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    function dowCounts(items) {
      const map = [0, 0, 0, 0, 0, 0, 0];
      for (const item of items) {
        if (!item.last_watched_at) continue;
        const day = new Date(item.last_watched_at).getDay();
        map[(day + 6) % 7]++;
      }
      return map;
    }
    makeBarChart("chartDow", dowLabels, [
      { label: "TV Shows", data: dowCounts(shows), backgroundColor: "#22c55ecc", borderColor: "#22c55e", borderWidth: 1, borderRadius: 4 },
      { label: "Movies", data: dowCounts(movies), backgroundColor: "#60a5facc", borderColor: "#60a5fa", borderWidth: 1, borderRadius: 4 },
    ]);

    const showYears = countBy(shows.map((s) => ({ y: s.year || null })), "y");
    const movieYears = countBy(movies.map((m) => ({ y: m.year || null })), "y");
    const allYears = [...new Set([...Object.keys(showYears), ...Object.keys(movieYears)])].filter(Boolean).sort();
    const yearCanvas = document.getElementById("chartYear");
    const yearScrollWrap = yearCanvas.closest(".chart-scroll-x");
    if (yearScrollWrap) {
      const minWidth = Math.max(allYears.length * 28, yearScrollWrap.parentElement.clientWidth - 32);
      yearCanvas.style.width = `${minWidth}px`;
      yearCanvas.style.height = "220px";
    }
    makeBarChart("chartYear", allYears, [
      { label: "TV Shows", data: allYears.map((y) => showYears[y] || 0), backgroundColor: "#22c55ecc", borderColor: "#22c55e", borderWidth: 1, borderRadius: 2 },
      { label: "Movies", data: allYears.map((y) => movieYears[y] || 0), backgroundColor: "#60a5facc", borderColor: "#60a5fa", borderWidth: 1, borderRadius: 2 },
    ], { responsive: false, maintainAspectRatio: false });

    makePieChart("chartMovieGenres", topN(movieDetails.genres, 10), genreColors);
    makePieChart("chartTvGenres", topN(tvDetails.genres, 10), genreColors);
  }

  function applyStatsRange() {
    const range = statsView.querySelector(".range-tab.active")?.dataset.range || "all";
    const { shows, movies, tvDetails, movieDetails, apiStats } = statsRawData;
    const cutoff = range === "30d" ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : range === "6m" ? new Date(Date.now() - 183 * 24 * 60 * 60 * 1000)
      : null;
    const inRange = (item) => !cutoff || (item.last_watched_at && new Date(item.last_watched_at) >= cutoff);

    const filtShows = shows.filter(inRange);
    const filtMovies = movies.filter(inRange);
    const showMins = range === "all" ? (apiStats.tv?.total_mins || 0) : filtShows.reduce((s, i) => s + (i.runtime || 0), 0);
    const movieMins = range === "all" ? (apiStats.movies?.total_mins || 0) : filtMovies.reduce((s, i) => s + (i.runtime || 0), 0);
    const rangeLabel = { "30d": "Last 30 days", "6m": "Last 6 months", "all": "All time" }[range];

    statsContent.innerHTML = renderStatsShell({ rangeLabel, showMins, movieMins });
    initStatsCharts(filtShows, filtMovies, tvDetails, movieDetails, range);
  }

  async function showStatsView() {
    showView("stats");

    if (!statsRawData) statsRawData = provider.loadStatsCache();

    if (!statsRawData) {
      statsContent.innerHTML = `<p class="empty">Loading…</p>`;
      try {
        const [showsResponse, moviesResponse, settings] = await Promise.all([
          provider.fetch("https://api.simkl.com/sync/all-items/shows/?status=watching,completed,hold,dropped&extended=full"),
          provider.fetch("https://api.simkl.com/sync/all-items/movies/?status=watching,completed,hold,dropped&extended=full"),
          provider.fetch("https://api.simkl.com/users/settings"),
        ]);

        const shows = normalizeList(showsResponse.shows);
        const movies = normalizeList(moviesResponse.movies);
        const userId = settings?.account?.id;
        if (!userId) throw new Error("Could not determine user ID.");

        statsContent.innerHTML = `<p class="empty">Loading details…</p>`;
        const watched = (s) => normalizeStatus(s.status) !== "plantowatch";
        const [apiStats, tvDetails, movieDetails] = await Promise.all([
          provider.fetch(`https://api.simkl.com/users/${encodeURIComponent(userId)}/stats`, { method: "POST" }),
          provider.fetchItemDetails(shows.filter(watched), "tv"),
          provider.fetchItemDetails(movies.filter(watched), "movies"),
        ]);

        statsRawData = { shows, movies, tvDetails, movieDetails, apiStats };
        provider.saveStatsCache(statsRawData);
      } catch (error) {
        statsContent.innerHTML = `<p class="empty" style="color:#fca5a5">${escapeHtml(error.message || "Failed to load stats.")}</p>`;
        return;
      }
    }

    applyStatsRange();
    statsView.querySelectorAll(".range-tab:not([data-wired])").forEach((btn) => {
      btn.dataset.wired = "1";
      btn.addEventListener("click", () => {
        statsView.querySelectorAll(".range-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        history.replaceState(null, "", `#stats/${btn.dataset.range}`);
        applyStatsRange();
      });
    });
  }

  return { showStatsView, applyStatsRange };
};
