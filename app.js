/* ==========================================================================
   Opining — dashboard shell
   Vanilla JS, geen dependencies.
     1. Mobiele drawer            → <html data-drawer>
     2. Hoofdnavigatie            → welke view staat aan
     3. Settings-overlay          → <html data-settings> + data-settings-view
     4. Save bar
     5. Setup-guide               → accordeon op het dashboard
     6. Toast                     → bevestiging na opslaan
     7. Zoekpaneel                → <html data-search>
     8. Toetsenbord
   In een SPA vervang je §2 en §3 door de router; de rest blijft 1-op-1.
   ========================================================================== */
(function () {
  "use strict";

  var root    = document.documentElement;
  var sidebar = document.getElementById("sidebar");
  var scrim   = document.getElementById("scrim");
  var savebar = document.getElementById("savebar");

  var btnDrawer   = document.getElementById("drawer-toggle");
  var btnSettings = document.getElementById("open-settings");

  var overlay    = document.getElementById("settings-overlay");
  var btnSetClose = document.getElementById("settings-close");
  var btnSetBack  = document.getElementById("settings-back");
  var setNav      = overlay.querySelector(".set-nav");

  var pageTitle = document.getElementById("page-title");
  var pageIcon  = document.getElementById("page-icon");
  var setTitle  = document.getElementById("set-title");
  var setIcon   = document.getElementById("set-icon");

  var views    = document.querySelectorAll("[data-view]");
  var setViews = document.querySelectorAll("[data-set-view]");

  var mqMobile = window.matchMedia("(max-width: 900px)");
  var lastFocus = null;
  /* Zolang Settings actief staat draagt de sidebar die markering; hiermee
     weten we naar welk paginaitem we terug moeten bij het sluiten. */
  var lastPageItem = sidebar.querySelector(".nav__list .nav__item.is-active");
  var ordersGroup = document.getElementById("orders-group");

  /* ========================================================================
     1. MOBIELE DRAWER
     ======================================================================== */
  function setDrawer(open) {
    root.dataset.drawer = open ? "open" : "closed";
    btnDrawer.setAttribute("aria-expanded", String(open));
    btnDrawer.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    scrim.hidden = !open;
    /* Focus naar de drawer zelf, niet naar het eerste item: iOS Safari ziet
       een programmatische focus als 'zichtbaar' en tekent dan een ring om
       Dashboard die de gebruiker nooit heeft opgeroepen. */
    if (open) {
      /* De burger zit boven de scrim, dus vanaf hier kun je de drawer openen
         terwijl het zoekpaneel nog openstaat. */
      closeSearch();
      sidebar.focus({ preventScroll: true });
    }
  }

  btnDrawer.addEventListener("click", function () { setDrawer(root.dataset.drawer !== "open"); });
  scrim.addEventListener("click", function () { setDrawer(false); });
  mqMobile.addEventListener("change", function (e) {
    if (!e.matches) {
      setDrawer(false);
      /* Naar desktop: daar mag de inhoudskolom niet zonder actief item staan. */
      if (root.dataset.settings === "open") ensureSetActive();
    }
  });

  /* ========================================================================
     2. HOOFDNAVIGATIE
     ======================================================================== */
  function swapIcon(svg, icon) { svg.querySelector("use").setAttribute("href", "#" + icon); }

  function activate(item, scope) {
    scope.querySelectorAll(".nav__item").forEach(function (el) {
      el.classList.remove("is-active");
      el.removeAttribute("aria-current");
    });
    item.classList.add("is-active");
    item.setAttribute("aria-current", "page");
  }

  function showPage(page, title, icon) {
    pageTitle.textContent = title;
    swapIcon(pageIcon, icon);

    var found = false;
    views.forEach(function (v) {
      var match = v.dataset.view === page;
      v.hidden = !match;
      if (match) found = true;
    });

    /* Geen uitgewerkte view? Val terug op de generieke placeholder. */
    if (!found) {
      var generic = document.querySelector('[data-view="generic"]');
      generic.hidden = false;
      document.getElementById("empty-title").textContent = title;
      swapIcon(document.getElementById("empty-icon"), icon);
    }
    syncPageAction(page);
    /* Archive hangt onder Orders: de groep staat open zodra je op een van
       beide staat. Anders dan Menu navigeert de ouder hier wél zelf. */
    ordersGroup.classList.toggle("is-open", page === "orders" || page === "archive");
    document.getElementById("content").scrollTop = 0;
  }

  /* ---- Online Store: sectienavigatie binnen de pagina -------------------- */
  var storeView = document.querySelector('[data-view="online-store"]');
  var storeNav  = storeView && storeView.querySelector(".store__nav");

  if (storeNav) {
    storeNav.addEventListener("click", function (e) {
      var item = e.target.closest("[data-store]");
      if (!item) return;
      e.preventDefault();
      activate(item, storeNav);
      storeView.querySelectorAll("[data-store-view]").forEach(function (paneel) {
        paneel.hidden = paneel.dataset.storeView !== item.dataset.store;
      });
    });

    /* Merkkleur meteen doorvoeren in de voorbeeldknop. */
    var brandInput = document.getElementById("brand-color");
    var brandChip  = document.getElementById("brand-chip");
    var brandBtn   = document.getElementById("brand-preview-btn");
    brandInput.addEventListener("input", function () {
      var kleur = brandInput.value.trim();
      if (!/^#[0-9a-f]{3,8}$/i.test(kleur)) return;
      brandChip.style.background = kleur;
      brandBtn.style.background = kleur;
    });

    /* De sliders en hun getalvelden houden elkaar bij. */
    storeView.querySelectorAll(".srow").forEach(function (rij) {
      var range = rij.querySelector('input[type="range"]');
      var getal = rij.querySelector('input[type="number"]');
      if (!range || !getal) return;
      range.addEventListener("input", function () { getal.value = range.value; });
      getal.addEventListener("input", function () { range.value = getal.value; });
    });

    /* Wijzigen hier zet dezelfde savebar in de header aan als de settings. */
    storeView.addEventListener("input",  function () { markUnsaved("Online store"); });
    storeView.addEventListener("change", function () { markUnsaved("Online store"); });
  }

  /* ---- Openingstijden: diensten per dag, en de gesloten-stand ------------- */
  var hoursView = document.querySelector('[data-set-view="hours"]');

  if (hoursView) {
    /* Verwijderen kan pas vanaf twee diensten, en "Add shift" hoort alleen op
       de onderste regel — anders staat hij midden in de rij. */
    function syncShifts(rij) {
      var shifts = rij.querySelectorAll(".shift");
      shifts.forEach(function (shift, i) {
        shift.querySelector(".shift__del").hidden = shifts.length < 2;
        shift.querySelector(".shift__add").hidden = i !== shifts.length - 1;
      });
    }

    function setDagOpen(rij, open) {
      rij.classList.toggle("is-off", !open);
      rij.querySelector(".shifts").hidden = !open;
      rij.querySelector(".closed").hidden = open;
    }

    hoursView.addEventListener("click", function (e) {
      var rij = e.target.closest(".hrow");
      if (!rij) return;

      if (e.target.closest(".shift__add")) {
        var laatste = rij.querySelector(".shift:last-child");
        var kopie = laatste.cloneNode(true);
        /* De foutstaat hoort bij die ene waarde, niet bij een nieuwe dienst. */
        var fout = kopie.querySelector(".tfield--error");
        if (fout) fout.replaceWith(fout.querySelector(".time"));
        kopie.querySelectorAll(".time").forEach(function (veld) {
          veld.removeAttribute("aria-invalid");
          veld.removeAttribute("aria-describedby");
        });
        laatste.after(kopie);
        syncShifts(rij);
        markUnsaved("Opening hours");
      }

      if (e.target.closest(".shift__del")) {
        if (rij.querySelectorAll(".shift").length < 2) return;
        e.target.closest(".shift").remove();
        syncShifts(rij);
        markUnsaved("Opening hours");
      }
    });

    hoursView.addEventListener("change", function (e) {
      if (e.target.matches('.switch input')) setDagOpen(e.target.closest(".hrow"), e.target.checked);
      markUnsaved("Opening hours");
    });
    hoursView.addEventListener("input", function () { markUnsaved("Opening hours"); });
  }

  /* ---- Loyalty: het voorbeeld volgt het gekozen percentage ---------------- */
  var loyaltyView = document.querySelector('[data-view="loyalty"]');

  if (loyaltyView) {
    /* Beloningen zijn vaste bedragen; alleen het benodigde puntenaantal
       schaalt mee. 1 punt = 0,01 EUR, dus punten = bedrag / percentage. */
    var BELONINGEN = [2.5, 5, 10, 15];
    var pctLabel = document.getElementById("loyalty-pct");
    var tegels   = document.getElementById("loyalty-tiles");

    function toonVoorbeeld(pct) {
      pctLabel.textContent = pct + "%";
      tegels.querySelectorAll(".tile").forEach(function (tegel, i) {
        var euro = BELONINGEN[i];
        var punten = Math.round(euro / (pct / 100) * 100);
        tegel.querySelector(".tile__value").textContent =
          "€ " + euro.toFixed(2).replace(".00", "").replace(".", ",");
        tegel.querySelector(".tile__meta").firstChild.nodeValue =
          punten.toLocaleString("nl-NL") + " ";
      });
    }

    loyaltyView.addEventListener("change", function (e) {
      if (e.target.name === "redemption") toonVoorbeeld(Number(e.target.value));
      markUnsaved("Loyalty");
    });

  }

  /* Wegklikbare meldingen, waar ze ook staan: de knop noemt het id van het
     blok dat moet verdwijnen. */
  document.addEventListener("click", function (e) {
    var knop = e.target.closest("[data-dismiss]");
    if (!knop) return;
    var doel = document.getElementById(knop.dataset.dismiss);
    if (doel) doel.hidden = true;
  });

  /* ---- Productenlijst: groepen klappen los van elkaar open ---------------- */
  var productPanel = document.querySelector('[data-view="products"] .panel');

  if (productPanel) {
    productPanel.addEventListener("click", function (e) {
      var kop = e.target.closest(".group__head");
      if (!kop) return;
      var groep = kop.closest(".group");
      var open = !groep.classList.contains("is-open");
      groep.classList.toggle("is-open", open);
      kop.setAttribute("aria-expanded", String(open));
    });
  }

  /* Tabs zitten op meerdere plekken (producten, billing), dus één gedelegeerde
     afhandeling binnen de eigen .tabs-groep. */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest(".tab");
    if (!tab) return;
    tab.closest(".tabs").querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
    tab.classList.add("is-active");
  });

  /* ---- Paginakop: actieknop en paginagebonden bediening ------------------ */
  var pageAction = document.getElementById("page-action");
  var pageActionLabel = document.getElementById("page-action-label");

  var pageActionIcon = document.getElementById("page-action-icon");

  /* Elke lijstpagina heeft zijn eigen actie; Online Store wijkt af met een
     zachte knop in plaats van de primaire toevoegknop. */
  var PAGINA_ACTIES = {
    products:       { label: "Add product",   icon: "i-plus", zacht: false },
    choices:        { label: "Add new",       icon: "i-plus", zacht: false },
    categories:     { label: "Add categorie", icon: "i-plus", zacht: false },
    deliverers:     { label: "Add deliverer", icon: "i-plus", zacht: false },
    "online-store": { label: "View store",    icon: "i-eye",  zacht: true }
  };

  /* Sommige pagina's hebben meer nodig dan één knop (Orders: een filter plus
     een hoofdactie). Die blokken staan in de page-head en dragen data-tools. */
  var pageTools = document.querySelectorAll("[data-tools]");

  function syncPageTools(page) {
    var eigen = false;
    pageTools.forEach(function (el) {
      var match = el.dataset.tools === page;
      el.hidden = !match;
      if (match) eigen = true;
    });
    return eigen;
  }

  function syncPageAction(page) {
    /* Een eigen bedieningsblok vervangt de generieke actieknop. */
    if (syncPageTools(page)) { pageAction.hidden = true; return; }

    var actie = PAGINA_ACTIES[page];
    pageAction.hidden = !actie;
    if (!actie) return;
    pageActionLabel.textContent = actie.label;
    pageActionIcon.setAttribute("href", "#" + actie.icon);
    pageAction.classList.toggle("btn--soft", actie.zacht);
    pageAction.classList.toggle("btn--primary", !actie.zacht);
  }

  /* Groepen waarvan de ouder alleen open- en dichtklapt: er bestaat geen
     Menu- of Marketing-pagina, alleen subpagina's. Orders staat hier bewust
     niet tussen — die ouder is zelf een pagina en regelt zich in showPage. */
  var toggleGroups = [].slice.call(document.querySelectorAll(".nav__group[data-toggle]"));

  /* De ouder houdt zijn markering zolang je op een van zijn subpagina's staat.
     Aparte klasse, want activate() wist juist alle is-active in de sidebar. */
  function syncSection() {
    toggleGroups.forEach(function (groep) {
      groep.querySelector(".nav__parent")
           .classList.toggle("is-section", !!groep.querySelector(".nav__sub-item.is-active"));
    });
  }

  function setGroup(groep, open) {
    groep.classList.toggle("is-open", open);
    groep.querySelector(".nav__parent").setAttribute("aria-expanded", String(open));
  }

  toggleGroups.forEach(function (groep) {
    groep.querySelector(".nav__parent").addEventListener("click", function () {
      setGroup(groep, !groep.classList.contains("is-open"));
    });
  });

  sidebar.addEventListener("click", function (e) {
    var item = e.target.closest(".nav__item[data-page]");
    if (!item) return;
    e.preventDefault();
    activate(item, sidebar);
    lastPageItem = item;
    showPage(item.dataset.page, item.dataset.title, item.dataset.icon);
    /* Ga je naar een pagina buiten een groep, dan klapt die weer dicht en
       laat de markering los. */
    toggleGroups.forEach(function (groep) {
      if (!groep.contains(item)) setGroup(groep, false);
    });
    syncSection();
    /* Vanuit de drawer bovenop de overlay: die moet weg, anders kies je een
       pagina die je niet te zien krijgt. */
    if (root.dataset.settings === "open") closeSettings();
    if (mqMobile.matches) setDrawer(false);
  });

  /* ========================================================================
     3. SETTINGS-OVERLAY
     Desktop: nav-kolom en inhoud staan naast elkaar.
     Mobiel: eerst de lijst, na een keuze de pagina met terug-knop.
     ======================================================================== */
  /* Op mobiel is de lijst een eigen scherm: zolang je niets hebt gekozen
     hoort er niets gemarkeerd te staan. Op desktop staat de inhoud er altijd
     naast, dus daar moet juist altijd één item actief zijn. */
  function clearSetActive() {
    setNav.querySelectorAll(".nav__item").forEach(function (el) {
      el.classList.remove("is-active");
      el.removeAttribute("aria-current");
    });
  }

  function ensureSetActive() {
    if (setNav.querySelector(".nav__item.is-active")) return;
    var first = setNav.querySelector(".nav__item");
    activate(first, setNav);
    showSetPage(first.dataset.set, first.dataset.title, first.dataset.icon);
  }

  function openSettings() {
    /* Staat hij al open, dan kom je hier via de drawer: die klap je dicht en
       je houdt de settingspagina waar je was. */
    if (root.dataset.settings === "open") { setDrawer(false); return; }

    closeSearch();
    lastFocus = document.activeElement;
    root.dataset.settings = "open";
    /* Settings neemt de markering in de sidebar over van de pagina. */
    lastPageItem = sidebar.querySelector(".nav__list .nav__item.is-active") || lastPageItem;
    activate(btnSettings, sidebar);
    root.dataset.settingsView = "list";
    if (mqMobile.matches) clearSetActive(); else ensureSetActive();
    /* Heropenen terwijl hij nog dichtglijdt: de sluit-animatie moet weg,
       anders blijft die de openings-animatie overrulen. */
    stopCloseAnim();
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    setDrawer(false);

    /* De dialoog zelf krijgt de focus, niet een knop of lijstitem erin: dat
       verplaatst de focus wel netjes naar de overlay, maar zonder een ring om
       iets waar de gebruiker niet naartoe is genavigeerd. */
    overlay.focus({ preventScroll: true });
  }

  /* Verbergen mag pas als de overlay is uitgegleden. De savebar zit erbinnen
     en animeert ook, dus alleen op de overlay zelf luisteren. */
  var closeTimer = null;

  function stopCloseAnim() {
    if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
    overlay.removeEventListener("animationend", onCloseEnd);
    delete overlay.dataset.closing;
  }

  function onCloseEnd(e) {
    if (e.target !== overlay) return;
    finishClose();
  }

  function finishClose() {
    stopCloseAnim();
    overlay.hidden = true;
  }

  function closeSettings() {
    if (overlay.hidden || "closing" in overlay.dataset) return;

    root.dataset.settings = "closed";
    /* Markering terug naar de pagina die eronder ligt. Klik je vanuit de
       drawer een ándere pagina aan, dan heeft die handler lastPageItem al
       bijgewerkt en zetten we dus die. */
    if (lastPageItem) activate(lastPageItem, sidebar);
    overlay.dataset.closing = "";
    overlay.addEventListener("animationend", onCloseEnd);
    /* Op een achtergrondtab bevriest de animatie en komt animationend nooit.
       Zonder vangnet blijft de overlay dan voorgoed openstaan. */
    closeTimer = setTimeout(finishClose, 400);

    document.body.style.overflow = "";
    hideSavebar();
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }

  var setTools = document.querySelectorAll("[data-set-tools]");

  function showSetPage(page, title, icon) {
    setTitle.textContent = title;
    swapIcon(setIcon, icon);
    setTools.forEach(function (el) { el.hidden = el.dataset.setTools !== page; });

    var found = false;
    setViews.forEach(function (v) {
      var match = v.dataset.setView === page;
      v.hidden = !match;
      if (match) found = true;
    });
    if (!found) {
      var generic = document.querySelector('[data-set-view="generic"]');
      generic.hidden = false;
      document.getElementById("set-empty-title").textContent = title;
      swapIcon(document.getElementById("set-empty-icon"), icon);
    }
    overlay.scrollTop = 0;
  }

  btnSettings.addEventListener("click", openSettings);
  btnSetClose.addEventListener("click", closeSettings);

  /* Terug-knop bestaat alleen op mobiel. Sta je in een subpagina, dan gaat die
     eerst een niveau omhoog voordat hij naar de lijst terugkeert. */
  btnSetBack.addEventListener("click", function () {
    if (backFromSub()) return;
    root.dataset.settingsView = "list";
    clearSetActive();
    hideSavebar();
    overlay.scrollTop = 0;
  });

  setNav.addEventListener("click", function (e) {
    var item = e.target.closest(".nav__item[data-set]");
    if (!item) return;
    e.preventDefault();
    activate(item, setNav);
    closeSetSub();
    showSetPage(item.dataset.set, item.dataset.title, item.dataset.icon);
    root.dataset.settingsView = "page";
    hideSavebar();
  });

  /* ---- Subpagina binnen een settings-pagina ------------------------------
     Een rij met data-sub opent een niveau dieper. De kop wordt dan een
     kruimelpad: het pagina-icoon dimt, krijgt een chevron en fungeert als
     terugknop. */
  var setCrumb     = document.getElementById("set-crumb");
  var setCrumbIcon = document.getElementById("set-crumb-icon");
  var setLead      = document.getElementById("set-lead");
  var setSubs      = document.querySelectorAll("[data-set-sub]");
  var ouder        = null;   /* titel + icoon van de pagina waar we vandaan komen */

  function openSetSub(sub, titel, lead) {
    ouder = { titel: setTitle.textContent, icoon: setIcon.querySelector("use").getAttribute("href") };

    var open = document.querySelector("[data-set-view]:not([hidden])");
    if (open) open.hidden = true;
    setSubs.forEach(function (v) { v.hidden = v.dataset.setSub !== sub; });

    setCrumbIcon.querySelector("use").setAttribute("href", ouder.icoon);
    setCrumb.setAttribute("aria-label", "Back to " + ouder.titel);
    setCrumb.setAttribute("title", "Back to " + ouder.titel);
    setCrumb.hidden = false;
    /* Let op: .hidden is een eigenschap van HTMLElement, niet van SVG. Op een
       <svg> moet je het attribuut zetten, anders gebeurt er niets. */
    setIcon.setAttribute("hidden", "");
    setTitle.textContent = titel;
    setLead.textContent = lead || "";
    setLead.hidden = !lead;
    if (resetWiz) resetWiz(1);
    overlay.scrollTop = 0;
  }

  function closeSetSub() {
    if (!ouder) return;
    setSubs.forEach(function (v) { v.hidden = true; });
    setCrumb.hidden = true;
    setIcon.removeAttribute("hidden");
    setTitle.textContent = ouder.titel;
    setLead.hidden = true;
    ouder = null;
  }

  /* Geeft terug of er daadwerkelijk een niveau omhoog is gegaan, zodat de
     mobiele terug-knop weet of hij nog naar de lijst moet. */
  function backFromSub() {
    var terug = ouder;
    if (!terug) return false;
    closeSetSub();
    var actief = setNav.querySelector(".nav__item.is-active");
    if (actief) showSetPage(actief.dataset.set, terug.titel, actief.dataset.icon);
    return true;
  }

  overlay.addEventListener("click", function (e) {
    var rij = e.target.closest("[data-sub]");
    if (rij) { openSetSub(rij.dataset.sub, rij.dataset.subTitle, rij.dataset.subLead); return; }
    if (e.target.closest("#set-crumb")) backFromSub();
  });

  /* ---- Stappenformulier binnen een subpagina ------------------------------
     Eén kaart per stap; de teller en de balk volgen de actieve stap. */
  var wiz = document.getElementById("pay-wiz");
  /* Buiten het blok gedeclareerd zodat openSetSub het formulier kan
     terugzetten als je de wizard opnieuw binnenkomt. */
  var resetWiz = null;

  if (wiz) {
    var wizStappen = wiz.querySelectorAll("[data-step]");
    var wizNu      = document.getElementById("wiz-now");
    var wizBalk    = document.getElementById("wiz-bar");
    var wizTrack   = wizBalk.parentNode;
    var wizVorige  = document.getElementById("wiz-back");
    var wizVolgende = document.getElementById("wiz-next");
    var stap = 1;

    function toonStap(n) {
      stap = Math.min(Math.max(n, 1), wizStappen.length);
      wizStappen.forEach(function (kaart) { kaart.hidden = Number(kaart.dataset.step) !== stap; });
      wizNu.textContent = stap;
      wizBalk.style.width = (stap / wizStappen.length * 100) + "%";
      wizTrack.setAttribute("aria-valuenow", stap);
      wizVorige.hidden = stap === 1;
      /* Laatste stap rondt af in plaats van door te gaan. */
      wizVolgende.textContent = stap === wizStappen.length ? "Submit for review" : "Next";
      overlay.scrollTop = 0;
    }

    wizVorige.addEventListener("click", function () { toonStap(stap - 1); });
    wizVolgende.addEventListener("click", function () {
      if (stap < wizStappen.length) { toonStap(stap + 1); return; }
      backFromSub();
      showToast("Details submitted for review");
    });

    /* Het keuzeveld hoort bij één optie; bij de andere keuze is het niet van
       toepassing en dus uitgeschakeld. */
    wiz.addEventListener("change", function (e) {
      if (e.target.name !== "entity") return;
      wiz.querySelectorAll(".choice--rich").forEach(function (keuze) {
        var control = keuze.querySelector(".choice__control");
        if (control) control.disabled = !keuze.querySelector("input").checked;
      });
    });

    resetWiz = toonStap;
    toonStap(1);
  }

  /* ========================================================================
     4. SAVE BAR — verschijnt zodra er iets wijzigt in de overlay
     ======================================================================== */
  /* De savebar deelt zijn plek in de header met de zoekbalk; de schakelaar op
     <html> bepaalt wie er staat (zie [data-savebar] in de CSS). */
  function setSavebar(open) {
    savebar.hidden = !open;
    root.dataset.savebar = open ? "open" : "closed";
  }
  /* Onthoudt wat er te bewaren valt, zodat de melding na Save kan benoemen
     waar het over ging. */
  var saveLabel = "Changes";
  function markUnsaved(label) { saveLabel = label; setSavebar(true); }

  function showSavebar() { if (root.dataset.settings === "open") markUnsaved(setTitle.textContent); }
  function hideSavebar() { setSavebar(false); }

  overlay.addEventListener("change", showSavebar);
  overlay.addEventListener("input", showSavebar);
  savebar.addEventListener("click", function (e) {
    var actie = e.target.closest("[data-save]");
    if (!actie) return;
    hideSavebar();
    /* De melding benoemt wat er bewaard is; de settings-kop weet dat al. */
    if (actie.dataset.save === "save") showToast(saveLabel + " saved");
  });

  /* ========================================================================
     5. SETUP-GUIDE — accordeon: er staat er hooguit één open
     ======================================================================== */
  var steps = document.querySelector(".steps");

  if (steps) {
    steps.addEventListener("click", function (e) {
      var title = e.target.closest(".step__title");
      if (!title) return;

      var step = title.closest(".step");
      var wasOpen = step.classList.contains("is-open");

      steps.querySelectorAll(".step").forEach(function (el) {
        el.classList.remove("is-open");
        el.querySelector(".step__title").setAttribute("aria-expanded", "false");
      });

      /* Nogmaals op de open stap klikken klapt hem weer dicht. */
      if (!wasOpen) {
        step.classList.add("is-open");
        title.setAttribute("aria-expanded", "true");
      }
    });
  }

  /* ========================================================================
     6. TOAST — korte bevestiging, verdwijnt vanzelf
     ======================================================================== */
  var toast     = document.getElementById("toast");
  var toastText = document.getElementById("toast-text");
  var toastTimer = null;

  function showToast(bericht) {
    toastText.textContent = bericht;
    toast.hidden = false;

    /* Staat er al een melding, dan moet de animatie opnieuw beginnen; anders
       verschijnt de nieuwe tekst zonder dat er iets lijkt te gebeuren. */
    toast.style.animation = "none";
    void toast.offsetWidth;
    toast.style.animation = "";

    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 4000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    toastTimer = null;
    toast.hidden = true;
  }

  document.getElementById("toast-close").addEventListener("click", hideToast);

  /* ========================================================================
     7. ZOEKPANEEL — opent zodra de zoekbalk focus krijgt
     ======================================================================== */
  var searchInput = document.getElementById("global-search");
  var searchPanel = document.getElementById("search-panel");
  var searchScrim = document.getElementById("search-scrim");

  var searchEl   = searchInput.closest(".search");
  var searchSlot = document.getElementById("search-slot");
  /* Waar het veld hoort te staan als het paneel dicht is. */
  var searchHome = { ouder: searchEl.parentNode, na: searchEl.nextElementSibling };

  function setSearch(open) {
    if (open) {
      /* Meten vóór de verhuizing: dan staat het veld nog op zijn plek in de
         header en levert dat de linkerrand, breedte en bovenrand van het
         paneel. */
      var vak = searchEl.getBoundingClientRect();
      searchPanel.style.left  = vak.left + "px";
      searchPanel.style.top   = vak.top + "px";
      searchPanel.style.width = vak.width + "px";

      /* Eerst de vlag, dan pas verplaatsen: het opnieuw focussen hieronder
         vuurt weer een focus-event af, en dat moet zien dat we al open zijn. */
      root.dataset.search = "open";
      searchPanel.hidden = false;
      searchScrim.hidden = false;
      searchSlot.appendChild(searchEl);
      /* Verplaatsen in de DOM haalt de focus weg, en daarmee op mobiel het
         toetsenbord. */
      searchInput.focus({ preventScroll: true });
      return;
    }
    searchHome.ouder.insertBefore(searchEl, searchHome.na);
    searchPanel.hidden = true;
    searchScrim.hidden = true;
    root.dataset.search = "closed";
  }

  /* Kantelen verplaatst de zoekbalk, maar op mobiel vuurt resize ook als het
     toetsenbord opkomt; dat verandert alleen de hoogte, dus daarop negeren. */
  var laatsteBreedte = window.innerWidth;
  window.addEventListener("resize", function () {
    if (window.innerWidth === laatsteBreedte) return;
    laatsteBreedte = window.innerWidth;
    if (root.dataset.search === "open") closeSearch();
  });

  function closeSearch() {
    if (root.dataset.search !== "open") return;
    setSearch(false);
    searchInput.blur();
  }

  searchInput.addEventListener("focus", function () {
    if (root.dataset.search !== "open") setSearch(true);
  });

  /* Niet op blur sluiten: een chip aantikken haalt de focus uit het veld en
     zou het paneel dan onder je handen wegklappen. De scrim en Escape zijn
     de uitgang. */
  searchScrim.addEventListener("click", closeSearch);

  searchPanel.addEventListener("click", function (e) {
    var chip = e.target.closest(".chip");
    if (!chip) return;
    var stondAan = chip.classList.contains("is-active");
    searchPanel.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); });
    if (!stondAan) chip.classList.add("is-active");
  });

  /* ========================================================================
     8. TOETSENBORD
     ======================================================================== */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      /* Bovenste laag eerst: het zoekpaneel ligt over alles, en de drawer
         kan over de settings-overlay heen liggen. */
      if (root.dataset.search === "open") { closeSearch(); return; }
      if (root.dataset.drawer === "open") { setDrawer(false); return; }
      /* Binnen settings eerst een niveau omhoog, pas daarna sluiten. */
      if (backFromSub()) return;
      if (root.dataset.settings === "open") { closeSettings(); return; }
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      document.getElementById("global-search").focus();
    }
  });
})();
