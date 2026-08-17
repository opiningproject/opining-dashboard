/* ==========================================================================
   Opining — dashboard shell
   Vanilla JS, geen dependencies. Vier verantwoordelijkheden:
     1. Sidebar collapse (icon rail)   → <html data-sidebar>
     2. Mobiele drawer                 → <html data-drawer>
     3. Panel-wissel main ⇄ settings   → <html data-nav>
     4. Pagina-state (welke view staat aan + onthouden waar je vandaan komt)
   In een SPA-framework vervang je §4 door de router; de rest blijft 1-op-1.
   ========================================================================== */
(function () {
  "use strict";

  var root      = document.documentElement;
  var sidebar   = document.getElementById("sidebar");
  var panelMain = document.getElementById("panel-main");
  var panelSet  = document.getElementById("panel-settings");
  var scrim     = document.getElementById("scrim");
  var savebar   = document.getElementById("savebar");

  var btnCollapse = document.getElementById("collapse-toggle");
  var btnDrawer   = document.getElementById("drawer-toggle");
  var btnSettings = document.getElementById("open-settings");
  var btnBack     = document.getElementById("close-settings");

  var pageTitle = document.getElementById("page-title");
  var pageIcon  = document.getElementById("page-icon");
  var views     = document.querySelectorAll(".view");

  var mqMobile = window.matchMedia("(max-width: 900px)");

  /* Onthoudt waar de gebruiker was vóór hij settings opende, zodat de
     back-knop exact daarheen terugkeert. */
  var lastMain = { page: "dashboard", title: "Dashboard", icon: "i-home" };
  var collapsedBeforeSettings = false;

  /* ========================================================================
     1. SIDEBAR COLLAPSE
     ======================================================================== */
  var tipItems = sidebar.querySelectorAll(".nav__item[data-tip]");

  function setCollapsed(collapsed) {
    root.dataset.sidebar = collapsed ? "collapsed" : "expanded";

    /* In de rail zie je alleen iconen → naam als native tooltip. */
    tipItems.forEach(function (el) {
      if (collapsed && !mqMobile.matches) el.setAttribute("title", el.dataset.tip);
      else el.removeAttribute("title");
    });

    syncCollapseLabel();
    try { localStorage.setItem("opining:sidebar", root.dataset.sidebar); } catch (e) {}
  }

  function syncCollapseLabel() {
    var label = root.dataset.sidebar === "collapsed" ? "Expand sidebar" : "Collapse sidebar";
    btnCollapse.setAttribute("aria-label", label);
    btnCollapse.setAttribute("title", label);
  }

  try {
    var stored = localStorage.getItem("opining:sidebar");
    if (stored === "collapsed") setCollapsed(true);
  } catch (e) {}

  /* Deze knop bestaat alleen op desktop; onder 900px neemt de topbar-knop
     het over (zie .icon-btn.topbar__burger in styles.css). */
  btnCollapse.addEventListener("click", function () {
    setCollapsed(root.dataset.sidebar !== "collapsed");
  });

  /* ========================================================================
     2. MOBIELE DRAWER
     ======================================================================== */
  function setDrawer(open) {
    root.dataset.drawer = open ? "open" : "closed";
    btnDrawer.setAttribute("aria-expanded", String(open));
    btnDrawer.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    scrim.hidden = !open;
    if (open) {
      var first = sidebar.querySelector('.panel[data-active="true"] .nav__item') ||
                  sidebar.querySelector(".nav__item");
      if (first) first.focus({ preventScroll: true });
    }
  }

  btnDrawer.addEventListener("click", function () { setDrawer(root.dataset.drawer !== "open"); });
  scrim.addEventListener("click", function () { setDrawer(false); });
  mqMobile.addEventListener("change", function (e) {
    if (!e.matches) setDrawer(false);
    setCollapsed(root.dataset.sidebar === "collapsed");
  });

  /* ========================================================================
     3. PANEL-WISSEL: main ⇄ settings
     ======================================================================== */
  /* De sidebar is een overflow:hidden venster op een dubbelbrede track.
     Focus op een element in het weggeschoven panel laat de browser die
     container horizontaal meescrollen — dat zet de hele nav scheef.
     Daarom: alle focus() met preventScroll én deze harde terugzet. */
  sidebar.addEventListener("scroll", function () { sidebar.scrollLeft = 0; });

  function setPanel(name) {
    root.dataset.nav = name;

    var toSettings = name === "settings";
    panelMain.dataset.active = String(!toSettings);
    panelSet.dataset.active  = String(toSettings);

    /* Het verborgen panel mag geen tab-stops bevatten. */
    panelMain.inert = toSettings;
    panelSet.inert  = !toSettings;
  }

  function openSettings() {
    /* De settings-nav heeft labels nodig → tijdelijk uitklappen,
       en bij terugkeer de vorige rail-stand herstellen. */
    collapsedBeforeSettings = root.dataset.sidebar === "collapsed";
    if (collapsedBeforeSettings) setCollapsed(false);

    setPanel("settings");
    btnBack.setAttribute("aria-label", "Back to " + lastMain.title);
    btnBack.setAttribute("title", "Back to " + lastMain.title + "  ( Esc )");

    /* Open het settings-item dat als laatste actief was (default: General). */
    var active = panelSet.querySelector(".nav__item.is-active") || panelSet.querySelector(".nav__item");
    showPage(active.dataset.page, active.dataset.title, active.dataset.icon);
    btnBack.focus({ preventScroll: true });
  }

  function closeSettings() {
    setPanel("main");
    if (collapsedBeforeSettings) setCollapsed(true);
    hideSavebar();

    /* Terug naar exact de pagina waar de gebruiker vandaan kwam. */
    showPage(lastMain.page, lastMain.title, lastMain.icon);
    btnSettings.focus({ preventScroll: true });
  }

  btnSettings.addEventListener("click", openSettings);
  btnBack.addEventListener("click", closeSettings);

  /* ========================================================================
     4. PAGINA-STATE
     ======================================================================== */
  function showPage(page, title, icon) {
    pageTitle.textContent = title;
    pageIcon.querySelector("use").setAttribute("href", "#" + icon);

    var target = null;
    views.forEach(function (v) {
      var match = v.dataset.view === page;
      v.hidden = !match;
      if (match) target = v;
    });

    /* Geen uitgewerkte view? Val terug op de generieke placeholder. */
    if (!target) {
      var generic = document.querySelector('.view[data-view="generic"]');
      generic.hidden = false;
      document.getElementById("empty-title").textContent = title;
      document.getElementById("empty-icon").querySelector("use").setAttribute("href", "#" + icon);
    }

    document.querySelector(".content").scrollTop = 0;
  }

  function activate(item, panel) {
    panel.querySelectorAll(".nav__item").forEach(function (el) {
      el.classList.remove("is-active");
      el.removeAttribute("aria-current");
    });
    item.classList.add("is-active");
    item.setAttribute("aria-current", "page");
  }

  sidebar.addEventListener("click", function (e) {
    var item = e.target.closest(".nav__item[data-page]");
    if (!item) return;
    e.preventDefault();

    var panel = item.closest(".panel");
    activate(item, panel);
    showPage(item.dataset.page, item.dataset.title, item.dataset.icon);

    /* Alleen hoofdnavigatie telt als "laatst geopende pagina". */
    if (panel === panelMain) {
      lastMain = { page: item.dataset.page, title: item.dataset.title, icon: item.dataset.icon };
    } else {
      hideSavebar();
    }

    if (mqMobile.matches) setDrawer(false);
  });

  /* ========================================================================
     5. SAVE BAR — verschijnt zodra er iets wijzigt binnen settings
     ======================================================================== */
  function showSavebar() { if (root.dataset.nav === "settings") savebar.hidden = false; }
  function hideSavebar() { savebar.hidden = true; }

  document.getElementById("view").addEventListener("change", showSavebar);
  document.getElementById("view").addEventListener("input", showSavebar);
  savebar.addEventListener("click", function (e) {
    if (e.target.closest("[data-save]")) hideSavebar();
  });

  /* ========================================================================
     6. TOETSENBORD
     ======================================================================== */
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

    if (e.key === "Escape") {
      if (root.dataset.drawer === "open") { setDrawer(false); return; }
      if (root.dataset.nav === "settings") { closeSettings(); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("global-search").focus();
    }
    if (e.key === "[" && !typing && !e.metaKey && !e.ctrlKey && !mqMobile.matches) {
      setCollapsed(root.dataset.sidebar !== "collapsed");
    }
  });

  /* Init */
  setPanel("main");
  syncCollapseLabel();
})();
