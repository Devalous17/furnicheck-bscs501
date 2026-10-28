(() => {
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const debugOverlay = document.getElementById("debug-overlay");
  const categories = ["All", "Tables", "Cabinet"];
  let activeCategory = "All";
  let searchTerm = "";
  let favorites = readFavorites();
  let toastTimer;
  let logoTaps = 0;
  let logoTapTimer;

  const icons = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.3 4.3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10.1-8.8 10.1S3.2 14 3.2 8.8A4.5 4.5 0 0 1 12 6.6a4.5 4.5 0 0 1 8.8 2.2Z"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg>',
    sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/><circle cx="8" cy="18" r="2" fill="white"/></svg>',
    table: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8h18v3H3zm3 3v9m12-9v9M6 20h12"/></svg>',
    ar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4H5a1 1 0 0 0-1 1v3m12-4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m12-4v3a1 1 0 0 1-1 1h-3"/><circle cx="12" cy="12" r="3.5"/><path d="m10.5 12 1 1 2-2"/></svg>'
  };

  function readFavorites() {
    try {
      const saved = localStorage.getItem("furnicheck-favorites");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter(id => FURNITURE.some(item => item.id === id)) : [];
    } catch (error) {
      return [];
    }
  }

  function persistFavorites() {
    try {
      localStorage.setItem("furnicheck-favorites", JSON.stringify(favorites));
    } catch (error) {
      // Favorites remain available in memory when storage is disabled.
    }
  }

  function icon(name) {
    return icons[name] || "";
  }

  document.querySelectorAll("[data-icon]").forEach(node => {
    node.innerHTML = icon(node.dataset.icon);
  });

  function setActiveNav(route) {
    document.querySelectorAll(".nav-link").forEach(link => {
      const active = link.dataset.route === route;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function routeInfo() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    const route = parts[0] === "home" ? "catalog" : (parts[0] || "catalog");
    return { route, id: parts[1] || "" };
  }

  function getFurniture(id) {
    return FURNITURE.find(item => item.id === id);
  }

  function dimensions(item) {
    return `W ${item.width} × L ${item.length} × H ${item.height} cm`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function matches(item, term, category) {
    const query = term.trim().toLowerCase();
    const matchesText = !query || `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(query);
    const matchesCategory = category === "All"
      || (category === "Cabinet" ? item.id === "cabinet" : item.category === category);
    return matchesText && matchesCategory;
  }

  function searchMarkup(value, withFilter) {
    return `${withFilter ? `<button class="icon-button filter-button" type="button" aria-label="Show all categories">${icon("sliders")}</button>` : ""}<div class="search-wrap">
      <span class="search-icon">${icon("search")}</span>
      <input class="search-input" type="search" placeholder="Search furniture" value="${escapeHtml(value)}" aria-label="Search furniture" autocomplete="off">
    </div>`;
  }

  function chipsMarkup(selected, includeAll, compact) {
    const items = includeAll ? categories : categories.slice(1);
    return `<div class="chips" role="group" aria-label="Furniture categories">${items.map(category => {
      const selectedCategory = category === selected;
      const categoryIcon = category === "All" ? "grid" : "table";
      return `<button type="button" class="chip${selectedCategory ? " is-active" : ""}" data-category="${category}" aria-pressed="${selectedCategory}">
        ${compact ? icon(categoryIcon) : ""}<span>${category}</span>
      </button>`;
    }).join("")}</div>`;
  }

  function cardMarkup(item) {
    const saved = favorites.includes(item.id);
    return `<article class="furniture-card" data-open-id="${item.id}" tabindex="0" aria-label="View ${escapeHtml(item.name)}">
      <div class="card-image-wrap">
        <img class="card-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" draggable="false">
        <button class="heart-button${saved ? " is-saved" : ""}" type="button" data-favorite-id="${item.id}" aria-label="${saved ? "Remove from" : "Add to"} saved furniture" aria-pressed="${saved}">
          ${icon("heart")}
        </button>
      </div>
      <h3 class="card-title">${escapeHtml(item.name)}</h3>
      <p class="card-dimensions">${dimensions(item)}</p>
    </article>`;
  }

  function renderCatalog() {
    const filtered = FURNITURE.filter(item => matches(item, searchTerm, activeCategory));
    app.className = "screen catalog-screen";
    app.innerHTML = `<div class="catalog-title-row">
      <h1 class="catalog-title">Furniture</h1>
      <button class="brand-mark debug-logo" type="button" aria-label="FurniCheck diagnostics">🛋️</button>
    </div>
      <div class="search-row">${searchMarkup(searchTerm, true)}</div>
      ${chipsMarkup(activeCategory, true, true)}
      <section class="grid" aria-label="Furniture catalog">${filtered.map(cardMarkup).join("") || `<div class="empty-state"><h2>No furniture found</h2><p>Try a different search or category.</p></div>`}</section>`;
    setActiveNav("catalog");
    bindCommonEvents();
    app.querySelector(".debug-logo").addEventListener("click", onLogoTap);
    app.querySelector(".search-input").addEventListener("input", event => {
      const cursor = event.target.selectionStart;
      searchTerm = event.target.value;
      renderCatalog();
      const input = app.querySelector(".search-input");
      input.focus();
      input.setSelectionRange(cursor, cursor);
    });
    app.querySelector(".filter-button").addEventListener("click", () => {
      activeCategory = "All";
      renderCatalog();
    });
    app.querySelectorAll(".chip").forEach(button => button.addEventListener("click", () => {
      activeCategory = button.dataset.category;
      renderCatalog();
    }));
  }

  function renderDetails(id) {
    const item = getFurniture(id);
    if (!item) {
      location.hash = "#/catalog";
      return;
    }
    app.className = "screen detail-screen";
    app.innerHTML = `<div class="detail-toolbar">
      <button class="round-button back-button" type="button" aria-label="Go back">${icon("back")}</button>
      <button class="round-button heart-button${favorites.includes(item.id) ? " is-saved" : ""}" type="button" data-favorite-id="${item.id}" aria-label="${favorites.includes(item.id) ? "Remove from" : "Add to"} saved furniture" aria-pressed="${favorites.includes(item.id)}">${icon("heart")}</button>
    </div>
    <img class="detail-image" src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" draggable="false">
    <section class="detail-content">
      <p class="detail-category">${escapeHtml(item.id === "cabinet" ? "Cabinet" : item.category.slice(0, -1) || item.category)}</p>
      <div class="detail-heading"><h1>${escapeHtml(item.name)}</h1></div>
      <p class="detail-description">${escapeHtml(item.description)}</p>
      <div class="dimension-card">
        <h2 class="dimension-title">Actual Dimensions</h2>
        <div class="dimension-values">
          <div class="dimension"><strong>${item.width} cm</strong><span>Width</span></div>
          <div class="dimension"><strong>${item.length} cm</strong><span>Length</span></div>
          <div class="dimension"><strong>${item.height} cm</strong><span>Height</span></div>
        </div>
      </div>
      <button class="ar-button" type="button" ${item.hasAR ? "" : "disabled"}>
        <span class="ar-copy"><strong>${item.hasAR ? "View in AR" : "AR model not available"}</strong>${item.hasAR ? "<small>Preview at actual size</small>" : ""}</span>
        ${item.hasAR ? icon("ar") : ""}
      </button>
    </section>`;
    setActiveNav("");
    app.querySelector(".back-button").addEventListener("click", goBack);
    app.querySelector(`[data-favorite-id="${item.id}"]`).addEventListener("click", () => toggleFavorite(item.id));
    if (item.hasAR) app.querySelector(".ar-button").addEventListener("click", () => openAR(item.id));
  }

  function renderSaved() {
    const savedItems = FURNITURE.filter(item => favorites.includes(item.id));
    app.className = "screen catalog-screen";
    app.innerHTML = `<div class="catalog-title-row"><h1 class="catalog-title">Saved</h1></div>
      ${savedItems.length
        ? `<section class="grid" aria-label="Saved furniture">${savedItems.map(cardMarkup).join("")}</section>`
        : `<section class="empty-state">${icon("heart")}<h2>No saved furniture yet</h2><p>Tap the heart on a piece of furniture to keep it here.</p></section>`}`;
    setActiveNav("saved");
    bindCommonEvents();
  }

  function bindCommonEvents() {
    app.querySelectorAll("[data-open-id]").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("[data-favorite-id]")) return;
        location.hash = `#/furniture/${card.dataset.openId}`;
      });
      card.addEventListener("keydown", event => {
        if (event.target.closest("[data-favorite-id]")) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          location.hash = `#/furniture/${card.dataset.openId}`;
        }
      });
    });
    app.querySelectorAll("[data-favorite-id]").forEach(button => button.addEventListener("click", event => {
      event.stopPropagation();
      toggleFavorite(button.dataset.favoriteId);
    }));
  }

  function toggleFavorite(id) {
    favorites = favorites.includes(id) ? favorites.filter(favoriteId => favoriteId !== id) : [...favorites, id];
    persistFavorites();
    render();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function openAR(id) {
    if (window.Unity && typeof window.Unity.call === "function") {
      window.Unity.call("openAR:" + id);
    } else {
      showToast("AR is available in the app");
    }
  }

  function goBack() {
    if (history.length > 1 && history.state && history.state.furnicheckRoute) {
      history.back();
    } else {
      location.hash = "#/catalog";
    }
  }

  function updateDebugOverlay() {
    debugOverlay.textContent = `innerWidth: ${window.innerWidth}px\ninnerHeight: ${window.innerHeight}px\ndevicePixelRatio: ${window.devicePixelRatio}`;
  }

  function onLogoTap() {
    logoTaps += 1;
    clearTimeout(logoTapTimer);
    logoTapTimer = setTimeout(() => { logoTaps = 0; }, 1200);
    if (logoTaps >= 5) {
      logoTaps = 0;
      debugOverlay.hidden = !debugOverlay.hidden;
      if (!debugOverlay.hidden) updateDebugOverlay();
    }
  }

  function render() {
    const { route, id } = routeInfo();
    if (route === "catalog") renderCatalog();
    else if (route === "furniture") renderDetails(id);
    else if (route === "saved") renderSaved();
    else renderCatalog();
    history.replaceState({ furnicheckRoute: route }, "");
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("resize", () => {
    if (!debugOverlay.hidden) updateDebugOverlay();
  });
  if (!location.hash || location.hash === "#/home") location.replace("#/catalog");
  else render();
  window.openAR = openAR;
})();
