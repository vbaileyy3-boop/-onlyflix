/* ---------- HOME ---------- */
const renderHome = async () => {
  $("#hero").style.display = "flex";
  $("#infoBlocks").classList.add("show");
  $("#view").innerHTML = '<div class="boot">Loading…</div>';

  try {
    const [trend, nowp, topm, popt, topt] = await Promise.all([
      api.trendingAll(),
      api.nowPlaying(),
      api.topMovies(),
      api.popularTV(),
      api.topTV()
    ]);

    [trend, nowp, topm, popt, topt].forEach(indexItems);
    await initHero(trend);

    const hist = getHistory();
    const mylist = getList();
    [...hist, ...mylist].forEach(hh => INDEX[hh.id] = hh);

    let html = "";
    if (hist.length) html += continueRowHTML(hist);
    if (mylist.length) html += myListRowHTML(mylist);
    html += rowHTML("Trending Now", trend, 'movie');
    html += rowHTML("Now Playing in Theaters", nowp, 'movie');
    html += rowHTML("Top Rated Movies", topm, 'movie');
    html += rowHTML("Popular TV Shows", popt, 'series');
    html += rowHTML("Top Rated TV Shows", topt, 'series');

    try { html += await buildTrending(); } 
    catch (e) { console.error("[renderHome] buildTrending failed", e); }

    $("#view").innerHTML = html;
    bindTrending();
    restartHeroTimer();
  } catch (err) {
    console.error("[renderHome] failed", err);
    $("#view").innerHTML = `<div class="empty">Failed to load data: ${h(err.message)}</div>`;
  }
};
