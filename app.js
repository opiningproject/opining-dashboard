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
     8. Paginering                → <table data-page>
     9. Tabstreep                 → scrollindicator onder .tabs
     10. Postcodepop              → volledige reeks achter de teller
     11. Systeemkiezer            → <select> over de knop op mobiel
     12. Toetsenbord
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
  var pageCrumb   = document.getElementById("page-crumb");

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
    /* Een gewone paginawissel verlaat altijd een eventueel aanmaakscherm. */
    pageCrumb.hidden = true;
    pageIcon.removeAttribute("hidden");
    pageOuder = { page: page, title: title, icon: icon };

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

  /* ---- Aanmaakschermen: een niveau dieper binnen een hoofdpagina ----------
     Zelfde patroon als in settings — het pagina-icoon wordt het kruimelpad
     terug naar de lijst. De view eronder is een gewone [data-view]. */
  var pageCrumbIcon = document.getElementById("page-crumb-icon");
  var pageOuder = null;

  function openPageSub(view, titel) {
    var terug = pageOuder;
    views.forEach(function (v) { v.hidden = v.dataset.view !== view; });
    swapIcon(pageCrumbIcon, terug.icon);
    pageCrumb.hidden = false;
    pageIcon.setAttribute("hidden", "");
    pageTitle.textContent = titel;
    pageAction.hidden = true;
    syncPageTools(null);
    document.getElementById("content").scrollTop = 0;
    pageOuder = terug;          /* showPage heeft hem niet overschreven */
  }

  function backToList() { showPage(pageOuder.page, pageOuder.title, pageOuder.icon); }

  /* Op document-niveau: de openende knop staat vaak in de paginakop, buiten
     de content. data-open-view botst niet met het data-sub van settings. */
  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-open-view]");
    if (open) { openPageSub(open.dataset.openView, open.dataset.viewTitle); return; }

    if (e.target.closest("[data-back-view]")) { backToList(); return; }

    var klaar = e.target.closest("[data-created]");
    if (klaar) { backToList(); showToast(klaar.dataset.created); }
  });

  pageCrumb.addEventListener("click", backToList);



  /* ---- Knoppen op de titelregel op een klein scherm ------------------------
     Twee knoppen naast een paginatitel passen op een telefoon niet. De
     hoofdactie blijft staan, de rest verhuist naar een menu achter drie
     puntjes. Het menu wordt hier uit de knoppen zelf gebouwd: zo staat een
     actie maar één keer in de HTML en kan hij niet uit de pas gaan lopen.
     Welke van de twee je ziet bepaalt de CSS, niet dit script. */
  document.querySelectorAll(".page-head__tools").forEach(function (tools) {
    /* Een blok met een keuzeveld laat zich niet in een menu vouwen; dat vult
       op mobiel toch al zijn eigen regel. */
    if (tools.querySelector("select")) return;

    /* Het pijltje van een gesplitste knop is zelf geen actie; wat erachter zit
       wel, dus dat gaat als eigen regel mee het menu in. */
    var bij = [].slice.call(tools.querySelectorAll(".btn:not(.btn--primary):not(.split__toggle), .split .sort__item"));
    if (bij.length < 1 || !tools.querySelector(".btn--primary")) return;

    var vak = document.createElement("div");
    vak.className = "sort page-head__more";

    var knop = document.createElement("button");
    knop.type = "button";
    knop.className = "icon-btn sort__btn";
    knop.setAttribute("aria-haspopup", "true");
    knop.setAttribute("aria-expanded", "false");
    knop.setAttribute("aria-label", "More actions");
    knop.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-dots"/></svg>';

    var menu = document.createElement("div");
    menu.className = "sort__menu";
    menu.setAttribute("role", "menu");
    menu.hidden = true;

    bij.forEach(function (bron) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "sort__item";
      item.setAttribute("role", "menuitem");
      item.textContent = bron.textContent.trim();
      /* De knop zelf blijft de actie; het menu-item drukt hem alleen in. */
      item.addEventListener("click", function () {
        sluitFilterMenus();
        bron.click();
      });
      menu.appendChild(item);
    });

    vak.append(knop, menu);
    tools.insertBefore(vak, tools.querySelector(".btn--primary") || null);
  });
  /* ---- Doorverwijzen naar de plek waar de taak hoort ---------------------
     De knoppen in de setup-guide sturen je naar een pagina in de sidebar
     (data-goto-page) of naar een settingspagina (data-goto-set). Ze klikken
     het echte navigatie-item aan, zodat markering, titel en icoon precies
     hetzelfde lopen als wanneer je er zelf heen navigeert. */
  document.addEventListener("click", function (e) {
    var naar = e.target.closest("[data-goto-page], [data-goto-set]");
    if (!naar) return;
    e.preventDefault();

    if (naar.dataset.gotoPage) {
      /* Staat de settings-overlay open, dan moet die eerst weg: anders klik
         je een pagina aan die je niet ziet. */
      if (root.dataset.settings === "open") closeSettings();
      var pagina = sidebar.querySelector('.nav__item[data-page="' + naar.dataset.gotoPage + '"]');
      if (pagina) pagina.click();
      return;
    }

    openSettings();
    var rij = setNav.querySelector('.nav__item[data-set="' + naar.dataset.gotoSet + '"]');
    if (rij) rij.click();
  });
  /* ---- Bevroren kolom: rand pas tonen zodra er iets achter wegschuift ----- */
  document.querySelectorAll(".table-wrap").forEach(function (wrap) {
    wrap.addEventListener("scroll", function () {
      wrap.classList.toggle("is-scrolled", wrap.scrollLeft > 0);
    });
  });

  /* ---- Zoeken binnen een paneel ------------------------------------------
     De knop rechts in de panel-kop wisselt die kop om naar een zoekveld met
     een filterknop. De tabelkop blijft staan: je zoekt in dezelfde lijst,
     niet in een nieuw scherm. */
  /* data-filters is "Naam:waarde|waarde;Naam:waarde" — één plek per paneel
     om de filters te benoemen. */
  function leesFilters(psearch) {
    return (psearch.dataset.filters || "").split(";").filter(Boolean).map(function (deel) {
      var stuk = deel.split(":");
      return { naam: stuk[0], waarden: (stuk[1] || "").split("|").filter(Boolean) };
    });
  }

  /* De tab die je meenam: alleen wegklikbaar, want de waarde ligt al vast. */
  function chipVanTab(label) {
    var chip = document.createElement("span");
    chip.className = "fchip";
    chip.append(label);
    var weg = document.createElement("button");
    weg.type = "button";
    weg.className = "fchip__x";
    weg.setAttribute("aria-label", "Remove filter " + label);
    weg.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>';
    chip.appendChild(weg);
    return chip;
  }

  /* Een toegevoegd filter klapt open met zijn waarden; je kiest er nul of meer. */
  function chipVanFilter(filter) {
    var chip = document.createElement("span");
    chip.className = "fchip fchip--drop";
    chip.dataset.naam = filter.naam;

    var knop = document.createElement("button");
    knop.type = "button";
    knop.className = "fchip__label";
    knop.setAttribute("aria-expanded", "false");
    knop.innerHTML = '<span class="fchip__waarde"></span><svg class="icon fchip__caret" aria-hidden="true"><use href="#i-caret"/></svg>';

    var menu = document.createElement("div");
    menu.className = "fchip__menu";
    menu.hidden = true;
    filter.waarden.forEach(function (waarde) {
      var optie = document.createElement("label");
      optie.className = "fopt";
      optie.innerHTML = '<input type="checkbox" /><span></span>';
      optie.querySelector("span").textContent = waarde;
      menu.appendChild(optie);
    });
    var leeg = document.createElement("button");
    leeg.type = "button";
    leeg.className = "fchip__clear";
    leeg.textContent = "Clear";
    menu.appendChild(leeg);

    /* Het kruisje hoort bij een chip die iets doet; zolang er niets is
       aangevinkt filtert hij niet en valt er ook niets weg te halen. */
    var weg = document.createElement("button");
    weg.type = "button";
    weg.className = "fchip__x";
    weg.hidden = true;
    weg.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-close"/></svg>';

    chip.append(knop, weg, menu);
    syncChip(chip);
    return chip;
  }

  /* De chip zegt waarop je filtert, niet waarop je zóu kunnen filteren: zodra
     er iets aanstaat draagt hij de gekozen waarden, met een kruisje ernaast. */
  function syncChip(chip) {
    var naam = chip.dataset.naam || "";
    var aan = [].slice.call(chip.querySelectorAll("input:checked")).map(function (i) {
      return i.nextElementSibling.textContent.trim();
    });
    var label = chip.querySelector(".fchip__waarde");
    var weg = chip.querySelector(".fchip__x");

    /* Meer dan twee wordt te lang voor een chip; dan telt hij de rest op. */
    label.textContent = !aan.length ? naam
      : aan.length <= 2 ? aan.join(", ")
      : aan.slice(0, 1).join("") + " +" + (aan.length - 1);

    chip.classList.toggle("is-active", aan.length > 0);
    weg.hidden = !aan.length;
    weg.setAttribute("aria-label", "Remove filter " + naam);
    chip.querySelector(".fchip__label").setAttribute("aria-label", naam + (aan.length ? ": " + aan.join(", ") : ""));
  }

  /* Alles wissen hoort er alleen te staan zodra er iets te wissen valt. */
  function syncClearAll(psearch) {
    psearch.querySelector(".fclear").hidden = !psearch.querySelector(".fchip");
  }

  function sluitFilterMenus(behalve) {
    document.querySelectorAll(".fmenu, .fchip__menu, .sfilter__menu, .sort__menu, .umenu__list").forEach(function (m) {
      if (m !== behalve) m.hidden = true;
    });
    document.querySelectorAll(".psearch__filter, .fchip__label, .sfilter__btn, .sort__btn, .umenu__btn").forEach(function (b) {
      b.setAttribute("aria-expanded", "false");
    });
  }

  /* De actieve inperking: bij Orders een statusfilter, elders de gekozen tab. */
  function actieveInperking(kop) {
    var s = kop.querySelector(".sfilter__label");
    if (s) return s.textContent.trim();
    var tab = kop.querySelector(".tab.is-active");
    return tab ? tab.textContent.replace(/\s*[\d.]+\s*$/, "").trim() : "";
  }

  function vulFilterMenu(psearch) {
    var menu = psearch.querySelector(".fmenu");
    if (menu.childElementCount) return;
    leesFilters(psearch).forEach(function (filter) {
      var knop = document.createElement("button");
      knop.type = "button";
      knop.className = "fmenu__item";
      knop.setAttribute("role", "menuitem");
      knop.textContent = filter.naam;
      menu.appendChild(knop);
    });
  }


  /* ---- Wat het filter overlaat -------------------------------------------
     Zoekwoord en aangevinkte waarden samen bepalen welke rijen blijven staan.
     Een rij valt af zodra hij aan één van de twee niet voldoet: het zoekwoord
     moet ergens in de rij staan, en van elk filter mét vinkjes moet minstens
     één waarde in de rij staan. Zoeken op de tekst van de rij is voor deze
     lijsten genoeg; in productie filtert de server op de velden zelf. */
  function rijTekst(rij) {
    var stukken = [];
    [].slice.call(rij.cells).forEach(function (cel) {
      /* De actiekolom is bediening, geen gegeven: zonder deze uitzondering
         matcht een knop met het woord "Kitchen" op iedere rij. */
      if (cel.querySelector(".rowact")) return;
      stukken.push(cel.textContent);
    });
    /* Staat de waarde nergens in de tekst — een status die alleen als knop
       bestaat — dan draagt de rij hem in data-filter. */
    if (rij.dataset.filter) stukken.push(rij.dataset.filter);
    return stukken.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function toonGeenResultaten(panel, leeg) {
    var melding = panel.querySelector(".panel__empty");
    if (!melding) {
      melding = document.createElement("p");
      melding.className = "panel__empty";
      melding.textContent = "No results.";
      var wrap = panel.querySelector(".table-wrap");
      if (!wrap) return;
      wrap.after(melding);
    }
    melding.hidden = !leeg;
  }

  /* Lijsten zonder echte paginering dragen een vaste teller ("1–8 of 12"):
     die suggereert een server met meer rijen dan hier staan. Zodra je filtert
     klopt dat niet meer, dus dan vertelt de teller wat er écht overblijft en
     zijn de bladerknoppen uit. Filter weg, oude tekst terug. */
  function syncVastePager(panel, actief, aantal) {
    var voet = panel.querySelector(".pager");
    if (!voet) return;
    var teller = voet.querySelector(".pager__count");
    if (!teller) return;
    if (teller.dataset.vast === undefined) teller.dataset.vast = teller.innerHTML;

    voet.querySelectorAll(".pager__btn").forEach(function (b, i) {
      b.disabled = actief || (i === 0);
    });
    teller.innerHTML = actief
      ? (aantal ? "<b>1&ndash;" + aantal + "</b> of " + aantal : "<b>0</b> results")
      : teller.dataset.vast;
  }

  /* Eén ingang voor alle inperkingen op een paneel. Buiten de zoekstand is dat
     de gekozen tab of het statusfilter; erbinnen zijn het het zoekwoord en de
     chips, want de tab is dan als chip meegenomen. */
  function pasPaneelFilter(kop) {
    var panel = kop && kop.closest(".panel");
    var tabel = panel && panel.querySelector("table");
    if (!tabel || !tabel.tBodies[0]) return;

    var zoekt = kop.classList.contains("is-searching");
    var zoek = "";
    var eisen = [];

    if (zoekt) {
      var psearch = kop.querySelector(".psearch");
      zoek = psearch.querySelector("input[type='search']").value.trim().toLowerCase();
      /* Elke chip levert één eis: een lijstje waarden waarvan er één moet
         kloppen. Een opengeklapte chip zonder vinkjes perkt niets in. */
      psearch.querySelectorAll(".fchip").forEach(function (chip) {
        var aan = [].slice.call(chip.querySelectorAll("input:checked")).map(function (i) {
          return i.nextElementSibling.textContent.trim().toLowerCase();
        });
        if (aan.length) { eisen.push(aan); return; }
        /* De chip die je vanuit de tab meenam draagt zijn waarde in het label. */
        if (!chip.classList.contains("fchip--drop")) eisen.push([chip.textContent.trim().toLowerCase()]);
      });
    } else {
      var gekozen = actieveInperking(kop);
      if (gekozen && !/^All\b/i.test(gekozen)) eisen.push([gekozen.toLowerCase()]);
    }

    var over = 0;
    [].slice.call(tabel.tBodies[0].rows).forEach(function (rij) {
      var tekst = rijTekst(rij);
      var past = (!zoek || tekst.indexOf(zoek) !== -1) && eisen.every(function (groep) {
        return groep.some(function (waarde) { return tekst.indexOf(waarde) !== -1; });
      });
      if (past) { delete rij.dataset.filtered; over++; }
      else rij.dataset.filtered = "1";
    });

    /* Heeft de lijst een pager, dan bepaalt die welke overgebleven rijen je
       ziet; zonder pager staan ze er allemaal. */
    if (tabel.herpagineer) {
      tabel.herpagineer();
    } else {
      [].slice.call(tabel.tBodies[0].rows).forEach(function (rij) {
        rij.hidden = !!rij.dataset.filtered;
      });
      syncVastePager(panel, !!(zoek || eisen.length), over);
    }

    toonGeenResultaten(panel, over === 0);
  }

  /* Tikken in het veld, vinkjes zetten en van tab wisselen werken meteen door. */
  document.addEventListener("input", function (e) {
    var veld = e.target.closest(".psearch input[type='search']");
    if (veld) pasPaneelFilter(veld.closest(".panel__head"));
  });
  document.addEventListener("change", function (e) {
    var vink = e.target.closest(".fchip__menu input");
    if (!vink) return;
    syncChip(vink.closest(".fchip"));
    pasPaneelFilter(vink.closest(".panel__head"));
  });

  function sluitPaneelZoek(kop) {
    kop.classList.remove("is-searching");
    kop.querySelector(".psearch input[type='search']").value = "";
    /* Chips horen bij deze zoekbeurt; bij afbreken vervallen ze met de rest. */
    kop.querySelectorAll(".fchip").forEach(function (c) { c.remove(); });
    sluitFilterMenus();
    syncClearAll(kop.querySelector(".psearch"));
    pasPaneelFilter(kop);
    kop.querySelector(".panel__tool").focus();
  }

  document.addEventListener("click", function (e) {
    var open = e.target.closest(".panel__tool");
    if (open) {
      var kop = open.closest(".panel__head");
      var psearch = kop.querySelector(".psearch");
      kop.classList.add("is-searching");

      /* De gekozen tab is al een filter; die blijft staan, anders zou zoeken
         stilletjes over de hele lijst gaan. "All" is geen filter. */
      if (!psearch.querySelector(".fchip")) {
        var label = actieveInperking(kop);
        if (label && !/^All\b/.test(label)) psearch.querySelector(".fadd").before(chipVanTab(label));
      }
      vulFilterMenu(psearch);
      syncClearAll(psearch);
      /* De meegenomen tab is een echt filter, dus die past hij meteen toe. */
      pasPaneelFilter(kop);
      psearch.querySelector("input[type='search']").focus();
      return;
    }

    var af = e.target.closest(".psearch__cancel");
    if (af) { sluitPaneelZoek(af.closest(".panel__head")); return; }

    var weg = e.target.closest(".fchip__x");
    if (weg) {
      var blok0 = weg.closest(".psearch");
      weg.closest(".fchip").remove();
      syncClearAll(blok0);
      pasPaneelFilter(blok0.closest(".panel__head"));
      return;
    }

    /* Uitklappen van een filterchip. Het menu wordt op naam gezocht en niet
       als "het element hierna": tussen de knop en het menu staat ook het
       kruisje. */
    var label2 = e.target.closest(".fchip__label");
    if (label2) {
      var m2 = label2.parentNode.querySelector(".fchip__menu");
      var dicht = m2.hidden;
      sluitFilterMenus(dicht ? m2 : null);
      m2.hidden = !dicht;
      label2.setAttribute("aria-expanded", String(dicht));
      return;
    }

    /* Clear haalt het hele filter weg, niet alleen de vinkjes: een chip die
       niets meer inperkt heeft geen reden om te blijven staan. */
    var leegmaken = e.target.closest(".fchip__clear");
    if (leegmaken) {
      var chip2 = leegmaken.closest(".fchip");
      var kop2 = chip2.closest(".panel__head");
      var blok2 = chip2.closest(".psearch");
      chip2.remove();
      syncClearAll(blok2);
      pasPaneelFilter(kop2);
      return;
    }

    var alles = e.target.closest(".fclear");
    if (alles) {
      var blok1 = alles.closest(".psearch");
      blok1.querySelectorAll(".fchip").forEach(function (c) { c.remove(); });
      syncClearAll(blok1);
      pasPaneelFilter(blok1.closest(".panel__head"));
      return;
    }

    /* Accountmenu in de header. */
    var uknop = e.target.closest(".umenu__btn");
    if (uknop) {
      var ul = uknop.nextElementSibling;
      var dichtU = ul.hidden;
      sluitFilterMenus(dichtU ? ul : null);
      ul.hidden = !dichtU;
      uknop.setAttribute("aria-expanded", String(dichtU));
      return;
    }

    var uitloggen = e.target.closest(".umenu__item--out");
    if (uitloggen) { sluitFilterMenus(); showToast("Signed out"); return; }

    /* Account opent de settings-overlay op de accountpagina. */
    var accountItem = e.target.closest(".umenu__item");
    if (accountItem) {
      sluitFilterMenus();
      openSettings();
      var rij = setNav.querySelector('[data-set="account"]');
      activate(rij, setNav);
      showSetPage("account", "Account", "i-user-circle");
      return;
    }

    /* Sorteren: openen, en daarna twee keuzes die los van elkaar staan —
       waarop je sorteert en in welke richting. Het menu blijft daarom open. */
    var sortKnop = e.target.closest(".sort__btn");
    if (sortKnop) {
      var som = sortKnop.nextElementSibling;
      var dichtSort = som.hidden;
      sluitFilterMenus(dichtSort ? som : null);
      som.hidden = !dichtSort;
      sortKnop.setAttribute("aria-expanded", String(dichtSort));
      return;
    }

    var sortItem = e.target.closest(".sort__item");
    if (sortItem) {
      /* Alleen een sorteerkeuze blijft open en krijgt een vinkje. Elk ander
         menu-item is een actie; die regelt zijn eigen handler, en daarna
         hoort het menu dicht. */
      if (!sortItem.dataset.sort) { sluitFilterMenus(); return; }
      var groep = sortItem.dataset.sort;
      sortItem.closest(".sort__menu")
        .querySelectorAll('[data-sort="' + groep + '"]').forEach(function (i) {
          i.classList.remove("is-selected");
          i.setAttribute("aria-checked", "false");
        });
      sortItem.classList.add("is-selected");
      sortItem.setAttribute("aria-checked", "true");
      return;
    }

    /* Statusfilter openen en kiezen. */
    var sknop = e.target.closest(".sfilter__btn");
    if (sknop) {
      var sm = sknop.nextElementSibling;
      var dichtS = sm.hidden;
      sluitFilterMenus(dichtS ? sm : null);
      sm.hidden = !dichtS;
      sknop.setAttribute("aria-expanded", String(dichtS));
      return;
    }

    var sitem = e.target.closest(".sfilter__item");
    if (sitem) {
      var sf = sitem.closest(".sfilter");
      sf.querySelectorAll(".sfilter__item").forEach(function (i) {
        i.classList.remove("is-selected");
        i.setAttribute("aria-checked", "false");
      });
      sitem.classList.add("is-selected");
      sitem.setAttribute("aria-checked", "true");
      sf.querySelector(".sfilter__label").textContent = sitem.textContent.trim();
      sluitFilterMenus();
      pasPaneelFilter(sf.closest(".panel__head"));
      return;
    }

    var toevoegen = e.target.closest(".psearch__filter");
    if (toevoegen) {
      var m = toevoegen.nextElementSibling;
      var wasDicht = m.hidden;
      sluitFilterMenus(wasDicht ? m : null);
      m.hidden = !wasDicht;
      toevoegen.setAttribute("aria-expanded", String(wasDicht));
      return;
    }

    var keuze = e.target.closest(".fmenu__item");
    if (keuze) {
      var blok = keuze.closest(".psearch");
      var filter = leesFilters(blok).filter(function (f) { return f.naam === keuze.textContent; })[0];
      /* Nieuwste filter vooraan, zoals in het ontwerp. */
      var nieuw = chipVanFilter(filter);
      blok.querySelector(".psearch__filters").prepend(nieuw);
      sluitFilterMenus();
      /* Je koos net dit filter, dus je wilt zijn waarden zien: de chip komt
         open in plaats van dat je er nog eens op moet klikken. */
      nieuw.querySelector(".fchip__menu").hidden = false;
      nieuw.querySelector(".fchip__label").setAttribute("aria-expanded", "true");
      syncClearAll(blok);
      pasPaneelFilter(blok.closest(".panel__head"));
      return;
    }

    /* Klik ergens anders sluit openstaande menu's. Het sorteermenu blijft
       staan zolang je erin klikt: waarop en hoe zijn twee keuzes. */
    if (!e.target.closest(".fchip__menu, .sort__menu")) sluitFilterMenus();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var veld = e.target.closest(".psearch");
    if (veld) sluitPaneelZoek(veld.closest(".panel__head"));
  });

  /* ---- Uitbetalingen exporteren -------------------------------------------
     Eerst de vraag van wanneer tot wanneer, dan pas het bestand. De velden zijn
     <input type="date">, dus de kiezer komt van het toestel zelf. Het bestand
     wordt hier uit de tabel opgebouwd; in productie levert de server de regels
     voor de gekozen periode. */
  var exportVenster = document.getElementById("export-dialog");

  if (exportVenster) {
    var vanaf = document.getElementById("export-from");
    var tot = document.getElementById("export-to");
    var fout = document.getElementById("export-error");
    var vorigeFocus = null;

    function openExport() {
      vorigeFocus = document.activeElement;
      exportVenster.hidden = false;
      fout.hidden = true;
      vanaf.focus();
    }
    function sluitExport() {
      exportVenster.hidden = true;
      sluitFilterMenus();
      if (vorigeFocus) vorigeFocus.focus();
    }

    /* Het menu achter de drie puntjes opent hetzelfde venster. */
    document.addEventListener("click", function (e) {
      if (e.target.closest("#export-csv")) openExport();
    });

    /* "2026-08-01" uit een datumveld, als lokale datum. */
    function veldDatum(s) {
      if (!s) return null;
      var d = s.split("-");
      return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]));
    }

    /* "22 Aug 2026" is wat er in de tabel staat; hier wordt het een datum om
       mee te vergelijken. */
    var MAANDEN = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
                    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    function leesDatum(s) {
      var d = s.trim().split(/\s+/);
      if (d.length !== 3 || !(d[1] in MAANDEN)) return null;
      return new Date(Number(d[2]), MAANDEN[d[1]], Number(d[0]));
    }

    /* Een veld met een komma of een aanhalingsteken hoort tussen quotes. */
    function csvVeld(s) {
      s = String(s).replace(/\s+/g, " ").trim();
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }

    function maakCsv(van, naar) {
      var tabel = document.querySelector('[data-view="finance"] .panel--inset table');
      var regels = ['Payout,Date,Status,Amount'];
      [].slice.call(tabel.tBodies[0].rows).forEach(function (rij) {
        var datum = leesDatum(rij.cells[0].textContent);
        if (!datum || (van && datum < van) || (naar && datum > naar)) return;
        /* Het uitbetalingsnummer staat in het label van de link; in de kolom
           zelf zou het alleen ruimte kosten. */
        var link = rij.querySelector("a[aria-label]");
        var nummer = link ? (link.getAttribute("aria-label").match(/[0-9]{4}-P-[0-9]{4}/) || [""])[0] : "";
        regels.push([
          csvVeld(nummer),
          csvVeld(rij.cells[0].textContent),
          csvVeld(rij.cells[2].textContent),
          csvVeld(rij.cells[1].textContent.replace(/[^0-9,.-]/g, ""))
        ].join(","));
      });
      return regels.join("\r\n") + "\r\n";
    }

    exportVenster.addEventListener("click", function (e) {
      if (e.target.closest("[data-dialog-close]")) { sluitExport(); return; }
      if (!e.target.closest("#export-go")) return;

      /* Een omgekeerde periode levert een leeg bestand op; dat zeggen we
         liever hier dan na de download. */
      if (vanaf.value && tot.value && tot.value < vanaf.value) {
        fout.hidden = false;
        tot.focus();
        return;
      }

      /* Als datum uit een veld door new Date() gaat, leest hij dat als UTC,
         terwijl de datums in de tabel lokaal zijn. Dan valt de eerste dag van
         de periode er net buiten; vandaar met de hand. */
      var van = veldDatum(vanaf.value);
      var naar = veldDatum(tot.value);
      var csv = maakCsv(van, naar);
      var aantal = csv.trim().split("\n").length - 1;

      /* In productie haalt de server de regels op en zet hij het bestand klaar;
         hier komt het uit de tabel die je voor je hebt. */
      var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      var a = document.createElement("a");
      a.href = url;
      a.download = "payouts-" + (vanaf.value || "start") + "-to-" + (tot.value || "today") + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

      sluitExport();
      showToast(aantal + (aantal === 1 ? " payout exported" : " payouts exported"));
    });

    /* Typen ruimt de melding op: hij ging over de vorige poging. */
    exportVenster.addEventListener("input", function () { fout.hidden = true; });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !exportVenster.hidden) sluitExport();
    });
  }


  /* ---- Een domein kopen ---------------------------------------------------
     De knop Buy staat bij een naam in de lijst; de afrekenpagina neemt die
     naam en die prijs over, zodat je niet naar iets anders kijkt dan waar je
     op klikte. De verlengdatum is een jaar later dan vandaag. */
  var koopPagina = document.querySelector('[data-set-sub="domain-checkout"]');

  if (koopPagina) {
    var koopNaam = document.getElementById("buy-domain");
    var koopVandaag = document.getElementById("buy-today");
    var koopVerleng = document.getElementById("buy-renew");
    var koopTotaal = document.getElementById("buy-total");
    var koopDatum = document.getElementById("buy-renew-date");
    var koopVandaagDatum = document.getElementById("buy-due-date");
    var koopWinkel = document.getElementById("buy-store");
    var koopFout = document.getElementById("buy-store-error");

    document.addEventListener("click", function (e) {
      var knop = e.target.closest('[data-sub="domain-checkout"]');
      if (!knop) return;

      var rij = knop.closest(".row");
      if (!rij) return;
      var naam = rij.querySelector(".row__title").textContent.trim();
      /* "€ 9,00 the first year, € 52,00 per year after that" — het eerste
         bedrag is wat je nu betaalt, het laatste wat de verlenging kost. */
      var bedragen = (rij.querySelector(".row__meta").textContent.match(/€\s?[\d.,]+/g) || []);
      var nu = bedragen[0] || "";
      var later = bedragen[bedragen.length - 1] || nu;

      koopNaam.textContent = naam;
      koopVandaag.textContent = nu;
      koopVerleng.textContent = later;
      koopTotaal.textContent = nu;

      /* Verlengen gebeurt over een jaar; die datum hoort er met zoveel woorden
         te staan, anders is "every year" een lege belofte. */
      var over = new Date();
      over.setFullYear(over.getFullYear() + 1);
      var maanden = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];
      function schrijfDatum(d) {
        return d.getDate() + " " + maanden[d.getMonth()] + " " + d.getFullYear();
      }
      koopDatum.textContent = schrijfDatum(over);
      koopVandaagDatum.textContent = schrijfDatum(new Date());

      koopWinkel.classList.remove("input--error");
      koopFout.hidden = true;
    });

    /* Zonder winkelnaam kan de registratie niet de deur uit. */
    var koopVervalt = "";
    var koopRij = null;

    document.getElementById("buy-go").addEventListener("click", function () {
      if (!koopWinkel.value.trim()) {
        koopWinkel.classList.add("input--error");
        koopFout.hidden = false;
        koopWinkel.focus();
        return;
      }

      var naam = koopNaam.textContent;
      var MAAND = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"];
      var over = new Date();
      over.setFullYear(over.getFullYear() + 1);
      koopVervalt = over.getDate() + " " + MAAND[over.getMonth()] + " " + over.getFullYear();

      document.getElementById("bought-domain").textContent = naam;
      document.getElementById("bought-price").textContent = koopTotaal.textContent + " EUR";
      document.querySelectorAll("[data-domain-expiry]").forEach(function (el) {
        el.textContent = koopVervalt;
      });
      document.getElementById("detail-view").href = "https://" + naam;

      /* Het domein staat meteen in de lijst, onder het primaire domein: gekocht
         is nog niet bereikbaar, dus Propagating. Opnieuw kopen vervangt de
         vorige regel. */
      var lijst = document.querySelector(".table--domains tbody");
      if (lijst) {
        if (koopRij) koopRij.remove();
        koopRij = document.createElement("tr");
        koopRij.className = "dom-child";
        koopRij.setAttribute("data-domain", "");
        koopRij.innerHTML =
          '<td><span class="dom dom--sub"><svg class="icon dom__icon" aria-hidden="true">' +
          '<use href="#i-redirect"/></svg><span class="dom__name"></span></span></td>' +
          '<td><span class="badge badge--pending">Propagating</span></td><td></td>';
        koopRij.querySelector(".dom__name").textContent = naam;
        lijst.insertBefore(koopRij, lijst.rows[1] || null);
      }

      /* Afrekenen is klaar, dus die schermen mogen dicht: de bevestiging hangt
         aan de domeinpagina, niet aan de winkelwagen. */
      /* De winkelnaam hierboven zette de opslaan-balk aan; die hoort niet bij
         een aankoop die al gedaan is. */
      hideSavebar();
      while (backFromSub()) { /* tot we weer op de domeinpagina staan */ }
      openSetSub("domain-bought", naam, "");
      showToast(naam + " purchased");
    });

    /* Van de bevestiging naar het domein zelf: dat is één stap opzij, geen
       stap dieper, dus eerst terug en dan de andere pagina open. */
    document.getElementById("bought-status").addEventListener("click", function () {
      var naam = document.getElementById("bought-domain").textContent;
      backFromSub();
      openSetSub("domain-detail", naam, "Managed by Opining · Expires on " + koopVervalt);
    });

    document.getElementById("detail-primary").addEventListener("click", function () {
      showToast("Wait until the domain is reachable before making it primary");
    });

    document.getElementById("detail-transfer").addEventListener("click", function () {
      showToast("A domain can be transferred 60 days after you bought it");
    });

    /* Deze twee schakelaars gelden meteen: een melding, geen opslaan-balk. */
    document.getElementById("domain-renew").addEventListener("change", function () {
      hideSavebar();
      showToast(this.checked ? "This domain renews every year"
                             : "Auto-renew is off. Your domain expires on " + koopVervalt);
    });

    document.getElementById("domain-whois").addEventListener("change", function () {
      hideSavebar();
      showToast(this.checked ? "Your contact details stay private"
                             : "Your contact details are public in the WHOIS register");
    });

    koopWinkel.addEventListener("input", function () {
      koopWinkel.classList.remove("input--error");
      koopFout.hidden = true;
    });
  }

  /* ---- Marketing-formulieren --------------------------------------------- */
  /* Codes zonder 0/O/1/I/L: die worden aan de balie stelselmatig verkeerd
     overgeschreven. */
  var CODE_TEKENS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

  function codeBlok(lengte, teller) {
    var uit = "";
    for (var i = 0; i < lengte; i++) uit += CODE_TEKENS[(teller * 7 + i * 13 + uit.length * 3) % CODE_TEKENS.length];
    return uit;
  }

  var codeTeller = 0;

  /* ---- Automatische korting: de nieuwe prijs volgt de invoer -------------- */
  var discView = document.querySelector('[data-view="discount-new"]');

  if (discView) {
    var discProduct = document.getElementById("disc-product");
    var discValue   = document.getElementById("disc-value");
    var discUnit    = document.getElementById("disc-unit");
    var discWas     = document.getElementById("disc-was");
    var discNow     = document.getElementById("disc-now");

    function euro(n) { return "€ " + n.toFixed(2).replace(".", ","); }

    /* Het scherm toont de korting én de prijs die eruit volgt; die mogen niet
       uiteenlopen, dus wordt de prijs berekend in plaats van ingetypt. */
    function toonPrijs() {
      var prijs = Number(discProduct.selectedOptions[0].dataset.price);
      var soort = discView.querySelector('input[name="disc-kind"]:checked').value;
      var waarde = Number(discValue.value) || 0;
      var nieuw = soort === "pct" ? prijs * (1 - waarde / 100) : prijs - waarde;
      discWas.textContent = euro(prijs);
      discNow.textContent = euro(Math.max(nieuw, 0));
      discUnit.textContent = soort === "pct" ? "%" : "€";
    }

    discView.addEventListener("input", toonPrijs);
    discView.addEventListener("change", function (e) {
      toonPrijs();
      /* Dagen horen bij "alleen op bepaalde dagen", data bij "tussen twee
         datums"; de rest staat uit zodat het scherm niet meer belooft dan
         de gekozen planning waarmaakt. */
      if (e.target.name === "disc-when") {
        var keuze = [].indexOf.call(discView.querySelectorAll('input[name="disc-when"]'), e.target);
        document.getElementById("disc-days").disabled = keuze !== 1;
        document.getElementById("disc-start").disabled = keuze !== 2;
        document.getElementById("disc-end").disabled = keuze !== 2;
      }
      /* Eén product kiezen kan alleen bij de eerste optie. */
      if (e.target.name === "disc-scope") {
        var s = [].indexOf.call(discView.querySelectorAll('input[name="disc-scope"]'), e.target);
        discProduct.disabled = s !== 0;
      }
    });

    toonPrijs();
  }

  /* ---- Voucher: kortingscode voor de checkout ----------------------------- */
  var vouGen = document.getElementById("vou-generate");

  if (vouGen) {
    vouGen.addEventListener("click", function () {
      codeTeller++;
      document.getElementById("vou-code").value = codeBlok(8, codeTeller);
    });

    var vouView = document.querySelector('[data-view="voucher-new"]');
    vouView.addEventListener("change", function (e) {
      if (e.target.name !== "vou-kind") return;
      /* Gratis bezorging heeft geen bedrag; het veld hoort dan uit te staan. */
      var soort = e.target.value;
      var veld = document.getElementById("vou-value");
      veld.disabled = soort === "del";
      document.getElementById("vou-unit").textContent = soort === "fix" ? "€" : "%";
    });
  }

  var campAudience = document.getElementById("camp-audience");
  if (campAudience) {
    /* Het aantal ontvangers staat op twee plekken; die mogen niet uiteenlopen. */
    function syncOntvangers() {
      var n = Number(campAudience.value).toLocaleString("nl-NL");
      document.getElementById("camp-count").textContent = n;
      document.getElementById("camp-count-btn").textContent = n;
    }
    campAudience.addEventListener("change", syncOntvangers);
    syncOntvangers();

    document.querySelectorAll('input[name="camp-when"]').forEach(function (radio, i) {
      radio.addEventListener("change", function () {
        document.getElementById("camp-date").disabled = i === 0;
        document.getElementById("camp-time").disabled = i === 0;
      });
    });
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
    /* Het formulier van een dag staat in zijn eigen vakje, of in het venster
       zolang je het wijzigt. Alles wat erin zit zoek je daarom hier op. */
    function dagVorm(rij) {
      if (dagOpen === rij) {
        var open = dagPlek.querySelector(".rev__form");
        if (open) return open;
      }
      return rij.querySelector(".rev__form");
    }

    /* Een dag heeft een dienst, of twee: een lunchdienst en een avonddienst.
       Dezelfde tekst voegt de tweede toe en haalt hem weer weg, zodat er geen
       los prullenbakje naast de tijden hoeft te staan. */
    function syncShifts(rij) {
      var vorm = dagVorm(rij);
      var knop = vorm.querySelector(".shift__toggle");
      if (knop) knop.textContent = vorm.querySelectorAll(".shift").length > 1 ? "Remove extra shift" : "Add shift";
    }

    /* Sluiten kan niet vóór openen. De melding hangt onder de dienst en niet
       in het veld: daar paste alleen een teken, en dat zei niet wát er mis
       was. Tijden zijn "HH:MM", dus tekstvergelijking is chronologisch. */
    var foutId = 0;
    function valideerShift(shift) {
      var velden = shift.querySelectorAll(".time");
      if (velden.length < 2) return;

      var eind = velden[1];
      var fout = velden[0].value && eind.value && eind.value <= velden[0].value;
      var melding = shift.nextElementSibling;
      if (melding && !melding.classList.contains("shift__error")) melding = null;

      eind.classList.toggle("time--error", !!fout);

      if (!fout) {
        if (melding) melding.remove();
        eind.removeAttribute("aria-invalid");
        eind.removeAttribute("aria-describedby");
        return;
      }

      if (!melding) {
        melding = document.createElement("p");
        melding.className = "shift__error";
        melding.id = "hours-err-" + (++foutId);
        melding.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-warning"/></svg>' +
          "Closing time must be later than the opening time.";
        shift.after(melding);
      }
      eind.setAttribute("aria-invalid", "true");
      eind.setAttribute("aria-describedby", melding.id);
    }

    /* De samenvatting is wat je van een dichtgeklapte dag ziet. Alleen de
       mobiele CSS toont hem; hier staat wat erin komt. */
    function syncSamenvatting(rij) {
      var sum = rij.querySelector(".hrow__sum");
      if (!sum) return;
      if (rij.classList.contains("is-off")) { sum.textContent = "Closed"; return; }
      var delen = [];
      dagVorm(rij).querySelectorAll(".shift").forEach(function (shift) {
        var velden = shift.querySelectorAll(".time");
        if (velden.length === 2) delen.push(velden[0].value + " - " + velden[1].value);
      });
      sum.textContent = delen.join("  ·  ");
    }

    /* De schakelaar zet de dag aan of uit: de tijden verdwijnen dan en er
       staat closed, en de regel erboven zegt Closed. */
    function setDagOpen(rij, open) {
      var vorm = dagVorm(rij);
      rij.classList.toggle("is-off", !open);
      vorm.querySelector(".shifts").hidden = !open;
      var stand = vorm.querySelector("[data-day-state]");
      if (stand) stand.textContent = open ? "Open" : "Closed";
      syncSamenvatting(rij);
    }

    /* Een dag wijzig je in een venster. Het formulier zelf blijft hetzelfde
       stuk HTML: het verhuist naar het venster zolang het open staat en gaat
       daarna terug naar zijn eigen vakje. Zo staat elk veld maar op één plek
       beschreven, en werken dezelfde handlers hieronder gewoon door. */
    var dagVenster = document.getElementById("day-dialog");
    var dagPlek = document.getElementById("day-dialog-body");
    var dagOpen = null;   /* de dag die nu open staat */
    var dagKopie = null;  /* hoe het formulier erbij stond voordat je begon */

    function openDag(rij) {
      var form = rij.querySelector(".rev__form");
      dagKopie = form.innerHTML;
      dagOpen = rij;
      document.getElementById("day-dialog-title").textContent =
        rij.querySelector(".rev__title").textContent;
      var stand = form.querySelector("[data-day-state]");
      if (stand) stand.textContent = form.querySelector(".switch input").checked ? "Open" : "Closed";
      form.hidden = false;
      /* Opslaan kan pas als er iets te bewaren is. */
      form.querySelector(".rev__save").disabled = true;
      dagPlek.appendChild(form);
      dagVenster.hidden = false;
    }

    /* Terug naar het vakje. Met herstel true komt de tekst terug zoals hij
       was, zodat Cancel en het kruisje hetzelfde doen. */
    function sluitDag(herstel) {
      if (!dagOpen) return;
      var form = dagPlek.querySelector(".rev__form");
      if (form) {
        if (herstel && dagKopie !== null) form.innerHTML = dagKopie;
        form.hidden = true;
        dagOpen.appendChild(form);
      }
      var schakelaar = dagOpen.querySelector(".switch input");
      if (schakelaar) dagOpen.classList.toggle("is-off", !schakelaar.checked);
      syncSamenvatting(dagOpen);
      syncShifts(dagOpen);
      dagVenster.hidden = true;
      dagOpen = null;
      dagKopie = null;
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-day-edit]")) {
        openDag(e.target.closest(".hrow"));
        return;
      }
      if (e.target.closest("[data-day-close]")) sluitDag(true);
    });
    hoursView.addEventListener("click", function (e) {
      /* Het formulier staat tijdens het wijzigen in het venster en niet meer
         in zijn eigen rij; dan wijst dagOpen de weg. */
      var rij = e.target.closest(".hrow") || dagOpen;
      if (!rij) return;

      if (e.target.closest(".rev__cancel")) { sluitDag(true); return; }

      if (e.target.closest(".rev__save")) {
        sluitDag(false);
        showToast(rij.querySelector(".rev__title").textContent + " saved");
        return;
      }
      if (e.target.closest(".shift__toggle")) {
        var vorm = dagVorm(rij);
        var alle = vorm.querySelectorAll(".shift");

        /* Staat er al een tweede dienst, dan haalt dezelfde tekst hem weg. */
        if (alle.length > 1) {
          var weg = alle[alle.length - 1];
          var fout = weg.nextElementSibling;
          if (fout && fout.classList.contains("shift__error")) fout.remove();
          weg.remove();
          syncShifts(rij);
          zetOpslaanKlaar(rij);
          return;
        }

        /* Niet .shift:last-child: onder de laatste dienst kan een foutmelding
           staan, en die is dan het laatste kind. */
        var laatste = alle[alle.length - 1];
        var kopie = laatste.cloneNode(true);
        /* De foutstaat hoort bij die ene waarde, niet bij een nieuwe dienst. */
        kopie.querySelectorAll(".time").forEach(function (veld) {
          veld.classList.remove("time--error");
          veld.removeAttribute("aria-invalid");
          veld.removeAttribute("aria-describedby");
        });
        /* Onderaan, dus onder de tekst die hem toevoegde: zo staat de tweede
           dienst waar je hem verwacht en niet boven de knop. */
        laatste.closest(".shifts").appendChild(kopie);
        /* De kopie draagt dezelfde tijden, dus geldt dezelfde toets. */
        valideerShift(kopie);
        syncShifts(rij);
        zetOpslaanKlaar(rij);
      }
    });

    /* Alles wat je in het formulier doet maakt opslaan mogelijk: een andere
       tijd, de schakelaar, of een dienst erbij of eraf. */
    function zetOpslaanKlaar(rij) {
      var knop = rij && dagVorm(rij).querySelector(".rev__save");
      if (knop) knop.disabled = false;
    }

    hoursView.addEventListener("change", function (e) {
      /* Tijdens het wijzigen staat het formulier in het venster, dus buiten
         de rij; dagOpen wijst dan de weg. */
      var rij = e.target.closest(".hrow") || dagOpen;
      if (!rij) return;
      if (e.target.matches(".switch input")) setDagOpen(rij, e.target.checked);
      zetOpslaanKlaar(rij);
    });

    hoursView.addEventListener("input", function (e) {
      var shift = e.target.closest(".shift");
      if (shift) valideerShift(shift);
      zetOpslaanKlaar(e.target.closest(".hrow") || dagOpen);
    });

    /* De schakelaar in de kop zet het hele kanaal aan of uit. De dagen blijven
       staan, maar je kunt er niets mee zolang je geen bezorging of afhaal
       aanbiedt. */
    hoursView.addEventListener("change", function (e) {
      if (!e.target.matches("[data-hours-on]")) return;
      var kaart = e.target.closest(".card");
      var lijst = kaart.querySelector(".hours");
      lijst.classList.toggle("is-off", !e.target.checked);
      var naam = kaart.querySelector(".acct__name").textContent.toLowerCase();
      showToast(e.target.checked ? "Orders are open for " + naam.replace(" hours", "")
                                 : "No orders for " + naam.replace(" hours", ""));
    });

    /* De tijden op de dichte regel komen uit de velden eronder. */
    hoursView.querySelectorAll(".hrow").forEach(function (rij) {
      syncSamenvatting(rij);
      /* Een dag die al twee diensten heeft, begint met Remove shift. */
      syncShifts(rij);
    });
    hoursView.querySelectorAll(".shift").forEach(valideerShift);
  }

  /* ---- Inklapbare kaartsecties ------------------------------------------- */
  /* Een .cardhead klapt in wat zijn aria-controls aanwijst. Gedelegeerd, dus
     het werkt ook voor secties die later in de HTML bijkomen. */
  document.addEventListener("click", function (e) {
    var kop = e.target.closest(".cardhead");
    if (!kop) return;
    /* De schakelaar in de kop zet het kanaal aan of uit; dat is iets anders
       dan de sectie open- of dichtklappen. */
    if (e.target.closest(".switch")) return;
    /* Staat er een knop in de kop, dan draagt die de stand. */
    var stuur = kop.querySelector("[aria-controls]") || kop;
    var open = stuur.getAttribute("aria-expanded") === "true";
    stuur.setAttribute("aria-expanded", open ? "false" : "true");
    var doel = document.getElementById(stuur.getAttribute("aria-controls"));
    if (doel) doel.hidden = open;
  });

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

  /* ---- Producten slepen om de volgorde te bepalen ------------------------
     Pointer-events in plaats van HTML5 drag-and-drop: dat laatste doet op
     touch niets. Beweging en loslaten luisteren op het venster, zodat slepen
     doorgaat ook buiten de rij. De nieuwe plek volgt uit de middens van de
     andere rijen, gemeten zonder transform: rijen die nog opzij glijden
     zouden de gesleepte rij anders heen en weer laten springen. De rij die je
     vasthebt zweeft los met een schaduw; een grijs vak op ware grootte laat
     zien waar hij landt.

     Een nieuwe volgorde gaat niet vanzelf live. Wijkt hij af van wat bewaard
     is, dan komt de savebar; terugslepen naar de bewaarde volgorde haalt hem
     weer weg, en Discard zet elke rij terug. */
  var sorteerLijsten = document.querySelectorAll('[data-view="products"] .group__list');
  var bewaardeVolgorde = new Map();
  var rustig = window.matchMedia("(prefers-reduced-motion: reduce)");

  function legVolgordeVast() {
    sorteerLijsten.forEach(function (l) { bewaardeVolgorde.set(l, [].slice.call(l.children)); });
  }
  function volgordeGewijzigd() {
    return [].some.call(sorteerLijsten, function (l) {
      var bewaard = bewaardeVolgorde.get(l);
      return [].some.call(l.children, function (li, i) { return li !== bewaard[i]; });
    });
  }
  legVolgordeVast();

  /* Rijen die van plek wisselen glijden erheen in plaats van te springen:
     eerst meten, dan verplaatsen, dan het verschil wegschuiven. */
  function glij(rijen, verplaats) {
    if (rustig.matches) { verplaats(); return; }
    var was = new Map();
    rijen.forEach(function (li) { was.set(li, li.getBoundingClientRect().top); });
    verplaats();
    rijen.forEach(function (li) {
      var dy = was.get(li) - li.getBoundingClientRect().top;
      if (!dy) return;
      li.style.transition = "none";
      li.style.transform = "translateY(" + dy + "px)";
      li.getBoundingClientRect();
      li.style.transition = "transform 160ms ease";
      li.style.transform = "";
    });
  }

  document.addEventListener("pointerdown", function (e) {
    var greep = e.target.closest(".prod__handle");
    if (!greep || e.button > 0) return;

    var rij = greep.closest(".prod");
    var lijst = rij.parentElement;
    var vak = rij.getBoundingClientRect();
    /* Waar je de rij vastpakte, zodat hij niet naar de pointer toe springt. */
    var grip = e.clientY - vak.top;
    e.preventDefault();

    /* Het grijze vak houdt de plek vast waar de rij landt, op ware grootte. */
    var plek = document.createElement("li");
    plek.className = "prod-slot";
    plek.style.height = vak.height + "px";
    plek.setAttribute("aria-hidden", "true");
    lijst.insertBefore(plek, rij);

    /* De rij zelf zweeft boven de lijst en volgt de pointer. */
    rij.classList.add("is-floating");
    /* Een eindje naar rechts, zodat het grijze vak eronder zichtbaar blijft. */
    rij.style.left = (vak.left + 18) + "px";
    rij.style.top = vak.top + "px";
    rij.style.width = vak.width + "px";
    root.classList.add("is-sorting");

    function volgendeNaPlek() {
      var n = plek.nextElementSibling;
      return n === rij ? n.nextElementSibling : n;
    }

    function verplaats(ev) {
      rij.style.top = (ev.clientY - grip) + "px";

      /* Weggefilterde rijen tellen niet mee: daar kun je niet tussen landen. */
      var andere = [].slice.call(lijst.children).filter(function (li) {
        return li !== rij && li !== plek && !li.hidden && !li.hasAttribute("data-filtered");
      });
      /* Pointer en rijmiddens in dezelfde maat: vanaf de bovenkant van de
         lijst, zonder transform. */
      var y = ev.clientY - lijst.getBoundingClientRect().top;
      var voor = null;
      for (var i = 0; i < andere.length; i++) {
        var li = andere[i];
        if (y < li.offsetTop - lijst.offsetTop + li.offsetHeight / 2) { voor = li; break; }
      }
      if (volgendeNaPlek() === voor) return;

      var schuivers = [].slice.call(lijst.children).filter(function (li) { return li !== rij; });
      glij(schuivers, function () {
        if (voor) lijst.insertBefore(plek, voor); else lijst.appendChild(plek);
      });
    }

    function stop() {
      window.removeEventListener("pointermove", verplaats);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);

      /* Neerzetten waar het grijze vak staat, en vanaf de zweefplek erheen glijden. */
      var zweefde = rij.getBoundingClientRect();
      lijst.insertBefore(rij, plek);
      plek.remove();
      rij.classList.remove("is-floating");
      rij.style.left = "";
      rij.style.top = "";
      rij.style.width = "";
      root.classList.remove("is-sorting");
      [].forEach.call(lijst.children, function (li) { li.style.transition = ""; li.style.transform = ""; });

      var nu = rij.getBoundingClientRect();
      var dx = zweefde.left - nu.left;
      var dy = zweefde.top - nu.top;
      if ((dx || dy) && !rustig.matches) {
        rij.style.transform = "translate(" + dx + "px, " + dy + "px)";
        rij.getBoundingClientRect();
        rij.style.transition = "transform 160ms ease";
        rij.style.transform = "";
        rij.addEventListener("transitionend", function klaar() {
          rij.style.transition = "";
          rij.removeEventListener("transitionend", klaar);
        });
      }

      /* Afwijkend van wat bewaard is: vragen om te bewaren. Terug op de
         bewaarde volgorde: niets te bewaren, dus de savebar weg. */
      if (volgordeGewijzigd()) markUnsavedZin("Product order saved");
      else hideSavebar();
    }

    window.addEventListener("pointermove", verplaats);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  });

  /* Save legt de nieuwe volgorde vast; Discard zet elke rij terug waar hij stond. */
  savebar.addEventListener("click", function (e) {
    var actie = e.target.closest("[data-save]");
    if (!actie) return;
    if (actie.dataset.save === "save") { legVolgordeVast(); return; }
    bewaardeVolgorde.forEach(function (rijen, lijst) {
      rijen.forEach(function (li) { lijst.appendChild(li); });
    });
  });

  /* Tabs zitten op meerdere plekken (producten, billing), dus één gedelegeerde
     afhandeling binnen de eigen .tabs-groep. */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest(".tab");
    if (!tab) return;
    tab.closest(".tabs").querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
    tab.classList.add("is-active");

    /* Een tab is een filter, geen etiket: de lijst volgt meteen. */
    var kop = tab.closest(".panel__head");
    if (kop) pasPaneelFilter(kop);
  });

  /* ---- Paginakop: actieknop en paginagebonden bediening ------------------ */
  var pageAction = document.getElementById("page-action");
  var pageActionLabel = document.getElementById("page-action-label");

  var pageActionIcon = document.getElementById("page-action-icon");

  /* Elke lijstpagina heeft zijn eigen actie; Online Store wijkt af met een
     zachte knop in plaats van de primaire toevoegknop. */
  var PAGINA_ACTIES = {
    /* Menupaginas: alleen tekst op de knop. */
    products:       { label: "Add product",   zacht: false },
    choices:        { label: "Add new",       zacht: false },
    categories:     { label: "Add categorie", zacht: false },
    deliverers:     { label: "Add deliverer", icon: "i-plus", zacht: false },
    discounts:      { label: "Create discount", icon: "i-plus", zacht: false, opent: "discount-new" },
    vouchers:       { label: "Create voucher",  icon: "i-plus", zacht: false, opent: "voucher-new" },
    "email-campaigns": { label: "New campaign", icon: "i-plus", zacht: false, opent: "campaign-new" },
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
    /* Zonder icoon verdwijnt het teken; .hidden werkt niet op een svg, dus
       het attribuut zelf. */
    var teken = pageActionIcon.parentNode;
    if (actie.icon) { pageActionIcon.setAttribute("href", "#" + actie.icon); teken.removeAttribute("hidden"); }
    else teken.setAttribute("hidden", "");
    /* Acties die een aanmaakscherm openen dragen dat scherm mee; de
       gedelegeerde handler in §2 pikt data-open-view op. */
    if (actie.opent) {
      pageAction.dataset.openView = actie.opent;
      pageAction.dataset.viewTitle = actie.label;
    } else {
      delete pageAction.dataset.openView;
      delete pageAction.dataset.viewTitle;
    }
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

  var setTools = document.querySelectorAll("[data-set-tools], [data-sub-tools]");
  var setBadge = document.getElementById("set-badge");

  function showSetPage(page, title, icon) {
    setTitle.textContent = title;
    swapIcon(setIcon, icon);
    toonSetTools(page);

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


  /* ---- De betaalpagina heeft twee gezichten -------------------------------
     Voor het versturen van de aanvraag staat er reclame; zodra die verstuurd
     is, staat er wat je vanaf dan te regelen hebt. data-pay-state zegt van elk
     blok bij welke van de twee het hoort. */
  var betaalStand = "off";

  function zetBetaalStand(stand) {
    betaalStand = stand;
    document.querySelectorAll("[data-pay-state]").forEach(function (el) {
      el.hidden = el.dataset.payState !== stand;
    });
    /* De knoppen op de titelregel horen daarnaast bij één pagina; laat de
       regel hieronder daar opnieuw over beslissen. */
    var actief = setNav.querySelector(".nav__item.is-active");
    if (actief) toonSetTools(actief.dataset.set);
  }

  function toonSetTools(page) {
    setTools.forEach(function (el) {
      el.hidden = el.dataset.setTools !== page ||
        (el.dataset.payState !== undefined && el.dataset.payState !== betaalStand);
    });
  }

  /* Stand van de verificatie bij Pay.nl, op de betaalpagina als data-verify:
     setup (het account wordt aangemaakt), pending (Pay.nl controleert) of
     failed. Hier gaat setup na een paar tellen vanzelf over in pending; echt
     komt die overgang uit de koppeling met Pay.nl. */
  var betaalSectie = document.querySelector("[data-set-view=\"payments\"]");
  var verificatieTimer = null;

  function zetVerificatie(stand) {
    if (betaalSectie) betaalSectie.dataset.verify = stand;
  }

  function startVerificatie() {
    zetVerificatie("setup");
    clearTimeout(verificatieTimer);
    verificatieTimer = setTimeout(function () { zetVerificatie("pending"); }, 4000);
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
  var stapel       = [];   /* pagina's waar we vandaan komen, onderste eerst */

  function huidigeSub() {
    var open = document.querySelector("[data-set-sub]:not([hidden])");
    return open ? open.dataset.setSub : null;
  }

  /* Het icoon gaat een stap terug, naar de pagina direct erboven: op de
     tarievenpagina dus Payment methods, niet Payments. Daarom onthouden we
     elke stap. De naam staat alleen in de tooltip, niet in de kopregel. */
  function toonKruimel() {
    var boven = stapel[stapel.length - 1];
    if (!boven) { setCrumb.hidden = true; setIcon.removeAttribute("hidden"); return; }
    setCrumbIcon.querySelector("use")
      .setAttribute("href", setIcon.querySelector("use").getAttribute("href"));
    setCrumb.setAttribute("aria-label", "Back to " + boven.titel);
    setCrumb.setAttribute("title", "Back to " + boven.titel);
    setCrumb.hidden = false;
    /* Let op: .hidden is een eigenschap van HTMLElement, niet van SVG. Op een
       <svg> moet je het attribuut zetten, anders gebeurt er niets. */
    setIcon.setAttribute("hidden", "");
  }

  /* Laat een subpagina zien. Los van openSetSub, want terugkomen op een
     subpagina mag niets aan de stapel toevoegen. */
  function toonSub(sub, titel, lead) {
    var open = document.querySelector("[data-set-view]:not([hidden])");
    if (open) open.hidden = true;
    setSubs.forEach(function (v) { v.hidden = v.dataset.setSub !== sub; });
    /* De knoppen van de pagina erboven horen hier niet meer; een subpagina
       met eigen knoppen zet ze met data-sub-tools. */
    setTools.forEach(function (el) { el.hidden = el.dataset.subTools !== sub; });
    /* Een pagina die om je aandacht vraagt (afrekenen) krijgt de volle breedte:
       de settingsnavigatie ernaast leidt daar alleen maar van af. */
    var vol = document.querySelector('[data-set-sub="' + sub + '"]');
    if (vol && vol.hasAttribute("data-sub-full")) root.dataset.settingsFull = "on";
    else delete root.dataset.settingsFull;
    /* Een pagina die alleen een bericht is (de bevestiging na een aankoop)
       heeft geen kop nodig: er valt niets te benoemen en nergens heen te
       gaan behalve de knop die er staat. */
    if (vol && vol.hasAttribute("data-sub-bare")) root.dataset.settingsBare = "on";
    else delete root.dataset.settingsBare;

    /* Een subpagina mag een eigen stand naast de titel zetten. */
    setBadge.textContent = (vol && vol.dataset.subBadge) || "";
    setBadge.hidden = !setBadge.textContent;

    toonKruimel();
    setTitle.textContent = titel;
    setLead.textContent = lead || "";
    setLead.hidden = !lead;
    if (resetWiz) resetWiz(1);
    overlay.scrollTop = 0;
  }

  function openSetSub(sub, titel, lead) {
    stapel.push({ titel: setTitle.textContent, sub: huidigeSub(),
                  lead: setLead.hidden ? "" : setLead.textContent });
    toonSub(sub, titel, lead);
  }

  /* Alles dicht: terug naar de settings-pagina zelf. */
  function closeSetSub() {
    if (!stapel.length) return;
    var onderste = stapel[0];
    stapel.length = 0;
    setSubs.forEach(function (v) { v.hidden = true; });
    delete root.dataset.settingsFull;
    delete root.dataset.settingsBare;
    setCrumb.hidden = true;
    setIcon.removeAttribute("hidden");
    setTitle.textContent = onderste.titel;
    setLead.hidden = true;
    setBadge.hidden = true;
  }

  /* Een stap terug: naar de subpagina eronder, of naar de settings-pagina.
     Geeft terug of er echt iets terugging, zodat de mobiele terugknop weet of
     hij daarna nog naar de lijst moet. */
  function backFromSub() {
    var terug = stapel.pop();
    if (!terug) return false;
    if (terug.sub) { toonSub(terug.sub, terug.titel, terug.lead); return true; }
    stapel.length = 0;
    setSubs.forEach(function (v) { v.hidden = true; });
    delete root.dataset.settingsFull;
    delete root.dataset.settingsBare;
    setCrumb.hidden = true;
    setIcon.removeAttribute("hidden");
    setLead.hidden = true;
    setBadge.hidden = true;
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
     Eén of meer kaarten per stap; de teller en de balk volgen de actieve stap. */
  var wiz = document.getElementById("pay-wiz");
  /* Buiten het blok gedeclareerd zodat openSetSub het formulier kan
     terugzetten als je de wizard opnieuw binnenkomt. */
  var resetWiz = null;

  if (wiz) {
    var wizNu      = document.getElementById("wiz-now");
    var wizTotaal  = document.getElementById("wiz-total");
    var wizBalk    = document.getElementById("wiz-bar");
    var wizTrack   = wizBalk.parentNode;
    var wizVorige  = document.getElementById("wiz-back");
    var wizVolgende = document.getElementById("wiz-next");
    var stap = 1;

    /* Welke stappen er zijn hangt van de rechtsvorm af: een eenmanszaak heeft
       maar een betrokkene, dus de stap waarin je er meer toevoegt bestaat daar
       niet. De reeks wordt daarom elke keer opnieuw bepaald, en de teller telt
       de stappen die je werkelijk langsgaat. */
    function wizReeks() {
      var reeks = [];
      wiz.querySelectorAll(".card[data-step]").forEach(function (kaart) {
        var n = Number(kaart.dataset.step);
        if (kaart.dataset.off === "ja") return;
        if (reeks.indexOf(n) === -1) reeks.push(n);
      });
      return reeks.sort(function (a, b) { return a - b; });
    }

    function toonStap(n) {
      /* De samenvatting krijgt een blok per betrokkene uit stap 3; die blokken
         bestaan pas als je hier komt, dus eerst bijwerken. Dat gebeurt met een
         bericht, want de betrokkenen worden verderop in dit bestand geregeld. */
      document.dispatchEvent(new CustomEvent("wiz-stap", { detail: n }));

      var reeks = wizReeks();
      if (!reeks.length) return;
      /* Een stap die er in deze rechtsvorm niet is: pak de eerstvolgende. */
      if (reeks.indexOf(n) === -1) {
        var hoger = reeks.filter(function (s) { return s >= n; });
        n = hoger.length ? hoger[0] : reeks[reeks.length - 1];
      }
      stap = n;
      var i = reeks.indexOf(stap);

      /* Opnieuw opzoeken: er kunnen blokken bij gekomen zijn. */
      wiz.querySelectorAll("[data-step]").forEach(function (kaart) {
        var anders = Number(kaart.dataset.step) !== stap;
        /* Van de twee betrokkenen-kaarten hoort er maar een bij de rechtsvorm
           die in stap 1 gekozen is. */
        kaart.hidden = anders || kaart.dataset.off === "ja";
      });
      wizNu.textContent = i + 1;
      wizTotaal.textContent = reeks.length;
      wizBalk.style.width = ((i + 1) / reeks.length * 100) + "%";
      wizTrack.setAttribute("aria-valuenow", i + 1);
      wizTrack.setAttribute("aria-valuemax", reeks.length);
      wizVorige.hidden = i === 0;
      /* Laatste stap rondt af in plaats van door te gaan. */
      wizVolgende.textContent = i === reeks.length - 1 ? "Submit for verification" : "Next";
      /* Een vakje dat nog openstond hoort dicht als je de stap opnieuw ziet. */
      wiz.querySelectorAll(".rev").forEach(function (vak) { zetRev(vak, false); });
      zetStapKlaar();
      overlay.scrollTop = 0;
    }

    /* Doorlopen kan pas als de stap af is: elk gevraagd veld ingevuld, en op
       de laatste stap ook elk stuk aangeleverd en de overeenkomst getekend.
       Zo kom je niet aan het eind met gaten in je aanvraag. */
    /* Een KVK-nummer is precies acht cijfers. Dat is hier te controleren
       zonder het handelsregister; of het nummer ook bestaat, blijkt pas bij
       de koppeling na het opslaan. */
    var KVK_VORM = /^\d{8}$/;
    var kvkVeld  = document.getElementById("biz-kvk");
    var kvkFout  = document.getElementById("biz-kvk-error");

    function kvkGoed() { return !kvkVeld || KVK_VORM.test(kvkVeld.value.trim()); }

    if (kvkVeld) {
      kvkVeld.addEventListener("input", function () {
        /* Het veld is numeriek, dus geplakte punten, spaties of letters
           worden stil weggehaald in plaats van afgekeurd. */
        var schoon = kvkVeld.value.replace(/\D/g, "").slice(0, 8);
        if (schoon !== kvkVeld.value) kvkVeld.value = schoon;
        kvkFout.hidden = true;
        kvkVeld.classList.remove("input--error");
      });

      /* Pas melden als je het veld verlaat: tijdens het typen zijn vier
         cijfers nog geen fout, alleen nog niet af. */
      kvkVeld.addEventListener("blur", function () {
        var fout = !!kvkVeld.value.trim() && !kvkGoed();
        kvkFout.hidden = !fout;
        kvkVeld.classList.toggle("input--error", fout);
      });
    }

    function stapKlaar() {
      var persVak = document.getElementById("person-form");
      /* Het veldenvak van een betrokkene telt alleen mee in de stap over
         jezelf; sta je in de lijst iemand te bewerken, dan hoort dat vak bij
         die regel en niet bij de stap. */
      var persTelt = persVak && persVak.classList.contains("persform--kaal") && !persVak.hidden;
      var klaar = true;

      wiz.querySelectorAll(".card[data-step]:not([hidden]) [required]").forEach(function (veld) {
        if (veld.closest("[hidden]")) return;
        if (persVak && persVak.contains(veld) && !persTelt) return;
        if (!String(veld.value).trim()) klaar = false;
      });

      /* Leeg wordt hierboven al afgevangen; dit vangt een nummer dat wel
         ingevuld is maar nog geen acht cijfers telt. Alleen zolang het veld
         zichtbaar is, net als de lus hierboven. */
      if (kvkVeld && !kvkVeld.closest("[hidden]") && !kvkGoed()) klaar = false;

      /* De laatste stap: alle stukken binnen en getekend. */
      var reeks = wizReeks();
      if (reeks.indexOf(stap) === reeks.length - 1) {
        wiz.querySelectorAll("[data-doc] [data-doc-file]").forEach(function (el) {
          if (el.hidden) klaar = false;
        });
        var stand = document.querySelector("[data-sign-state]");
        if (stand && stand.textContent !== "Sent") klaar = false;
      }
      return klaar;
    }

    function zetStapKlaar() {
      /* Bij het bijwerken van een afgekeurde aanvraag bepaalt die code de
         knop; dan blijven we eraf. */
      if (wiz.classList.contains("is-update")) return;
      wizVolgende.disabled = !stapKlaar();
    }

    wiz.addEventListener("input", zetStapKlaar);
    wiz.addEventListener("change", zetStapKlaar);
    document.addEventListener("upload-stand", zetStapKlaar);
    document.addEventListener("wiz-klaar", zetStapKlaar);

    /* Een stap verder of terug in de reeks, niet in de nummering. */
    function schuif(richting) {
      var reeks = wizReeks();
      var i = reeks.indexOf(stap) + richting;
      if (i >= 0 && i < reeks.length) toonStap(reeks[i]);
      return i < reeks.length;
    }

    wizVorige.addEventListener("click", function () { schuif(-1); });

    /* Andersom kan ook: een blok elders vraagt om een stap, bijvoorbeeld het
       potlood in de samenvatting dat je terugbrengt naar de betrokkenen. */
    document.addEventListener("wiz-ga", function (e) { toonStap(e.detail); });
    wizVolgende.addEventListener("click", function () {
      var reeks = wizReeks();
      if (reeks.indexOf(stap) < reeks.length - 1) { schuif(1); return; }
      backFromSub();
      /* De aanvraag is de deur uit; de betaalpagina laat vanaf nu zien wat je
         te regelen hebt in plaats van waarom je zou beginnen. */
      zetBetaalStand("on");
      startVerificatie();
      showToast("Details submitted for verification");
    });

    /* Het potlood klapt hetzelfde vakje open als formulier: je wijzigt het
       gegeven waar het staat, in plaats van zes stappen terug te lopen. */
    function zetRev(vak, bewerken) {
      var lees = vak.querySelector(".rev__read");
      var vorm = vak.querySelector(".rev__form");
      /* Niet elk vak in deze stijl heeft een lees- en een schrijfstand: het
         vak waarin je een betrokkene invult is er altijd een om te vullen. */
      if (!lees || !vorm) return;
      lees.hidden = bewerken;
      vorm.hidden = !bewerken;
    }

    wiz.addEventListener("click", function (e) {
      var pen = e.target.closest(".rev__pen");
      if (pen) { zetRev(pen.closest(".rev"), true); return; }
      var stop = e.target.closest(".rev__cancel");
      if (stop) { zetRev(stop.closest(".rev"), false); return; }
      var bewaar = e.target.closest(".rev__save");
      if (bewaar) { zetRev(bewaar.closest(".rev"), false); showToast("Changes saved"); }
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
  /* Een besturing die zelf al een hele zin oplevert ("Dutch is now the default
     language") zet die hier neer; anders maakt de savebar er "<pagina> saved"
     van. Leeg na elke andere wijziging, want dan slaat die zin nergens meer op. */
  var saveZin = "";
  function markUnsaved(label) { saveLabel = label; saveZin = ""; setSavebar(true); }
  function markUnsavedZin(zin) { saveZin = zin; setSavebar(true); }

  /* Wat in een eigen vakje met Cancel en Save staat bewaart zichzelf, wat
     meteen geldt (data-instant) hoeft er niet om te vragen, en de onboarding
     heeft onderaan zijn eigen knoppen. In al die gevallen zwijgt de balk. */
  function showSavebar(e) {
    if (e && e.target.closest && e.target.closest(".rev__form, [data-instant], .wiz")) return;
    if (root.dataset.settings === "open") markUnsaved(setTitle.textContent);
  }
  function hideSavebar() { setSavebar(false); }

  overlay.addEventListener("change", showSavebar);
  overlay.addEventListener("input", showSavebar);
  savebar.addEventListener("click", function (e) {
    var actie = e.target.closest("[data-save]");
    if (!actie) return;
    hideSavebar();
    /* De melding benoemt wat er bewaard is; de settings-kop weet dat al. */
    if (actie.dataset.save === "save") showToast(saveZin || saveLabel + " saved");
    saveZin = "";
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

  /* ---- Taalkeuzes met de Save-knop ----------------------------------------
     Twee lijstjes die hetzelfde werken: de taal van de winkel (wat de gast
     ziet) en de taal van dit dashboard (alleen voor jou). Terugkiezen wat er
     al stond laat de balk weer verdwijnen, want dan is er niets te bewaren. */
  var TAALGROEPEN = {
    "admin-lang": { zin: function (v) { return "This dashboard is now in " + v; } }
  };

  function taalKeuze(naam) { return document.querySelector('[name="' + naam + '"]:checked'); }

  Object.keys(TAALGROEPEN).forEach(function (naam) {
    TAALGROEPEN[naam].bewaard = (taalKeuze(naam) || {}).value;
  });

  document.addEventListener("change", function (e) {
    var groep = TAALGROEPEN[e.target.name];
    if (!groep) return;
    if (e.target.value === groep.bewaard) { hideSavebar(); return; }
    markUnsavedZin(groep.zin(e.target.value));
  });

  /* Save legt de keuze vast; Discard zet het rondje terug waar het stond,
     anders staat er een keuze in beeld die niet bewaard is. */
  savebar.addEventListener("click", function (e) {
    var actie = e.target.closest("[data-save]");
    if (!actie) return;
    Object.keys(TAALGROEPEN).forEach(function (naam) {
      var groep = TAALGROEPEN[naam];
      if (actie.dataset.save === "save") {
        var gekozen = taalKeuze(naam);
        if (gekozen) groep.bewaard = gekozen.value;
        return;
      }
      var terug = document.querySelector('[name="' + naam + '"][value="' + groep.bewaard + '"]');
      if (terug) terug.checked = true;
    });
  });


  /* ---- Gegevens bijwerken na een afwijzing --------------------------------
     Dezelfde controlestap, maar dan als opdracht: wat klopt er niet en welk
     stuk ontbreekt nog. De knop Update op de betaalpagina komt hier binnen;
     Complete account setup zet de stand terug naar de eerste aanvraag.
     Opnieuw versturen kan pas als het ontbrekende document er is en de
     gegevens opnieuw zijn opgeslagen. */
  function zetWizardStand(update) {
    var wizVak = document.getElementById("pay-wiz");
    if (!wizVak) return;
    wizVak.classList.toggle("is-update", update);
    delete wizVak.dataset.bijgewerkt;

    /* De vertegenwoordiger is al in orde; dat blok mag dicht. */
    var repKop = wizVak.querySelector("[aria-controls=\"review-rep\"]");
    var repVak = document.getElementById("review-rep");
    if (repKop && repVak) {
      repKop.setAttribute("aria-expanded", update ? "false" : "true");
      repVak.hidden = update;
    }

    /* Een document dat nog niet is aangeleverd, valt op met een rood teken. */
    wizVak.querySelectorAll("[data-doc]").forEach(function (rij) {
      if (!rij.querySelector("[data-doc-file]").hidden) return;
      rij.querySelector(".row__icon use").setAttribute("href", update ? "#i-alert" : "#i-file");
      rij.querySelector(".row__icon").classList.toggle("row__icon--alert", update);
    });
  }

  function zetUpdateKlaar() {
    var wizVak = document.getElementById("pay-wiz");
    var knop = document.getElementById("wiz-next");
    if (!wizVak || !knop) return;
    /* Buiten het bijwerken bepaalt de stap zelf of je verder mag; dat wordt
       elders geregeld, dus laat de knop daar met rust. */
    if (!wizVak.classList.contains("is-update")) {
      document.dispatchEvent(new CustomEvent("wiz-klaar"));
      return;
    }
    /* Opnieuw versturen mag zodra elk gevraagd stuk er is en de gegevens
       opnieuw zijn opgeslagen. Welke stukken dat zijn hangt van de stap af,
       dus we kijken naar de regels die er staan. */
    var stukken = wizVak.querySelectorAll("[data-doc] [data-doc-file]");
    var compleet = [].every.call(stukken, function (el) { return !el.hidden; });
    knop.textContent = "Submit information";
    knop.disabled = !(compleet && wizVak.dataset.bijgewerkt === "ja");
  }

  document.addEventListener("click", function (e) {
    var knop = e.target.closest("[data-sub=\"payments-setup\"]");
    if (!knop) return;
    var update = knop.hasAttribute("data-update");
    zetWizardStand(update);
    /* Bijwerken begint bij de controlestap, niet bij stap een. */
    if (update && resetWiz) resetWiz(99);
    zetUpdateKlaar();
  });

  document.addEventListener("click", function (e) {
    var wizVak = document.getElementById("pay-wiz");
    if (!wizVak) return;
    /* Opslaan in het blok van de zaak telt als bijgewerkt; een aangeleverd
       document telt vanzelf mee via de regel zelf. */
    if (e.target.closest("#review-business .rev__save")) wizVak.dataset.bijgewerkt = "ja";
    if (e.target.closest("#doc-done")) {
      /* Aangeleverd: de rode markering hoort weg, ook al komt er geen vinkje. */
      wizVak.querySelectorAll("[data-doc]").forEach(function (rij) {
        if (rij.querySelector("[data-doc-file]").hidden) return;
        rij.querySelector(".row__icon use").setAttribute("href", "#i-file");
        rij.querySelector(".row__icon").classList.remove("row__icon--alert");
      });
    }
    if (e.target.closest("#review-business .rev__save") || e.target.closest("#doc-done")) zetUpdateKlaar();
    /* Verstuurd: de opdracht is voorbij, de wizard staat weer normaal. */
    if (e.target.closest("#wiz-next") && wizVak.classList.contains("is-update")) {
      zetWizardStand(false);
      zetUpdateKlaar();
    }
  });

  /* ---- Uitbetaalrekening wijzigen ----------------------------------------
     Eerst het volledige IBAN van de huidige rekening, dan het nieuwe. Save
     gaat aan zodra beide zijn ingevuld; klopt het oude niet, dan zegt het
     veld dat en wordt er niets bewaard. Spaties en kleine letters tellen
     niet mee, zoals een IBAN meestal wordt overgetypt. */
  var bankOud = document.getElementById("bank-old");

  if (bankOud) {
    var bankNieuw = document.getElementById("bank-nr");
    var bankBewaar = document.getElementById("bank-save");
    var bankFout = document.getElementById("bank-old-error");
    var HUIDIG_IBAN = "NL91ABNA0417164300";
    var ibanKaal = function (v) { return v.replace(/\s+/g, "").toUpperCase(); };

    function zetBankKlaar() {
      bankBewaar.disabled = !(ibanKaal(bankOud.value) && ibanKaal(bankNieuw.value));
    }

    bankOud.addEventListener("input", function () {
      bankFout.hidden = true;
      bankOud.classList.remove("input--error");
      zetBankKlaar();
    });
    bankNieuw.addEventListener("input", zetBankKlaar);

    bankBewaar.addEventListener("click", function () {
      if (ibanKaal(bankOud.value) !== HUIDIG_IBAN) {
        bankFout.hidden = false;
        bankOud.classList.add("input--error");
        bankOud.focus();
        return;
      }
      bankOud.value = "";
      bankNieuw.value = "";
      zetBankKlaar();
      backFromSub();
      showToast("Bank account changed");
    });
  }

  /* ---- Documenten uploaden in de controlestap -----------------------------
     Een venster voor alle drie de documenten. Per soort staat hier welke
     gegevens er letterlijk op moeten staan, welke stukken gelden en welke
     bestanden. Een identiteitsbewijs met twee kanten vraagt twee vakken, voor
     en achter. De vakken komen pas na de keuze, en Done gaat pas aan als elk
     vak een bestand heeft. */
  var docVenster = document.getElementById("doc-dialog");

  if (docVenster) {
    var KVK = "∗∗∗∗1595";
    var ADRES = "Lusthofstraat 27A, 3062 WB Rotterdam, Netherlands";
    var MET_PDF = { accept: ".jpg,.jpeg,.png,.pdf", tekst: "Accepts .jpg, .png, and .pdf",
                    patroon: /\.(jpe?g|png|pdf)$/i, fout: "This file type is not accepted. Use .jpg, .png or .pdf." };
    /* Een ID is een foto van het echte document, geen scan: dus geen pdf. */
    var FOTO = { accept: ".jpg,.jpeg,.png", tekst: "Accepts .jpg and .png",
                 patroon: /\.(jpe?g|png)$/i, fout: "This file type is not accepted. Use a .jpg or .png photo." };
    var SCHERP = "Must be clear, complete and uncropped. Avoid grayscale scans and photos of photos.";
    var TWEE = ["Front", "Back"];

    /* De gegevens die op een stuk moeten staan komen uit de wizard, dus ze
       worden pas opgehaald als je het venster opent. */
    function zaakGegevens() {
      var naam = document.getElementById("biz-name");
      var kvk = document.getElementById("biz-kvk");
      var adres = document.querySelector("[data-sum-address]");
      return {
        naam: (naam && naam.value.trim()) || "Your business",
        kvk: (kvk && kvk.value.trim()) || KVK,
        adres: (adres && adres.textContent.trim()) || ADRES
      };
    }

    var DOC_SOORTEN = {
      business: {
        titel: "Upload Chamber of Commerce extract",
        lead: "Upload a valid government-issued document that includes these exact details:",
        label: "Chamber of Commerce extract",
        uitleg: "An extract from the Chamber of Commerce that shows the details above, no older than three months.",
        gegevens: function () {
          var z = zaakGegevens();
          return [["Registered name", z.naam], ["Chamber of Commerce registration number (KVK)", z.kvk],
                  ["Address", z.adres]];
        },
        keuzes: [{ naam: "Chamber of Commerce extract (KVK)" }, { naam: "Articles of association" },
                 { naam: "VAT registration certificate" }],
        bestand: MET_PDF,
        regel: SCHERP
      },
      ubo: {
        titel: "Upload UBO register extract",
        lead: "Upload the extract that includes these exact details:",
        label: "UBO register extract",
        uitleg: "The extract from the UBO register that shows who the ultimate beneficial owners are. "
              + "A sole proprietorship is not in that register, so it is not asked there.",
        gegevens: function () {
          var z = zaakGegevens();
          return [["Registered name", z.naam], ["Chamber of Commerce registration number (KVK)", z.kvk]];
        },
        keuzes: [{ naam: "UBO register extract" }],
        bestand: MET_PDF,
        regel: SCHERP
      },
      residence: {
        titel: "Upload residential address document",
        lead: "Upload a valid document that includes these exact details:",
        label: "Residential address document",
        uitleg: "A document from the last three months, addressed to you at the address above.",
        gegevens: [["Legal name", "Serdar Orman"], ["Residential address", ADRES]],
        keuzes: [{ naam: "Bank statement" }, { naam: "Government issued letter" }, { naam: "Proof of home insurance" }, { naam: "Utility bill" }],
        bestand: MET_PDF,
        regel: SCHERP
      },
      identity: {
        titel: "Upload identity document",
        lead: "Upload a valid document that includes these exact details:",
        label: "Identity document",
        uitleg: "A valid document with your photo on it, in your own name.",
        gegevens: [["Legal name", "Serdar Orman"], ["Date of birth", "21-06-2000"]],
        notitie: "Submit an original photograph of the ID. Do not submit scans or photocopies.",
        keuzes: [{ naam: "Driver’s license", kanten: TWEE }, { naam: "Dutch aliens document" },
                 { naam: "Identity card", kanten: TWEE }, { naam: "Passport" }, { naam: "Resident permit ID" }],
        bestand: FOTO,
        regel: "Must be clear, complete, in color, and uncropped.",
        regelLink: "See this page for guidance on submitting photo IDs."
      },
      statement: {
        titel: "Upload bank statement",
        lead: "Upload a recent statement that includes these exact details:",
        label: "Bank statement",
        uitleg: "A statement of the business account we pay out to, from the last three months.",
        /* De gegevens komen uit wat er is ingevuld, dus ze worden pas bij het
           openen van het venster opgehaald. */
        gegevens: function () {
          var houder = document.getElementById("bank-holder-shown");
          var adres = document.querySelector("[data-sum-address]");
          return [["Account holder", (houder && houder.textContent.trim()) || "Your business"],
                  ["Business address", (adres && adres.textContent.trim()) || ADRES]];
        },
        keuzes: [{ naam: "Bank statement" }, { naam: "Screenshot from online banking" }],
        bestand: MET_PDF,
        regel: SCHERP
      }
    };

    var doc = function (id) { return document.getElementById(id); };
    var docRij = null;
    var docSoort = null;

    function vakken() { return [].slice.call(doc("doc-drops").querySelectorAll(".docdrop")); }

    /* Done gaat aan als elk vak een bestand heeft. De eisen staan eronder
       zolang er nog iets ontbreekt; een gevuld vak zegt zelf hoe je opnieuw
       uploadt. */
    function zetDocKlaar() {
      var alle = vakken();
      var gekozen = !!doc("doc-type").value;
      var compleet = alle.length > 0 && alle.every(function (v) { return v.bestand; });
      doc("doc-done").disabled = !(gekozen && compleet);
      doc("doc-rule").hidden = !(gekozen && !compleet);
    }

    function docFout(tekst) {
      doc("doc-error-text").textContent = tekst || "";
      doc("doc-error").hidden = !tekst;
    }

    function toonBestand(vak, f) {
      vak.bestand = f;
      vak.querySelector(".drop__empty").hidden = !!f;
      vak.querySelector(".drop__file").hidden = !f;
      vak.querySelector(".drop__again").hidden = !f;
      vak.querySelector(".drop").classList.toggle("drop--filled", !!f);
      if (f) {
        /* Het soort bestand in hoofdletters, zoals op het bestand zelf. */
        var soort = (f.name.split(".").pop() || "").toUpperCase();
        vak.querySelector(".drop__kind").textContent = soort === "JPEG" ? "JPG" : soort;
        vak.querySelector(".drop__name").textContent = f.name;
      }
      /* Leeg, zodat hetzelfde bestand opnieuw kiezen ook weer iets doet. */
      vak.querySelector("input").value = "";
      zetDocKlaar();
    }

    /* Een bestand dat we niet kunnen lezen of dat te groot is, zeggen we
       meteen, niet pas na Done. */
    function neemBestand(vak, f) {
      if (!f) return;
      if (!docSoort.bestand.patroon.test(f.name)) { docFout(docSoort.bestand.fout); return; }
      if (f.size > 20 * 1048576) { docFout("This file is larger than 20 MB."); return; }
      docFout("");
      toonBestand(vak, f);
    }

    function maakVak(kant) {
      var vak = document.createElement("div");
      vak.className = "docdrop";
      vak.innerHTML =
        '<p class="docdrop__side"></p>' +
        '<div class="drop drop--doc">' +
          '<input type="file" hidden />' +
          '<div class="drop__empty"><button class="btn btn--ghost btn--sm" type="button" data-doc-add>Add files</button><p class="drop__hint"></p></div>' +
          '<div class="drop__file" hidden>' +
            '<svg class="icon" aria-hidden="true"><use href="#i-file"/></svg>' +
            '<span class="drop__kind"></span><span class="drop__name"></span>' +
          '</div>' +
        '</div>' +
        '<p class="drop__again" hidden>If the image is not clear, <button class="link link--btn" type="button" data-doc-add>upload the document again</button></p>';
      var zij = vak.querySelector(".docdrop__side");
      if (kant) zij.textContent = kant; else zij.remove();
      var kiezer = vak.querySelector("input");
      kiezer.accept = docSoort.bestand.accept;
      if (kant) kiezer.setAttribute("aria-label", kant + " of the document");
      vak.querySelector(".drop__hint").textContent = docSoort.bestand.tekst;
      vak.bestand = null;

      /* Slepen mag ook: het vak licht op zolang er een bestand boven hangt. */
      var zone = vak.querySelector(".drop");
      ["dragenter", "dragover"].forEach(function (t) {
        zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
      });
      ["dragleave", "drop"].forEach(function (t) {
        zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
      });
      zone.addEventListener("drop", function (e) { neemBestand(vak, e.dataTransfer.files[0]); });
      kiezer.addEventListener("change", function () { neemBestand(vak, this.files[0]); });
      return vak;
    }

    /* Toevoegen en opnieuw uploaden openen allebei de bestandskiezer van dat vak. */
    doc("doc-drops").addEventListener("click", function (e) {
      var vak = e.target.closest(".docdrop");
      if (vak && e.target.closest("[data-doc-add]")) vak.querySelector("input").click();
    });

    document.addEventListener("click", function (e) {
      var knop = e.target.closest("[data-doc-upload]");
      if (!knop) return;
      docRij = knop.closest("[data-doc]");
      docSoort = DOC_SOORTEN[docRij.dataset.doc];

      doc("doc-title").textContent = docSoort.titel;
      doc("doc-lead").textContent = docSoort.lead;
      doc("doc-label").textContent = docSoort.label;
      doc("doc-tip-title").textContent = docSoort.label;
      doc("doc-tip-text").textContent = docSoort.uitleg;

      var feiten = doc("doc-facts");
      feiten.textContent = "";
      /* Sommige stukken lezen hun gegevens uit de pagina, andere staan vast. */
      var feitenLijst = typeof docSoort.gegevens === "function"
        ? docSoort.gegevens() : docSoort.gegevens;
      feitenLijst.forEach(function (paar) {
        var blok = document.createElement("div");
        var dt = document.createElement("dt");
        var dd = document.createElement("dd");
        dt.textContent = paar[0];
        dd.textContent = paar[1];
        blok.append(dt, dd);
        feiten.appendChild(blok);
      });

      var keuze = doc("doc-type");
      keuze.length = 1;
      docSoort.keuzes.forEach(function (k) { keuze.add(new Option(k.naam, k.naam)); });

      doc("doc-note").hidden = !docSoort.notitie;
      doc("doc-note-text").textContent = docSoort.notitie || "";
      doc("doc-rule-text").textContent = docSoort.regel;
      doc("doc-rule-link").textContent = docSoort.regelLink || "";
      doc("doc-rule-link").hidden = !docSoort.regelLink;

      /* Eerst de vakken leegmaken, dan pas de keuze zetten. Andersom wiste dit
         meteen weg wat de change-afhandeling er net had neergezet, waardoor je
         opnieuw moest kiezen voordat de uploadvakken verschenen. En beginnen op
         Select, niet op een optie, zodat je eerste keuze ook echt iets doet. */
      doc("doc-drops").textContent = "";
      doc("doc-drops").hidden = true;
      keuze.value = "";
      keuze.dispatchEvent(new Event("change"));
      docFout("");
      zetDocKlaar();
      docVenster.hidden = false;
      keuze.focus();
    });

    /* De keuze bepaalt hoeveel vakken er komen: een, of twee voor voor- en
       achterkant. Een andere keuze begint met lege vakken. */
    doc("doc-type").addEventListener("change", function () {
      var waarde = this.value;
      var gekozen = docSoort.keuzes.filter(function (k) { return k.naam === waarde; })[0];
      var plek = doc("doc-drops");
      plek.textContent = "";
      docFout("");
      if (gekozen) (gekozen.kanten || [null]).forEach(function (kant) { plek.appendChild(maakVak(kant)); });
      plek.classList.toggle("docdrops--twee", !!(gekozen && gekozen.kanten));
      plek.hidden = !gekozen;
      zetDocKlaar();
    });

    /* Na Done staat onder de titel welk stuk het is, en rechts de bestandsnaam
       met een knop om het opnieuw te doen. Die knop opent hetzelfde venster. */
    doc("doc-done").addEventListener("click", function () {
      docRij.querySelector("[data-doc-file]").textContent = doc("doc-type").value;
      docRij.querySelector("[data-doc-file]").hidden = false;
      var naam = docRij.querySelector("[data-doc-name]");
      naam.textContent = vakken().map(function (v) { return v.bestand.name; }).join(", ");
      naam.title = naam.textContent;
      naam.hidden = false;
      var knop = docRij.querySelector("[data-doc-upload]");
      knop.className = "icon-btn";
      knop.setAttribute("aria-label", "Upload " + docSoort.label.toLowerCase() + " again");
      knop.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-refresh"/></svg>';
      docVenster.hidden = true;
      /* Elders hangt de tekenknop hiervan af. */
      document.dispatchEvent(new CustomEvent("upload-stand"));
      showToast("Document uploaded");
    });
  }

  /* ---- Adres opzoeken -----------------------------------------------------
     Een straat met huisnummer is genoeg: het postcoderegister kent de rest.
     Hier staat een handvol adressen in plaats van die koppeling, genoeg om te
     laten zien wat er hoort te gebeuren en wat er gebeurt als een adres niet
     gevonden wordt. */
  var ADRESSEN = {
    "lusthofstraat": { post: "3062 WB", plaats: "Rotterdam" },
    "tochtstraat": { post: "3036 SK", plaats: "Rotterdam" },
    "coolsingel": { post: "3011 AD", plaats: "Rotterdam" },
    "witte de withstraat": { post: "3012 BL", plaats: "Rotterdam" },
    "oude binnenweg": { post: "3012 CE", plaats: "Rotterdam" },
    "damrak": { post: "1012 LP", plaats: "Amsterdam" },
    "kalverstraat": { post: "1012 NX", plaats: "Amsterdam" },
    "prinsengracht": { post: "1015 DV", plaats: "Amsterdam" },
    "hoogstraat": { post: "2513 AR", plaats: "Den Haag" },
    "oudegracht": { post: "3511 AR", plaats: "Utrecht" }
  };

  /* "Lusthofstraat 27A" -> "lusthofstraat". Het huisnummer staat tegenwoordig
     in een eigen veld, maar wie het toch achter de straat typt krijgt
     hetzelfde resultaat. */
  function straatNaam(waarde) {
    return waarde.toLowerCase().replace(/\s*\d.*$/, "").trim();
  }

  document.addEventListener("input", function (e) {
    var veld = e.target.closest("[data-lookup]");
    if (!veld) return;

    var post = document.getElementById(veld.dataset.lookupZip);
    var plaats = document.getElementById(veld.dataset.lookupCity);
    var notitie = document.getElementById(veld.dataset.lookupNote);
    var naam = straatNaam(veld.value.trim());
    /* Bij twee letters valt er nog niets te zoeken; dan zwijgen we. */
    var af = naam.length > 2;
    var gevonden = af ? ADRESSEN[naam] : null;

    if (gevonden) {
      post.value = gevonden.post;
      plaats.value = gevonden.plaats;
    } else if (!naam) {
      post.value = "";
      plaats.value = "";
    }

    if (!notitie) return;
    if (gevonden) {
      notitie.textContent = "Postal code and city found.";
      notitie.hidden = false;
    } else if (af) {
      notitie.textContent = "We could not find this street. Fill in the postal code and city yourself.";
      notitie.hidden = false;
    } else {
      notitie.hidden = true;
    }
  });

  /* ---- Kleine vensters en losse bevestigingen -----------------------------
     Een knop met data-dialog opent het venster met dat id; alles met
     data-dialog-close erin doet het weer dicht. Het exportvenster regelt dat
     zelf, want dat zet de focus ook terug. */
  document.addEventListener("click", function (e) {
    var opener = e.target.closest("[data-dialog]");
    if (opener) {
      var venster = document.getElementById(opener.dataset.dialog);
      if (venster) venster.hidden = false;
      return;
    }
    var sluit = e.target.closest("[data-dialog-close]");
    if (sluit) {
      var open = sluit.closest(".dialog");
      if (open && open.id !== "export-dialog") open.hidden = true;
    }
  });

  /* Een knop met data-toast bevestigt zichzelf. Zo staat in de HTML wat er
     gebeurt, zonder voor elke knop een eigen regel JavaScript. */
  document.addEventListener("click", function (e) {
    var knop = e.target.closest("[data-toast]");
    if (knop) showToast(knop.dataset.toast);
  });

  /* ---- Domein verhuizen ---------------------------------------------------
     Eerst het venster met de vraag welk domein, dan de pagina met de stappen
     bij de huidige aanbieder. De prijs is een jaar verlenging tegen hetzelfde
     tarief als bij kopen. Continue gaat pas aan als het domein ontgrendeld is
     en de code erin staat. */
  var verhuisVenster = document.getElementById("transfer-dialog");

  if (verhuisVenster) {
    var verhuisVeld = document.getElementById("transfer-domain");
    var verhuisFout = document.getElementById("transfer-domain-error");
    var slot = document.getElementById("xfer-lock");
    var verhuisCode = document.getElementById("xfer-code");
    var verder = document.getElementById("xfer-go");
    var TARIEF = { nl: "9,00", com: "14,00", eu: "8,00" };

    function zetVerder() {
      verder.disabled = !(slot.dataset.open === "ja" && verhuisCode.value.trim());
    }

    /* Het venster begint elke keer leeg. */
    document.addEventListener("click", function (e) {
      if (!e.target.closest('[data-dialog="transfer-dialog"]')) return;
      verhuisVeld.value = "";
      verhuisFout.hidden = true;
      verhuisVeld.classList.remove("input--error");
      setTimeout(function () { verhuisVeld.focus(); }, 0);
    });

    document.getElementById("transfer-next").addEventListener("click", function () {
      /* Wie een adres plakt krijgt het domein eruit: geen https, geen www,
         geen pad erachter. */
      var naam = verhuisVeld.value.trim().toLowerCase()
        .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(naam)) {
        verhuisFout.hidden = false;
        verhuisVeld.classList.add("input--error");
        verhuisVeld.focus();
        return;
      }

      var tld = naam.split(".").pop();
      document.getElementById("xfer-name").textContent = naam;
      document.getElementById("xfer-price").textContent = "€ " + (TARIEF[tld] || "14,00") + " / year";

      /* Een nieuw domein begint weer vergrendeld en zonder code. */
      slot.dataset.open = "nee";
      slot.className = "badge badge--pending";
      slot.textContent = "Locked";
      verhuisCode.value = "";
      zetVerder();

      verhuisVenster.hidden = true;
      openSetSub("domain-transfer", "Transfer domain");
    });

    verhuisVeld.addEventListener("input", function () {
      verhuisFout.hidden = true;
      verhuisVeld.classList.remove("input--error");
    });
    verhuisVeld.addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("transfer-next").click();
    });

    /* Opnieuw kijken of het slot eraf is. Echt is dit een opzoeking bij het
       register; hier gaat het slot bij de eerste keer open, zodat je ziet wat
       er daarna gebeurt. */
    document.getElementById("xfer-recheck").addEventListener("click", function () {
      slot.dataset.open = "ja";
      slot.className = "badge badge--active";
      slot.textContent = "Unlocked";
      zetVerder();
    });

    verhuisCode.addEventListener("input", zetVerder);

    verder.addEventListener("click", function () {
      var domein = document.getElementById("xfer-name").textContent;
      backFromSub();
      showToast("Transfer of " + domein + " started");
    });
  }

  /* ---- Bestaand domein koppelen -------------------------------------------
     Venster met de vraag welk domein, dan de pagina met de DNS-records die je
     bij je huidige aanbieder omzet. Het domein staat meteen in de lijst onder
     het primaire domein, met Needs setup: toegevoegd, maar nog niet bereikbaar. */
  var koppelVenster = document.getElementById("connect-dialog");

  if (koppelVenster) {
    var koppelVeld = document.getElementById("connect-domain");
    var koppelFout = document.getElementById("connect-domain-error");
    var koppelLijst = document.querySelector(".table--domains tbody");
    var koppelRij = null;
    var MAANDEN = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"];

    function zetStap(id, stand) {
      document.getElementById(id).className = "dstep " + stand;
    }

    /* Het venster begint elke keer leeg. */
    document.addEventListener("click", function (e) {
      if (!e.target.closest('[data-dialog="connect-dialog"]')) return;
      koppelVeld.value = "";
      koppelFout.hidden = true;
      koppelVeld.classList.remove("input--error");
      setTimeout(function () { koppelVeld.focus(); }, 0);
    });

    document.getElementById("connect-next").addEventListener("click", function () {
      var naam = koppelVeld.value.trim().toLowerCase()
        .replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(naam)) {
        koppelFout.hidden = false;
        koppelVeld.classList.add("input--error");
        koppelVeld.focus();
        return;
      }

      document.querySelectorAll("[data-connect-name]").forEach(function (el) { el.textContent = naam; });
      document.getElementById("connect-view").href = "https://" + naam;

      /* Elke koppeling begint bij de eerste stap. */
      zetStap("dstep-dns", "is-open");
      zetStap("dstep-prop", "is-waiting");
      zetStap("dstep-tls", "is-waiting");
      document.querySelector("#dstep-prop .dstep__meta").hidden = true;

      /* In de lijst direct onder het primaire domein, want daar verwijst hij
         naartoe. Opnieuw koppelen vervangt de vorige regel. */
      if (koppelRij) koppelRij.remove();
      koppelRij = document.createElement("tr");
      koppelRij.className = "dom-child";
      koppelRij.setAttribute("data-domain", "");
      koppelRij.innerHTML =
        '<td><span class="dom dom--sub"><svg class="icon dom__icon" aria-hidden="true"><use href="#i-redirect"/></svg><span class="dom__name"></span></span></td>' +
        '<td><span class="badge badge--muted">Needs setup</span></td><td></td>';
      koppelRij.querySelector(".dom__name").textContent = naam;
      koppelLijst.insertBefore(koppelRij, koppelLijst.rows[1] || null);

      var nu = new Date();
      koppelVenster.hidden = true;
      openSetSub("domain-connect", naam, "Added on " + nu.getDate() + " " + MAANDEN[nu.getMonth()] + " " + nu.getFullYear());
    });

    koppelVeld.addEventListener("input", function () {
      koppelFout.hidden = true;
      koppelVeld.classList.remove("input--error");
    });
    koppelVeld.addEventListener("keydown", function (e) {
      if (e.key === "Enter") document.getElementById("connect-next").click();
    });

    /* Jouw deel is klaar; de rest volgt vanzelf. De eerste stap klapt dicht,
       de tweede gaat draaien. */
    document.getElementById("connect-updated").addEventListener("click", function () {
      zetStap("dstep-dns", "is-done");
      zetStap("dstep-prop", "is-busy");
      document.querySelector("#dstep-prop .dstep__meta").hidden = false;
      showToast("We are checking your DNS records");
    });

    /* Een domein dat nog niet werkt kan geen primair domein zijn: bezoekers
       zouden op een lege pagina uitkomen. */
    document.getElementById("connect-primary").addEventListener("click", function () {
      showToast("Finish the setup before making this your primary domain");
    });

    document.getElementById("connect-remove").addEventListener("click", function () {
      var naam = document.getElementById("set-title").textContent;
      if (koppelRij) { koppelRij.remove(); koppelRij = null; }
      backFromSub();
      showToast(naam + " removed");
    });
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
     8. PAGINERING — <table data-page="5">
     De rijen staan gewoon in de HTML; hier gaat alles buiten de huidige
     pagina uit. De voet hoort bij het paneel, niet bij de tabel, dus die
     wordt ernaast gezocht. Past alles op één pagina, dan blijft hij weg:
     bladeren zonder tweede pagina is alleen maar ruis.

     Het filter uit §2 markeert weggefilterde rijen met data-filtered; die
     tellen hier niet mee. Daarom hangt de hertekenfunctie aan de tabel, zodat
     §2 hem kan aanroepen zodra de selectie verandert.
     ======================================================================== */
  document.querySelectorAll("table[data-page]").forEach(function (table) {
    var size = parseInt(table.dataset.page, 10);
    var body = table.tBodies[0];
    if (!size || !body) return;

    var alle = Array.prototype.slice.call(body.rows);
    var panel = table.closest(".panel") || table.parentNode;
    var foot = panel.querySelector(".pager");
    if (!foot) return;

    var prev = foot.querySelectorAll(".pager__btn")[0];
    var next = foot.querySelectorAll(".pager__btn")[1];
    var count = foot.querySelector(".pager__count");
    var page = 0;

    function overgebleven() {
      return alle.filter(function (r) { return !r.dataset.filtered; });
    }
    function laatste() {
      return Math.max(0, Math.ceil(overgebleven().length / size) - 1);
    }

    function render() {
      var rows = overgebleven();
      var eind = laatste();
      /* Filteren kan de huidige pagina wegnemen; dan schuif je terug. */
      if (page > eind) page = eind;
      var from = page * size;
      var to = Math.min(from + size, rows.length);

      alle.forEach(function (row) { row.hidden = true; });
      rows.slice(from, to).forEach(function (row) { row.hidden = false; });

      foot.hidden = rows.length <= size;
      if (prev) prev.disabled = page === 0;
      if (next) next.disabled = page === eind;
      if (count) count.innerHTML = "<b>" + (from + 1) + "&ndash;" + to + "</b> of " + rows.length;
    }

    if (prev) prev.addEventListener("click", function () {
      if (page > 0) { page--; render(); }
    });
    if (next) next.addEventListener("click", function () {
      if (page < laatste()) { page++; render(); }
    });

    /* §2 roept dit aan na elke wijziging in het filter. */
    table.herpagineer = render;
    render();
  });


  /* ========================================================================
     9. TABSTREEP — laat zien dat er meer tabs zijn dan er passen
     De rij tabs is een scroller zonder systeem-scrollbalk (die verschijnt op
     iOS niet en is op desktop te grof). In plaats daarvan komt er een streepje
     onder de rij, met een duim die meebeweegt. Het vakje eromheen wordt hier
     gebouwd, zodat de HTML gewoon een <div class="tabs"> blijft.
     ======================================================================== */
  document.querySelectorAll(".tabs").forEach(function (tabs) {
    var vak = document.createElement("div");
    vak.className = "tabsbox";
    tabs.parentNode.insertBefore(vak, tabs);
    vak.appendChild(tabs);

    var baan = document.createElement("div");
    baan.className = "tabscroll";
    baan.setAttribute("aria-hidden", "true");
    var duim = document.createElement("span");
    duim.className = "tabscroll__thumb";
    baan.appendChild(duim);
    vak.appendChild(baan);

    function teken() {
      var zichtbaar = tabs.clientWidth;
      var totaal = tabs.scrollWidth;
      /* Past alles, dan valt er niets te wijzen. */
      baan.hidden = !zichtbaar || totaal <= zichtbaar + 1;
      if (baan.hidden) return;
      duim.style.width = (zichtbaar / totaal * 100) + "%";
      duim.style.transform = "translateX(" + (tabs.scrollLeft * zichtbaar / totaal) + "px)";
    }

    tabs.addEventListener("scroll", teken);
    /* Vangt ook het moment waarop de pagina zichtbaar wordt: dan pas heeft de
       rij een breedte. */
    if (window.ResizeObserver) new ResizeObserver(teken).observe(tabs);
    window.addEventListener("resize", teken);
    teken();
  });

  /* ========================================================================
     10. POSTCODEPOP — de volledige reeks achter de teller
     Een zone kan tientallen postcodes beslaan; in de rij staat er één met een
     teller. Klikken op die teller toont de rest in een zwevend vakje. Dat
     vakje hangt aan de body en niet in de cel, want het scrollvak van de
     tabel zou het afknippen.
     ======================================================================== */
  var pop = null;
  var popKnop = null;

  function sluitPop() {
    if (!pop) return;
    pop.remove();
    pop = null;
    if (popKnop) popKnop.setAttribute("aria-expanded", "false");
    popKnop = null;
  }

  function openPop(knop) {
    sluitPop();
    pop = document.createElement("div");
    pop.className = "codepop";
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-label", "Postal codes");
    knop.dataset.codes.split(",").forEach(function (code) {
      var chip = document.createElement("span");
      chip.textContent = code.trim();
      pop.appendChild(chip);
    });
    document.body.appendChild(pop);

    /* Onder de knop, en tegen de schermrand aan geschoven als het niet past. */
    var r = knop.getBoundingClientRect();
    var b = pop.getBoundingClientRect();
    var links = Math.min(Math.max(8, r.left), innerWidth - b.width - 8);
    var boven = r.bottom + 8;
    if (boven + b.height > innerHeight - 8) boven = Math.max(8, r.top - b.height - 8);
    pop.style.left = links + "px";
    pop.style.top = boven + "px";

    popKnop = knop;
    knop.setAttribute("aria-expanded", "true");
  }

  document.addEventListener("click", function (e) {
    var knop = e.target.closest("[data-codes]");
    if (knop) {
      if (knop === popKnop) { sluitPop(); return; }
      openPop(knop);
      return;
    }
    if (pop && !e.target.closest(".codepop")) sluitPop();
  });
  /* Meescrollen zou hem naast de knop laten zweven; dan liever weg. */
  window.addEventListener("resize", sluitPop);
  document.addEventListener("scroll", sluitPop, true);

  /* ========================================================================
     11. SYSTEEMKIEZER — op een telefoon kiest de telefoon
     Een eigen uitklapmenu is op een klein scherm slechter dan de kiezer die
     het toestel zelf toont: die is groter, schuift van onderen in en werkt
     zoals de gebruiker gewend is. Daarom ligt er een echt <select>
     onzichtbaar over de knop. De knop blijft eruitzien zoals hij hoort; de
     tik komt op het <select> terecht. Alleen onder 900px, zie styles.css.
     ======================================================================== */

  /* Statusfilter (orders, archief, klanten). De opties komen uit het menu dat
     er al staat, zodat er niets dubbel onderhouden hoeft te worden. */
  document.querySelectorAll(".sfilter").forEach(function (sf) {
    var items = sf.querySelectorAll(".sfilter__item");
    var knop = sf.querySelector(".sfilter__btn");
    if (!items.length || !knop) return;

    var sel = document.createElement("select");
    sel.className = "sfilter__native";
    sel.setAttribute("aria-label", knop.getAttribute("aria-label") || "Filter this list");
    items.forEach(function (item, i) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.textContent = item.textContent.trim();
      if (item.classList.contains("is-selected")) opt.selected = true;
      sel.appendChild(opt);
    });
    sf.appendChild(sel);

    /* De keuze loopt via het bestaande menu-item, zodat label, vinkje en de
       zoekstand precies hetzelfde bijwerken als op desktop. */
    sel.addEventListener("change", function () { items[Number(sel.value)].click(); });
    sf.addEventListener("click", function (e) {
      var item = e.target.closest(".sfilter__item");
      if (item) sel.value = String([].indexOf.call(items, item));
    });
  });

  /* Postcodes achter de teller: dezelfde kiezer, maar er valt niets te
     kiezen. De lijst springt terug naar de kop zodra je iets aantikt. */
  document.querySelectorAll("[data-codes]").forEach(function (knop) {
    var codes = knop.dataset.codes.split(",").map(function (c) { return c.trim(); });

    var vak = document.createElement("span");
    vak.className = "codes__wrap";
    knop.parentNode.insertBefore(vak, knop);
    vak.appendChild(knop);

    var sel = document.createElement("select");
    sel.className = "codes__native";
    sel.setAttribute("aria-label", knop.getAttribute("aria-label") || "Postal codes");
    var kop = document.createElement("option");
    kop.textContent = codes.length + " postal codes";
    sel.appendChild(kop);
    codes.forEach(function (code) {
      var opt = document.createElement("option");
      opt.textContent = code;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () { sel.selectedIndex = 0; });
    vak.appendChild(sel);
  });

  /* ========================================================================
     12. TOETSENBORD
     ======================================================================== */
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      /* Bovenste laag eerst: het zoekpaneel ligt over alles, en de drawer
         kan over de settings-overlay heen liggen. */
      if (pop) { sluitPop(); return; }
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

  /* ---- Demostand via de adresbalk ----------------------------------------
     De verificatie komt in het echt van Pay.nl, dus er is geen knop om hem te
     laten mislukken. Voor het tonen van een scherm kan het wel met ?demo= in
     de link: failed (afgewezen, uitbetalingen gepauzeerd), pending (in
     behandeling), setup (account wordt aangemaakt) of off (nog niets
     ingesteld). De link opent meteen de betaalpagina. */
  var demoStand = new URLSearchParams(location.search).get("demo") ||
                  new URLSearchParams(location.hash.slice(1)).get("demo");
  if (demoStand) {
    btnSettings.click();
    var demoItem = setNav.querySelector('.nav__item[data-set="payments"]');
    if (demoItem) demoItem.click();
    clearTimeout(verificatieTimer);
    if (demoStand === "off") {
      zetBetaalStand("off");
    } else {
      zetBetaalStand("on");
      zetVerificatie(demoStand === "setup" || demoStand === "pending" ? demoStand : "failed");
    }
  }

  /* ---- Betaalmethodes aan- en uitzetten -----------------------------------
     Uitzetten gaat via een vraag, want vanaf dat moment kan een klant er niet
     meer mee afrekenen. Aanzetten mag meteen: dat kan niets kapotmaken. De
     rij blijft staan, maar het logo verliest zijn kleur en er komt Disabled
     bij te staan. */
  var methodeVenster = document.getElementById("method-dialog");

  if (methodeVenster) {
    var methodeRij = null;

    function zetMethode(rij, uit) {
      rij.classList.toggle("is-off", uit);
      rij.querySelector(".mrow__badge").hidden = !uit;
      rij.querySelector("[data-method-toggle]").textContent = uit ? "Enable" : "Disable";
      showToast(rij.querySelector(".mrow__name").textContent + (uit ? " disabled" : " enabled"));
    }

    document.addEventListener("click", function (e) {
      var item = e.target.closest("[data-method-toggle]");
      if (!item) return;
      var rij = item.closest(".mrow");
      if (rij.classList.contains("is-off")) { zetMethode(rij, false); return; }

      var naam = rij.querySelector(".mrow__name").textContent;
      methodeRij = rij;
      document.getElementById("method-dialog-title").textContent = "Disable " + naam;
      document.getElementById("method-dialog-text").textContent =
        "Your customers will not be able to pay directly with " + naam + ". There are no " +
        "extra fees for using " + naam + " and removing it may reduce your conversion.";
      document.getElementById("method-confirm").textContent = "Disable " + naam;
      methodeVenster.hidden = false;
    });

    document.getElementById("method-confirm").addEventListener("click", function () {
      if (methodeRij) zetMethode(methodeRij, true);
      methodeVenster.hidden = true;
    });
  }

  /* ---- Beleidsteksten schrijven -------------------------------------------
     Twee teksten: privacy en voorwaarden. Het venster schrijft in een
     contenteditable met execCommand. Dat is oude techniek, maar het werkt in
     elke browser en er hoeft geen bibliotheek voor mee. Wie dit echt bouwt
     vervangt het door de editor die de rest van het product gebruikt. */
  var beleidVenster = document.getElementById("policy-dialog");

  if (beleidVenster) {
    var BELEID = {
      privacy: {
        titel: "Privacy policy",
        sjabloon:
          "<h2>Privacy policy</h2>" +
          "<p>This policy explains which personal data we collect when you order with us, why we need it and how long we keep it.</p>" +
          "<h3>What we collect</h3>" +
          "<ul><li>Your name, address, phone number and email address</li>" +
          "<li>What you ordered and what you paid</li>" +
          "<li>Notes you add to an order, such as an allergy</li></ul>" +
          "<h3>Why we need it</h3>" +
          "<p>We use your details to prepare and deliver your order, to handle payment and to answer questions about it. We do not sell your details to anyone.</p>" +
          "<h3>How long we keep it</h3>" +
          "<p>We keep order details as long as the tax rules require. You can ask us to remove everything else at any time.</p>" +
          "<h3>Your rights</h3>" +
          "<p>You can ask to see, correct or remove your data. Send us an email and we will answer within one month.</p>"
      },
      terms: {
        titel: "Terms and conditions",
        sjabloon:
          "<h2>Terms and conditions</h2>" +
          "<p>These terms apply to every order you place with us.</p>" +
          "<h3>Orders</h3>" +
          "<p>An order is final once you have paid. Check your address and phone number before you confirm, because we use them to reach you.</p>" +
          "<h3>Prices</h3>" +
          "<p>All prices include VAT. Delivery costs are shown before you pay.</p>" +
          "<h3>Delivery and collection</h3>" +
          "<p>The time we show is an estimate. If your order is going to be late we let you know.</p>" +
          "<h3>Cancelling</h3>" +
          "<p>Because we prepare food to order, an order cannot be cancelled once the kitchen has started. Call us and we will see what is possible.</p>" +
          "<h3>Something wrong</h3>" +
          "<p>Let us know the same day and we will put it right.</p>"
      }
    };

    var beleidRij = null;
    var beleidVak = document.getElementById("policy-body");
    var beleidOpslaan = document.getElementById("policy-save");

    /* Save hoort niets te doen zolang er niets staat, en ook niet als je de
       tekst weer precies zo achterlaat als je hem vond. */
    var beleidStart = "";
    function zetBeleidKlaar() {
      var nu = beleidVak.innerHTML.trim();
      beleidOpslaan.disabled = !beleidVak.textContent.trim() || nu === beleidStart;
    }

    document.addEventListener("click", function (e) {
      var rij = e.target.closest("[data-policy]");
      if (!rij) return;
      beleidRij = rij;
      var soort = BELEID[rij.dataset.policy];
      document.getElementById("policy-dialog-title").textContent = soort.titel;
      beleidVak.innerHTML = rij.dataset.policyText || "";
      beleidStart = beleidVak.innerHTML.trim();
      document.getElementById("policy-block").value = "p";
      document.getElementById("policy-note").hidden = true;
      document.getElementById("policy-disclaimer").setAttribute("aria-expanded", "false");
      zetBeleidKlaar();
      beleidVenster.hidden = false;
      beleidVak.focus();
    });

    document.getElementById("policy-disclaimer").addEventListener("click", function () {
      var notitie = document.getElementById("policy-note");
      notitie.hidden = !notitie.hidden;
      this.setAttribute("aria-expanded", String(!notitie.hidden));
    });

    document.getElementById("policy-template").addEventListener("click", function () {
      beleidVak.innerHTML = BELEID[beleidRij.dataset.policy].sjabloon;
      beleidVak.focus();
      zetBeleidKlaar();
    });

    /* De knoppen werken op wat je hebt geselecteerd, dus de selectie mag niet
       verdwijnen als je de knop aanraakt. */
    document.querySelector(".editor__bar").addEventListener("pointerdown", function (e) {
      if (e.target.closest(".editor__btn")) e.preventDefault();
    });

    document.querySelector(".editor__bar").addEventListener("click", function (e) {
      var knop = e.target.closest(".editor__btn");
      if (!knop) return;
      var cmd = knop.dataset.cmd;
      if (cmd === "createLink") {
        var adres = window.prompt("Link to which address?", "https://");
        if (!adres) return;
        document.execCommand("createLink", false, adres);
      } else {
        document.execCommand(cmd, false, null);
      }
      beleidVak.focus();
      zetBeleidKlaar();
    });

    document.getElementById("policy-block").addEventListener("change", function () {
      document.execCommand("formatBlock", false, this.value);
      beleidVak.focus();
      zetBeleidKlaar();
    });

    beleidVak.addEventListener("input", zetBeleidKlaar);

    /* Opgeslagen: de rij onthoudt de tekst en zegt voortaan dat er iets staat. */
    document.getElementById("policy-save").addEventListener("click", function () {
      beleidRij.dataset.policyText = beleidVak.innerHTML;
      var stand = beleidRij.querySelector("[data-policy-badge]");
      stand.textContent = "Published";
      stand.className = "badge badge--active";
      beleidVenster.hidden = true;
      showToast(BELEID[beleidRij.dataset.policy].titel + " saved");
    });
  }
  /* ---- Rekening: betaalmethodes -------------------------------------------
     De methodes voor de rekening van Opining zelf staan in hetzelfde vak als
     de knop eronder. De keuze bovenin het venster bepaalt de velden, de titel
     en de knop: een kaart of een incasso. Van een kaart houden we alleen de
     laatste vier cijfers vast; de rest is in het echt iets voor de
     betaaldienst, niet voor ons. */
  var pmVenster = document.getElementById("paymethod-dialog");

  if (pmVenster) {
    var pmVak = document.getElementById("bill-methods");
    var pmHoofd = document.getElementById("bill-primary");
    var pmKnop = document.getElementById("pm-add");
    var pmTitel = document.getElementById("paymethod-dialog-title");
    var pmSoortVeld = document.getElementById("pm-kind");
    var pmPrimair = document.getElementById("pm-primary");
    var pmNummer = document.getElementById("pm-number");
    var pmVervalt = document.getElementById("pm-exp");
    var pmCode = document.getElementById("pm-cvc");
    var pmNaam = document.getElementById("pm-name");
    var pmVoor = document.getElementById("pm-first");
    var pmAchter = document.getElementById("pm-last");
    var pmMail = document.getElementById("pm-mail");
    var pmIban = document.getElementById("pm-iban");
    var pmVelden = [pmNummer, pmVervalt, pmCode, pmNaam, pmVoor, pmAchter, pmMail, pmIban];

    /* Het merk volgt uit het eerste cijfer, zoals elke kassa het doet. */
    function pmMerk(nummer) {
      var eerste = nummer.charAt(0);
      if (eerste === "4") return { naam: "Visa", logo: "img/pay/visa.svg" };
      if (eerste === "5") return { naam: "Mastercard", logo: "img/pay/mastercard.svg" };
      if (eerste === "6") return { naam: "Maestro", logo: "img/pay/maestro.svg" };
      return { naam: "Card", logo: "" };
    }

    function pmCijfers(veld) { return veld.value.replace(/\D/g, ""); }
    function pmIbanSchoon() { return pmIban.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }
    function pmSepa() { return pmSoortVeld.value === "sepa"; }

    /* De knop gaat pas aan als de velden samen een kaart of een rekening
       kunnen zijn. We rekenen niets na: dat doet de betaaldienst. */
    function zetPmKlaar() {
      if (pmSepa()) {
        pmKnop.disabled = !(/^[A-Z]{2}\d{2}[A-Z0-9]{10,26}$/.test(pmIbanSchoon()) &&
          pmVoor.value.trim() && pmAchter.value.trim() &&
          /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pmMail.value.trim()));
        return;
      }
      pmKnop.disabled = !(pmCijfers(pmNummer).length >= 12 &&
        pmCijfers(pmVervalt).length === 4 &&
        pmCijfers(pmCode).length >= 3 &&
        pmNaam.value.trim().length > 1);
    }

    pmVelden.forEach(function (v) { v.addEventListener("input", zetPmKlaar); });

    /* De keuze bepaalt welke velden erbij horen, en hoe het venster heet. */
    pmSoortVeld.addEventListener("change", function () {
      pmVenster.querySelectorAll("[data-pm-fields]").forEach(function (blok) {
        blok.hidden = blok.dataset.pmFields !== pmSoortVeld.value;
      });
      pmTitel.textContent = pmSepa() ? "Add SEPA direct debit" : "Add credit card";
      pmKnop.textContent = pmSepa() ? "Add SEPA Direct Debit" : "Save card";
      zetPmKlaar();
    });

    /* Nummer in blokjes van vier en de datum met een schuine streep: zo staat
       het op de kaart, en zo zie je meteen of je je vertikt hebt. */
    pmNummer.addEventListener("input", function () {
      this.value = pmCijfers(this).slice(0, 19).replace(/(.{4})(?=.)/g, "$1 ");
    });
    pmVervalt.addEventListener("input", function () {
      var c = pmCijfers(this).slice(0, 4);
      this.value = c.length > 2 ? c.slice(0, 2) + " / " + c.slice(2) : c;
    });
    pmCode.addEventListener("input", function () {
      this.value = pmCijfers(this).slice(0, 4);
    });
    /* Een IBAN lees je in blokjes van vier, net als op een bankafschrift. */
    pmIban.addEventListener("input", function () {
      this.value = pmIbanSchoon().slice(0, 34).replace(/(.{4})(?=.)/g, "$1 ");
    });

    /* De bovenste is de primaire; de rest is reserve, voor als die wordt
       geweigerd. */
    function pmStanden() {
      [].slice.call(pmVak.querySelectorAll(".payrow")).forEach(function (rij, i) {
        var stand = rij.querySelector(".badge");
        stand.textContent = i === 0 ? "Primary" : "Backup";
        stand.className = i === 0 ? "badge badge--draft" : "badge badge--muted";
        rij.querySelector("[data-pm-primary]").hidden = i === 0;
      });
      pmSpiegel();
    }

    /* Op de rekeningpagina zelf staat alleen waar we van afschrijven. Beheren
       gebeurt in het profiel, dus die regel krijgt een potlood in plaats van
       een menu. Zolang er niets is, staat er de knop die het profiel opent. */
    function pmSpiegel() {
      if (!pmHoofd) return;
      var eerste = pmVak.querySelector(".payrow");
      var oud = pmHoofd.querySelector(".payrow");
      if (oud) oud.remove();
      pmHoofd.querySelector(".addrow").hidden = !!eerste;
      if (!eerste) return;

      var kopie = eerste.cloneNode(true);
      kopie.querySelector(".payrow__menu").remove();
      kopie.querySelector(".badge").remove();
      var pen = document.createElement("button");
      pen.className = "icon-btn payrow__menu";
      pen.type = "button";
      pen.setAttribute("aria-label", "Manage payment methods");
      pen.dataset.sub = "billing-profile";
      pen.dataset.subTitle = "Billing profile";
      pen.dataset.subLead = "Your payment methods, tax ID and billing address.";
      pen.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg>';
      kopie.appendChild(pen);
      pmHoofd.insertBefore(kopie, pmHoofd.querySelector(".addrow"));
    }

    /* Het venster begint elke keer leeg, op een kaart. */
    document.addEventListener("click", function (e) {
      if (!e.target.closest('[data-dialog="paymethod-dialog"]')) return;
      pmVelden.forEach(function (v) { v.value = ""; });
      pmSoortVeld.value = "card";
      pmPrimair.checked = !pmVak.querySelector(".payrow");
      pmSoortVeld.dispatchEvent(new Event("change"));
    });

    pmKnop.addEventListener("click", function () {
      var sepa = pmSepa();
      var merk = sepa ? { naam: "SEPA Direct Debit", logo: "img/pay/sepa.svg" }
                      : pmMerk(pmCijfers(pmNummer));
      var laatste = sepa ? pmIbanSchoon().slice(-4) : pmCijfers(pmNummer).slice(-4);
      var naam = sepa ? merk.naam + " ending in " + laatste
                      : merk.naam + " •••• " + laatste;

      var rij = document.createElement("div");
      rij.className = "payrow";
      rij.innerHTML =
        '<span class="pm__mark" aria-hidden="true"></span>' +
        '<span class="payrow__name"></span>' +
        '<span class="badge badge--draft">Primary</span>' +
        '<span class="sort payrow__menu">' +
          '<button class="icon-btn sort__btn" type="button" aria-haspopup="true" aria-expanded="false">' +
            '<svg class="icon" aria-hidden="true"><use href="#i-dots"/></svg></button>' +
          '<div class="sort__menu sort__menu--kort" role="menu" hidden>' +
            '<button class="sort__item" type="button" role="menuitem" data-pm-primary>Make primary</button>' +
            '<button class="sort__item" type="button" role="menuitem" data-pm-remove>Remove</button>' +
          '</div>' +
        '</span>';
      var vakje = rij.querySelector(".pm__mark");
      if (merk.logo) vakje.innerHTML = '<img src="' + merk.logo + '" alt="" />';
      else vakje.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-card"/></svg>';
      rij.querySelector(".payrow__name").textContent = naam;
      rij.querySelector(".sort__btn").setAttribute("aria-label", "Actions for " + naam);

      /* Aangevinkt: bovenaan, en dus primair. Anders onderaan als reserve. */
      if (pmPrimair.checked) pmVak.insertBefore(rij, pmVak.firstElementChild);
      else pmVak.insertBefore(rij, pmVak.querySelector(".addrow"));
      pmStanden();
      pmVenster.hidden = true;
      showToast("Payment method added");
    });

    /* De twee voorbeeldregels staan in de HTML; hiermee krijgen ze meteen de
       juiste stand en staat de primaire ook op de rekeningpagina. */
    pmStanden();

    pmVak.addEventListener("click", function (e) {
      var rij = e.target.closest(".payrow");
      if (!rij) return;
      if (e.target.closest("[data-pm-primary]")) {
        pmVak.insertBefore(rij, pmVak.firstElementChild);
        pmStanden();
        showToast("Primary payment method changed");
      } else if (e.target.closest("[data-pm-remove]")) {
        rij.remove();
        pmStanden();
        showToast("Payment method removed");
      }
    });
  }

  /* Het btw-nummer: één nummer, dus geen lijst maar een regel die je beheert.
     Na het opslaan gaat het naar VIES; zolang dat loopt staat er Checking. */
  var vatVenster = document.getElementById("vat-dialog");

  if (vatVenster) {
    var vatVeld = document.getElementById("vat-number");
    var vatFout = document.getElementById("vat-error");
    var vatKnop = document.getElementById("vat-add");
    var vatWaarde = document.getElementById("bill-vat-value");
    var vatStand = document.getElementById("bill-vat-badge");
    var vatNotitie = document.getElementById("bill-vat-note");
    var vatTimer = null;
    /* Negen cijfers, een B en twee cijfers, met NL ervoor of niet. Genoeg om
       een typfout te zien; de echte controle doet VIES. */
    var VAT_VORM = /^(NL)?\d{9}B\d{2}$/;

    function vatSchoon() { return vatVeld.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); }

    /* Dezelfde vorm als bij opslaan: de knop gaat pas aan als het nummer klopt. */
    function zetVatKlaar() { vatKnop.disabled = !VAT_VORM.test(vatSchoon()); }

    vatVeld.addEventListener("input", function () {
      vatFout.hidden = true;
      vatVeld.classList.remove("input--error");
      zetVatKlaar();
    });

    /* Het venster opent leeg als er nog niets staat, en anders met wat er al
       ingevuld was; de knop zegt dan ook iets anders. */
    document.addEventListener("click", function (e) {
      if (!e.target.closest('[data-dialog="vat-dialog"]')) return;
      var gezet = vatVaststaat();
      vatVeld.value = gezet || "";
      vatFout.hidden = true;
      document.getElementById("vat-dialog-title").textContent = gezet ? "Change VAT number" : "Add tax info";
      vatKnop.textContent = gezet ? "Save" : "Add VAT number";
      zetVatKlaar();
      setTimeout(function () { vatVeld.focus(); }, 0);
    });

    function vatVaststaat() {
      var nu = vatWaarde.textContent.trim();
      return nu === "Not set" ? "" : nu;
    }

    vatKnop.addEventListener("click", function () {
      var nummer = vatSchoon();
      if (!VAT_VORM.test(nummer)) {
        vatFout.hidden = false;
        vatVeld.classList.add("input--error");
        vatVeld.focus();
        return;
      }
      vatWaarde.textContent = nummer;
      vatStand.textContent = "Being verified";
      vatStand.className = "badge badge--pending";
      vatStand.hidden = false;
      vatNotitie.hidden = false;
      vatVenster.hidden = true;
      showToast("VAT number saved");
      clearTimeout(vatTimer);
      vatTimer = setTimeout(function () {
        vatStand.textContent = "Verified";
        vatStand.className = "badge badge--active";
        vatNotitie.hidden = true;
      }, 2500);
    });
  }

  /* Het factuuradres. Save gaat pas aan als er iets veranderd is, anders is
     het een knop die niets doet. Het land ligt vast en telt dus niet mee. */
  var adresVenster = document.getElementById("address-dialog");

  if (adresVenster) {
    var adresVelden = ["bill-addr-company", "bill-addr-street", "bill-addr-extra", "bill-addr-zip", "bill-addr-city"]
      .map(function (id) { return document.getElementById(id); });
    var adresKnop = document.getElementById("bill-addr-save");

    function adresStand() {
      return adresVelden.map(function (v) { return v.value.trim(); }).join("|");
    }

    var adresBewaard = adresStand();

    adresVelden.forEach(function (v) {
      v.addEventListener("input", function () {
        adresKnop.disabled = adresStand() === adresBewaard ||
          !adresVelden[1].value.trim() || !adresVelden[4].value.trim();
      });
    });

    adresKnop.addEventListener("click", function () {
      var extra = adresVelden[2].value.trim();
      var post = adresVelden[3].value.trim().toUpperCase();
      document.getElementById("bill-address").textContent =
        [adresVelden[1].value.trim(), extra, post + " " + adresVelden[4].value.trim(),
         document.getElementById("bill-addr-country").value]
          .filter(Boolean).join(", ");
      adresBewaard = adresStand();
      adresKnop.disabled = true;
      adresVenster.hidden = true;
      showToast("Billing address saved");
    });
  }

  /* ---- Domeintype wijzigen -------------------------------------------------
     Eén domein is het adres in de balk; de andere wijzen ernaartoe of tonen
     dezelfde pagina onder een tweede naam. Het venster laat zien wat het nu is
     en wat het kan worden; kiezen wat er al staat verandert niets, dus dan
     blijft de knop uit. */
  var domVenster = document.getElementById("domtype-dialog");

  if (domVenster) {
    var domRij = null;
    var domLijst = document.querySelector(".table--domains tbody");
    var domKnop = document.getElementById("domtype-go");

    function domNaam(rij) { return rij.querySelector(".dom__name").textContent.trim(); }
    function domIsPrimair(rij) { return !!rij.querySelector(".pill"); }
    function domKeuze() {
      var g = domVenster.querySelector('[name="domtype"]:checked');
      return g ? g.value : "";
    }

    document.addEventListener("click", function (e) {
      var knop = e.target.closest("[data-domain-type]");
      if (!knop) return;
      domRij = knop.closest("tr");
      var nu = domIsPrimair(domRij) ? "primary" : "redirect";

      document.getElementById("domtype-title").textContent =
        "Change domain type for " + domNaam(domRij);
      domVenster.querySelectorAll(".opt").forEach(function (opt) {
        var veld = opt.querySelector("input");
        veld.checked = veld.value === nu;
        opt.classList.toggle("opt--now", veld.value === nu);
      });
      domKnop.disabled = true;
      domVenster.hidden = false;
    });

    domVenster.addEventListener("change", function (e) {
      if (e.target.name !== "domtype") return;
      var nu = domIsPrimair(domRij) ? "primary" : "redirect";
      domKnop.disabled = domKeuze() === nu;
    });

    /* Een nieuw primair domein gaat naar boven en krijgt het label; het oude
       zakt eronder en wijst er voortaan naartoe. */
    domKnop.addEventListener("click", function () {
      var keuze = domKeuze();
      var naam = domNaam(domRij);
      domVenster.hidden = true;

      if (keuze !== "primary") {
        showToast(naam + (keuze === "alias" ? " shows the same page under its own name"
                                            : " now redirects to your primary domain"));
        return;
      }

      var oud = [].slice.call(domLijst.querySelectorAll("tr[data-domain]"))
        .filter(function (r) { return domIsPrimair(r); })[0];
      if (oud && oud !== domRij) {
        /* Het label verhuist mee, en het icoon zegt waar de rij voor staat:
           een wereldbol voor het adres zelf, een verwijzing voor de rest. */
        var label = oud.querySelector(".pill");
        oud.classList.add("dom-child");
        oud.querySelector(".dom").classList.add("dom--sub");
        oud.querySelector(".dom__icon use").setAttribute("href", "#i-redirect");
        domRij.classList.remove("dom-child");
        domRij.querySelector(".dom").classList.remove("dom--sub");
        domRij.querySelector(".dom__icon use").setAttribute("href", "#i-globe");
        domRij.querySelector(".dom").appendChild(label);
        domLijst.insertBefore(domRij, oud);
      }
      showToast(naam + " is now your primary domain");
    });

    /* Een rij die app.js zelf toevoegt (gekocht of gekoppeld domein) heeft nog
       een lege actiecel; die vullen we met dezelfde drie knoppen. */
    var DOM_ACTIES = [
      { titel: "Preview domain", icoon: "#i-eye", attr: "data-domain-view" },
      { titel: "Edit DNS settings", icoon: "#i-edit", attr: "data-domain-dns" },
      { titel: "Change domain type", icoon: "#i-globe", attr: "data-domain-type" }
    ];

    function maakDomeinActies(rij) {
      if (rij.querySelector(".domacts")) return;
      var cel = rij.cells[rij.cells.length - 1];
      if (!cel) return;
      var naam = domNaam(rij);
      var vak = document.createElement("span");
      vak.className = "domacts";
      DOM_ACTIES.forEach(function (a) {
        var knop = document.createElement("button");
        knop.className = "icon-btn domact";
        knop.type = "button";
        knop.title = a.titel;
        knop.setAttribute("aria-label", a.titel + " for " + naam);
        knop.setAttribute(a.attr, "");
        knop.innerHTML = '<svg class="icon" aria-hidden="true"><use href="' + a.icoon + '"/></svg>';
        vak.appendChild(knop);
      });
      cel.appendChild(vak);
    }


    /* Op een smal scherm passen drie losse knoppen niet naast de naam, en
       zweven bestaat er niet. Daar wordt het een knop Actions met een menu.
       We bouwen dat menu uit de knoppen die er al staan, zodat er maar een
       plek is waar de acties beschreven worden. */
    function maakDomeinMenu(rij) {
      maakDomeinActies(rij);
      var acts = rij.querySelector(".domacts");
      if (!acts || rij.querySelector(".domenu")) return;

      var items = [].map.call(acts.querySelectorAll(".domact"), function (knop) {
        var item = document.createElement("button");
        item.className = "sort__item";
        item.type = "button";
        item.setAttribute("role", "menuitem");
        ["data-domain-view", "data-domain-dns", "data-domain-type"].forEach(function (naam) {
          if (knop.hasAttribute(naam)) item.setAttribute(naam, "");
        });
        item.innerHTML = '<svg class="icon" aria-hidden="true"><use href="' +
          knop.querySelector("use").getAttribute("href") + '"/></svg>';
        item.appendChild(document.createTextNode(knop.title));
        return item;
      });

      var vak = document.createElement("span");
      vak.className = "sort domenu";
      var knop = document.createElement("button");
      knop.className = "btn btn--ghost sort__btn domenu__btn";
      knop.type = "button";
      knop.setAttribute("aria-haspopup", "true");
      knop.setAttribute("aria-expanded", "false");
      knop.textContent = "Actions";
      var menu = document.createElement("div");
      menu.className = "sort__menu domenu__menu";
      menu.setAttribute("role", "menu");
      menu.hidden = true;
      items.forEach(function (i) { menu.appendChild(i); });
      vak.append(knop, menu);
      acts.parentNode.appendChild(vak);
    }

    domLijst.querySelectorAll("tr[data-domain]").forEach(maakDomeinMenu);
    /* Een rij die er later bij komt (gekocht of gekoppeld domein) krijgt het
       menu zodra hij in de lijst staat. */
    new MutationObserver(function (lijsten) {
      lijsten.forEach(function (l) {
        [].forEach.call(l.addedNodes, function (n) {
          if (n.nodeType === 1 && n.matches("tr")) maakDomeinMenu(n);
        });
      });
    }).observe(domLijst, { childList: true });
    /* De twee andere knoppen in de rij: kijken hoe het domein eruitziet, en
       de DNS-records. Die records staan bij de aanbieder waar het domein
       vandaan komt, behalve bij een domein dat je bij ons kocht. */
    document.addEventListener("click", function (e) {
      var kijk = e.target.closest("[data-domain-view]");
      if (kijk) {
        window.open("https://" + domNaam(kijk.closest("tr")), "_blank", "noopener");
        return;
      }
      var dns = e.target.closest("[data-domain-dns]");
      if (dns) showToast("DNS records for " + domNaam(dns.closest("tr")) + " are managed at your provider");
    });


  }
  /* ---- Betrokkenen in de onboarding ---------------------------------------
     Een eenmanszaak heeft een eigenaar; bij een BV of vennootschap moeten alle
     UBO's en tekenbevoegden erbij. De rechtsvorm uit stap 1 bepaalt welke van
     de twee kaarten je in stap 3 ziet. Toevoegen en wijzigen gebeurt in een vak
     dat in diezelfde kaart openklapt: zo blijft de lijst in beeld en verlaat je
     de stap niet. */
  var persoonVak = document.getElementById("person-form");

  if (persoonVak) {
    var rechtsvorm = document.getElementById("biz-legal");
    var lijst = document.getElementById("people-list");
    var persoonRij = null;   /* de regel die je nu bewerkt, of null bij nieuw */

    /* Alleen een eenmanszaak heeft één betrokkene. */
    function alleenEigenaar() {
      return /sole proprietorship/i.test(rechtsvorm.value);
    }

    function zetBetrokkenen() {
      var enkel = alleenEigenaar();
      document.querySelectorAll('[data-people="single"]').forEach(function (kaart) {
        kaart.dataset.off = enkel ? "" : "ja";
      });
      document.querySelectorAll('[data-people="multi"]').forEach(function (kaart) {
        kaart.dataset.off = enkel ? "ja" : "";
      });
      /* Het UBO-register bestaat alleen voor een rechtspersoon; een
         eenmanszaak hoeft dat uittreksel dus niet aan te leveren. */
      document.querySelectorAll("[data-ubo-doc]").forEach(function (rij) {
        rij.hidden = enkel;
      });
    }

    rechtsvorm.addEventListener("change", function () {
      zetBetrokkenen();
      /* De stap opnieuw tekenen, zodat de juiste kaart meteen in beeld komt. */
      if (resetWiz) resetWiz(3);
    });
    zetBetrokkenen();

    /* Het percentage hoort bij een financieel belang; bij de andere twee
       standen zegt het niets, dus dan staat het er ook niet. */
    var uboKeuze = document.getElementById("person-ubo");
    function zetUboVelden() {
      var soort = uboKeuze.value;
      document.getElementById("person-pct-field").hidden = soort !== "Financial interest";
      document.getElementById("person-kind-field").hidden = soort === "No UBO";
    }
    uboKeuze.addEventListener("change", zetUboVelden);

    var velden = ["first", "last", "lang", "street", "nr", "zip", "city", "country",
                  "dob", "nat", "pep", "sign", "ubo", "pct"];

    function veld(naam) { return document.getElementById("person-" + naam); }

    /* Waar het veldenvak hoort zolang niemand bewerkt wordt; van daaruit
       verhuist het heen en weer. */
    var persoonThuis = persoonVak.parentNode;
    var persoonAnker = persoonVak.nextSibling;
    var persoonKnop = document.querySelector("[data-person-add]");
    /* De lijst staat er pas als er iemand in staat. */
    function heeftBetrokkenen() {
      return !!lijst.querySelector("[data-person]:not([data-person-new])");
    }

    function zelfVak() { return lijst.querySelector("[data-person-self]"); }

    function zetLijstStand() {
      lijst.hidden = !heeftBetrokkenen();
      persoonKnop.hidden = !!persoonRij;
      /* Dezelfde knop onderaan de samenvatting hoort ook weg zolang de velden
         openstaan; die wordt in zetOverzichtPersonen gemaakt. */
      var bijOverzicht = document.querySelector("[data-review-add]");
      if (bijOverzicht) bijOverzicht.hidden = !!persoonRij;
    }

    /* De velden vullen met wat er van iemand bekend is; bij een nieuwe
       betrokkene met de standen die het vaakst kloppen. */
    function vulVelden(vak, nieuw) {
      var g = vak ? vak.dataset : {};
      velden.forEach(function (naam) {
        var el = veld(naam);
        var w = g["person" + naam.charAt(0).toUpperCase() + naam.slice(1)] || "";
        if (el.tagName === "SELECT") el.value = w || el.options[0].value;
        else el.value = w;
      });
      if (nieuw) {
        veld("country").value = "Netherlands";
        veld("ubo").value = "Financial interest";
        veld("sign").value = "Authorised to sign on their own";
        veld("pct").value = "0%";
      }
      zetUboVelden();
    }

    /* Stap 3 gaat over jezelf: de velden staan gewoon in de kaart, zonder
       kader en zonder eigen knoppen. Next gaat al verder en legt vast wat er
       staat, net als bij de uitbetaling. */
    function openZelf() {
      if (persoonRij) sluitPersoon();
      var vak = zelfVak();
      persoonRij = vak || null;
      vulVelden(vak, !vak);

      document.getElementById("person-form-head").textContent = "Personal details";
      document.querySelector("[data-person-remove]").hidden = true;
      document.querySelector("[data-person-cancel]").hidden = true;
      document.getElementById("person-save").hidden = true;
      persoonVak.classList.add("persform--kaal");

      persoonThuis.insertBefore(persoonVak, persoonAnker);
      persoonVak.hidden = false;
    }

    /* In stap 4 bewerk je iemand in zijn eigen vakje: de regel maakt plaats
       voor de velden, met Cancel en Save eronder. */
    /* Waar een geleende regel vandaan kwam, zodat hij op zijn eigen plek in de
       lijst terugkomt en de volgorde niet verspringt. */
    var persoonTerug = null;

    function openPersoon(vak) {
      if (persoonRij) sluitPersoon();
      persoonTerug = null;
      if (!vak) {
        vak = document.createElement("div");
        vak.className = "rev persrow";
        vak.setAttribute("data-person", "");
        vak.setAttribute("data-person-new", "");
        lijst.appendChild(vak);
        lijst.hidden = false;
      }
      persoonRij = vak;
      var nieuw = vak.hasAttribute("data-person-new");
      vulVelden(vak, nieuw);

      /* De tussenkop zegt wat je aan het doen bent: iemand erbij zetten, of
         de gegevens van iemand die er al staat nalopen. */
      document.getElementById("person-form-head").textContent =
        nieuw ? "Add involved person" : "Personal details";
      persoonVak.classList.remove("persform--kaal");
      document.getElementById("person-save").hidden = false;

      /* De regel blijft staan waar hij staat: de velden komen eronder, zodat
         je ziet wie je aan het bewerken bent. */
      var lees = vak.querySelector(".persrow__read");
      /* Jezelf kun je niet uit de lijst halen, en een vak dat nog niemand
         voorstelt hoeft ook niet weg. */
      document.querySelector("[data-person-remove]").hidden =
        !!(vak.hasAttribute("data-person-self") || nieuw);
      document.querySelector("[data-person-cancel]").hidden = false;

      vak.appendChild(persoonVak);
      persoonVak.hidden = false;
      zetLijstStand();
      veld("first").focus();
    }

    /* De velden terug op hun plek en het potlood weer in beeld. Een vak dat
       nog niemand voorstelt verdwijnt helemaal. */
    function sluitPersoon() {
      persoonVak.hidden = true;
      persoonThuis.insertBefore(persoonVak, persoonAnker);
      if (persoonRij) {
        if (persoonRij.hasAttribute("data-person-new")) persoonRij.remove();
        else {
          /* Stond het vak in de samenvatting omdat je daar iemand toevoegde,
             dan hoort het nu thuis in de lijst van de betrokkenenstap. */
          if (persoonRij.parentNode !== lijst) {
            if (persoonTerug) persoonTerug.ouder.insertBefore(persoonRij, persoonTerug.na);
            else { lijst.appendChild(persoonRij); lijst.hidden = false; }
          }
        }
      }
      persoonTerug = null;
      persoonRij = null;
      zetLijstStand();
    }

    /* Wat er in de regel komt te staan: hoe iemand tekent, en zijn belang. */
    function persoonRegel(soort, pct, teken) {
      var delen = [teken];
      if (soort === "Financial interest") delen.push(pct + " financial interest");
      else if (soort === "Controlling interest") delen.push("controlling interest");
      else delen.push("no UBO");
      return delen.join(" · ");
    }

    function letters(voor, achter) {
      return ((voor.charAt(0) || "") + (achter.charAt(0) || "")).toUpperCase() || "?";
    }
    /* ---- Betrokkenen in de samenvatting ------------------------------------
       Stap 7 heeft een eigen sectie voor de mensen achter de zaak. */
    function tekstDatum(waarde) {
      var d = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(waarde || "");
      return d ? d[3] + "-" + d[2] + "-" + d[1] : (waarde || "");
    }

    /* De betrokkenen in de samenvatting: een eigen sectie met een blok per
       persoon. Bij een eenmanszaak komt die ene persoon uit de kaart van de
       vertegenwoordiger, bij een BV uit de lijst van stap 3. De sectie wordt
       opnieuw opgebouwd zodra je de stap opent, dus hij loopt nooit achter. */
    function tekstVeld(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    }

    function eigenaarAlsPersoon() {
      var dag = tekstVeld("rep-dd"), maand = tekstVeld("rep-mm"), jaar = tekstVeld("rep-yyyy");
      return {
        naam: [tekstVeld("rep-first"), tekstVeld("rep-last")].filter(Boolean).join(" "),
        voor: tekstVeld("rep-first"),
        achter: tekstVeld("rep-last"),
        geboren: (dag && maand && jaar) ? dag + "-" + maand + "-" + jaar : "",
        nat: "",
        adres: [tekstVeld("rep-street"),
                [tekstVeld("rep-zip"), tekstVeld("rep-city")].filter(Boolean).join(" "),
                tekstVeld("rep-country")].filter(Boolean).join(", "),
        rol: "Owner",
        zelf: true,
        vak: null
      };
    }

    function lijstAlsPersonen() {
      return [].map.call(lijst.querySelectorAll("[data-person]:not([data-person-new])"), function (vak) {
        var g = vak.dataset;
        return {
          naam: g.personName || "",
          voor: g.personFirst || "",
          achter: g.personLast || "",
          geboren: tekstDatum(g.personDob),
          nat: g.personNat || "",
          adres: [[g.personStreet, g.personNr].filter(Boolean).join(" "),
                  [g.personZip, g.personCity].filter(Boolean).join(" "),
                  g.personCountry].filter(Boolean).join(", "),
          rol: persoonRegel(g.personUbo, g.personPct, g.personSign),
          zelf: vak.hasAttribute("data-person-self"),
          vak: vak
        };
      });
    }

    /* De eenmanszaak heeft geen eigen regel maar velden in de stap zelf. Die
       lenen we op dezelfde manier: het vak verhuist naar het blok in de
       samenvatting en gaat daarna terug naar zijn kaart. */
    var repVak   = document.getElementById("rep-fields");
    var repThuis = repVak && repVak.parentNode;
    var repAnker = repVak && repVak.nextSibling;
    var repBlok  = null;

    function repTerug() {
      if (!repVak || !repVak.closest("[data-review-people]")) return;
      repThuis.insertBefore(repVak, repAnker);
      repBlok = null;
    }

    function openEigenaar(blok) {
      repBlok = blok;
      blok.querySelector(".rev__read").hidden = true;
      blok.appendChild(repVak);
      /* Afronden met een knop in plaats van opslaan: deze velden zijn zelf de
         bron, er is niets om apart te bewaren. */
      var acts = document.createElement("div");
      acts.className = "rev__acts persform__acts";
      acts.innerHTML = '<button class="btn btn--primary btn--sm" type="button" data-rep-done>Done</button>';
      blok.appendChild(acts);
      var eerste = repVak.querySelector("input, select");
      if (eerste) eerste.focus();
    }

    function persoonBlok(p) {
      var vak = document.createElement("div");
      vak.className = "rev";
      vak.innerHTML =
        '<div class="rev__head">' +
          '<h4 class="rev__title">Review</h4>' +
          '<button class="icon-btn rev__pen" type="button" data-review-edit>' +
            '<svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg></button></div>' +
        '<div class="rev__read">' +
          '<div class="rev__line"><svg class="icon rev__icon" aria-hidden="true"><use href="#i-customers"/></svg>' +
            '<span class="rev__text"><b data-r-naam></b><span data-r-persoon></span></span></div>' +
          '<div class="rev__line"><svg class="icon rev__icon" aria-hidden="true"><use href="#i-pin"/></svg>' +
            '<span class="rev__text"><b>Residential address</b><span data-r-adres></span></span></div>' +
        '</div>';

      vak.querySelector(".rev__pen").setAttribute("aria-label", "Edit " + p.naam);
      vak.querySelector("[data-r-naam]").textContent = p.naam;
      vak.querySelector("[data-r-persoon]").textContent =
        [p.geboren, p.nat].filter(Boolean).join(" · ");
      vak.querySelector("[data-r-adres]").textContent = p.adres;

      vak.querySelector("[data-review-edit]").addEventListener("click", function () {
        /* Een eenmanszaak heeft geen eigen regel maar velden in de stap zelf;
           daar valt hier niets uit te klappen. */
        /* De eenmanszaak heeft geen eigen regel; daar lenen we de velden uit
           de stap zelf, zodat ook hier ter plekke uitgeklapt wordt. */
        if (!p.vak) { if (repBlok !== vak) openEigenaar(vak); return; }
        /* De regel uit de betrokkenenstap neemt de plaats van dit blok in, met
           de velden erin. Bij sluiten gaat hij terug naar die stap en wordt
           deze sectie opnieuw opgebouwd. */
        openPersoon(p.vak);
        persoonTerug = { ouder: p.vak.parentNode, na: p.vak.nextSibling };
        vak.parentNode.insertBefore(p.vak, vak);
        vak.hidden = true;
        p.vak.scrollIntoView({ block: "center" });
      });
      return vak;
    }

    /* Namen komen uit invoervelden, dus hier langs de HTML-opbouw. */
    function veilig(t) {
      return String(t).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }

    function docRegel(soort, titel, wie) {
      return '<div class="row row--static" data-doc="' + soort + '">' +
        '<svg class="icon row__icon" aria-hidden="true"><use href="#i-file"/></svg>' +
        '<span class="row__text"><span class="row__title">' + titel + '</span>' +
        /* Het identiteitsbewijs is van degene die tekent; zonder naam erbij
           is niet te zien wiens document er wordt gevraagd. */
        (wie ? '<span class="row__meta">' + veilig(wie) + '</span>' : "") +
        '<span class="row__meta" data-doc-file hidden></span></span>' +
        '<span class="docrow__name" data-doc-name hidden></span>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-doc-upload>Upload</button>' +
      '</div>';
    }

    /* Elke betrokkene is een eigen sectie in de samenvatting, met zijn naam en
       rol in de kop. Degene die tekent heeft zijn stukken eronder; wie er later
       bij komt levert niets aan. */
    function zetOverzichtPersonen() {
      var volgend = document.getElementById("review-agreement");
      var anker = volgend ? volgend.closest(".card") : document.querySelector(".wiz__terms");
      if (!anker) return;
      /* Staan de eigenaarsvelden nog in zo'n blok, dan eerst terug naar hun
         kaart; anders verdwijnen ze met de oude sectie. */
      repTerug();
      document.querySelectorAll("[data-review-person], [data-review-bij]").forEach(function (oud) {
        oud.remove();
      });

      var mensen = alleenEigenaar() ? [eigenaarAlsPersoon()] : lijstAlsPersonen();
      mensen = mensen.filter(function (p) { return p.naam; });
      if (!mensen.length) return;

      /* Degene die tekent is de eerste betrokkene; die staat als "you" in de
         lijst en levert het identiteitsbewijs aan. */
      var tekenaar = mensen.filter(function (p) { return p.zelf; })[0] || mensen[0];
      var stap = anker.dataset.step || "6";

      mensen.forEach(function (p, i) {
        var kaart = document.createElement("div");
        kaart.className = "card card--flush";
        kaart.setAttribute("data-step", stap);
        kaart.setAttribute("data-review-person", "");
        /* Normaal bouwt deze sectie zich op bij een stapwissel en zet toonStap
           hem daarna aan. Bouwen we midden in de stap opnieuw op, dan komt die
           wissel niet; het anker staat in dezelfde stap en weet dus of we
           zichtbaar zijn. */
        kaart.hidden = anker.hidden;

        var id = "review-person-" + (i + 1);
        kaart.innerHTML =
          '<button class="cardhead acct__head" type="button" aria-expanded="true" aria-controls="' + id + '">' +
            '<span class="acct__mark acct__mark--person" aria-hidden="true"></span>' +
            '<span class="acct__text"><span class="acct__name"></span>' +
            '<span class="acct__role"></span></span>' +
            '<span class="badge badge--active u-normal">Ready to submit</span>' +
            '<span class="badge badge--muted u-update">Done</span>' +
            '<svg class="icon cardhead__chev" aria-hidden="true"><use href="#i-chevron-down"/></svg>' +
          '</button><div class="acct" id="' + id + '"></div>';
        /* De rol staat onder de naam in de kop; in het blok eronder zou die
           hetzelfde nog een keer zeggen. */
        kaart.querySelector(".acct__role").textContent = p.zelf
          ? ["Account representative", p.rol].filter(Boolean).join(" · ")
          : p.rol;
        kaart.querySelector(".acct__mark").textContent = letters(p.voor, p.achter);
        kaart.querySelector(".acct__name").textContent = p.naam;

        var body = kaart.querySelector(".acct");
        body.appendChild(persoonBlok(p));

        /* De stukken horen bij degene die tekent, dus onder zijn sectie. */
        if (p === tekenaar) {
          body.insertAdjacentHTML("beforeend",
            '<h4 class="card__subtitle">Confirm your identity</h4>' +
            '<p class="card__sub">Upload the <a class="link" href="#">accepted documents</a>.</p>' +
            '<div class="rows">' +
            docRegel("identity", "Identity document", p.naam) +
            docRegel("statement", "Bank statement", "The account we pay out to") + '</div>');
        }

        anker.parentNode.insertBefore(kaart, anker);
      });

      /* Er kan er altijd iemand bij. Een eenmanszaak heeft maar een eigenaar,
         dus daar niet. */
      if (alleenEigenaar()) return;

      var vak = document.createElement("div");
      vak.setAttribute("data-review-bij", "");
      vak.setAttribute("data-step", stap);
      vak.hidden = anker.hidden;

      var bij = document.createElement("button");
      bij.className = "addrow";
      bij.type = "button";
      bij.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-plus-circle"/></svg>Add person';
      /* Zodat zetLijstStand deze knop ook kan wegzetten zolang je met iemand
         bezig bent. Een eigen naam, want data-person-add zou de gedeelde
         klikafhandeling een tweede keer laten openen. */
      bij.setAttribute("data-review-add", "");
      bij.addEventListener("click", function () {
        /* De velden klappen hier uit in plaats van je terug te sturen naar de
           betrokkenenstap; het vak reist mee en belandt bij het opslaan alsnog
           in de lijst daar (zie sluitPersoon). */
        openPersoon(null);
        vak.insertBefore(persoonRij, bij);
        veld("first").focus();
      });
      vak.appendChild(bij);
      anker.parentNode.insertBefore(vak, anker);
    }

    /* Wat er is ingevuld vastleggen. In stap 3 gebeurt dat als je doorloopt,
       in stap 4 met de knop Save; daar hoort dan ook een melding bij. */
    function bewaarPersoon(stil) {
      var voor = veld("first").value.trim();
      var achter = veld("last").value.trim();
      if (!voor || !achter) {
        if (!stil) veld("first").focus();
        return false;
      }

      var vak = persoonRij;
      /* Nog geen vak: dit is de eerste betrokkene, degene die tekent. Hij
         krijgt het label "you" en de stand dat hij zich moet legitimeren. */
      var zelf = false;
      if (!vak) {
        vak = document.createElement("div");
        vak.className = "rev persrow";
        vak.setAttribute("data-person", "");
        vak.setAttribute("data-person-new", "");
        vak.setAttribute("data-person-self", "");
        lijst.appendChild(vak);
        persoonRij = vak;
        zelf = true;
      }
      var nieuw = vak.hasAttribute("data-person-new");

      var lees = vak.querySelector(".persrow__read");
      if (!lees) {
        lees = document.createElement("div");
        lees.className = "row row--static persrow__read";
        lees.innerHTML =
          '<span class="acct__mark acct__mark--person" aria-hidden="true"></span>' +
          '<span class="row__text"><span class="row__title"></span>' +
          '<span class="row__meta" data-person-meta></span></span>' +
          /* Legitimeren hoeft alleen de eerste betrokkene, degene die de
             overeenkomst tekent; de rest krijgt dus geen stand mee. */
          (zelf ? '<span class="badge badge--pending" data-person-status>Identification required</span>' : "") +
          '<button class="icon-btn rev__pen" type="button" data-person-edit>' +
            '<svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg></button>';
        vak.insertBefore(lees, vak.firstChild);
      }

      velden.forEach(function (naam) {
        vak.dataset["person" + naam.charAt(0).toUpperCase() + naam.slice(1)] = veld(naam).value;
      });
      vak.dataset.personName = voor + " " + achter;
      lees.querySelector(".acct__mark").textContent = letters(voor, achter);
      var titel = lees.querySelector(".row__title");
      titel.textContent = voor + " " + achter;
      if (vak.hasAttribute("data-person-self")) {
        var pil = document.createElement("span");
        pil.className = "pill";
        pil.textContent = "you";
        titel.appendChild(pil);
      }
      lees.querySelector("[data-person-meta]").textContent =
        persoonRegel(veld("ubo").value, veld("pct").value, veld("sign").value);
      lees.querySelector("[data-person-edit]").setAttribute("aria-label", "Edit " + voor + " " + achter);

      /* Het vak stelt nu iemand voor; sluiten mag het niet meer weggooien. */
      vak.removeAttribute("data-person-new");
      sluitPersoon();
      if (!stil) showToast(nieuw ? voor + " " + achter + " added" : "Details saved");
      return true;
    }

    document.getElementById("person-save").addEventListener("click", function () {
      /* Voeg je iemand toe vanuit de samenvatting, dan moet die sectie daarna
         opnieuw worden opgebouwd; normaal gebeurt dat alleen bij een stapwissel. */
      var uitOverzicht = vanuitOverzicht();
      if (bewaarPersoon(false) && uitOverzicht) zetOverzichtPersonen();
    });

    /* Bij elke stapwissel: eerst vastleggen wat er in stap 3 is ingevuld, dan
       de samenvatting bijwerken, en in stap 3 de eigen gegevens tonen. */
    document.addEventListener("wiz-stap", function (e) {
      if (!alleenEigenaar() && persoonVak.classList.contains("persform--kaal")
          && !persoonVak.hidden) {
        bewaarPersoon(true);
      } else if (persoonRij) {
        /* Een vak dat je openliet en niet opsloeg is geen betrokkene: pas als
           je echt iemand toevoegt hoort er een regel te staan. */
        sluitPersoon();
      }
      zetOverzichtPersonen();
      if (e.detail === 3 && !alleenEigenaar()) openZelf();
    });
    zetLijstStand();

    /* Opnieuw beginnen: de betrokkenen van de vorige rechtsvorm gaan eruit. */
    document.addEventListener("wiz-herstart", function () {
      if (persoonRij) sluitPersoon();
      lijst.querySelectorAll("[data-person]").forEach(function (rij) { rij.remove(); });
      zetLijstStand();
    });

    /* Werk je iemand bij vanuit de samenvatting, dan staat die sectie met een
       verborgen blok en een geleende regel; na sluiten moet hij opnieuw. */
    function vanuitOverzicht() {
      return !!(persoonRij && persoonRij.closest("[data-review-people]"));
    }

    document.addEventListener("click", function (e) {
      if (e.target.closest("[data-person-add]")) { openPersoon(null); return; }
      if (e.target.closest("[data-person-cancel]")) {
        var uitOverzicht = vanuitOverzicht();
        sluitPersoon();
        if (uitOverzicht) zetOverzichtPersonen();
        return;
      }
      var wijzig = e.target.closest("[data-person-edit]");
      if (wijzig) {
        var rij = wijzig.closest("[data-person]");
        /* Het potlood blijft staan terwijl je bewerkt; nog eens klikken moet
           de velden niet opnieuw inlezen en je wijzigingen weggooien. */
        if (rij !== persoonRij) openPersoon(rij);
        return;
      }
      if (e.target.closest("[data-rep-done]")) { zetOverzichtPersonen(); return; }
      var weg = e.target.closest("[data-person-remove]");
      if (weg) {
        var vak = weg.closest("[data-person]");
        var naam = vak.dataset.personName;
        var uitOverzicht = vanuitOverzicht();
        /* Eerst de velden terug op hun plek, anders verdwijnen ze mee. */
        sluitPersoon();
        vak.remove();
        zetLijstStand();
        if (uitOverzicht) zetOverzichtPersonen();
        showToast(naam + " removed");
      }
    });
  }

  /* ---- Documenten aanleveren in de onboarding -----------------------------
     Elk vak met data-upload werkt hetzelfde: slepen of kiezen, daarna zie je
     welk bestand erin zit en kun je het vervangen. De stand rechtsboven zegt
     of het stuk er al is. Wat er echt mee gebeurt is iets voor de koppeling
     met Pay.nl; hier laten we zien hoe het eruitziet. */
  var uploadVakken = document.querySelectorAll("[data-upload]");

  if (uploadVakken.length) {
    var UPLOAD_MAX = 25 * 1048576;

    /* De naam die je in stap 1 invult, staat ook bij het stuk dat we van dat
       bedrijf nodig hebben. */
    var naamVeld = document.getElementById("biz-name");
    function zetBedrijfsnaam() {
      var naam = naamVeld.value.trim() || "your business";
      document.querySelectorAll("[data-biz-name]").forEach(function (el) {
        el.textContent = naam;
      });
    }
    naamVeld.addEventListener("input", zetBedrijfsnaam);
    zetBedrijfsnaam();
    var UPLOAD_SOORT = /\.(pdf|jpe?g)$/i;

    function uploadToon(vak, bestand) {
      var zone = vak.querySelector(".drop");
      var stand = vak.querySelector("[data-upload-status]");
      vak.querySelector(".drop__empty").hidden = !!bestand;
      vak.querySelector(".drop__file").hidden = !bestand;
      vak.querySelector(".drop__again").hidden = !bestand;
      zone.classList.toggle("drop--filled", !!bestand);

      if (bestand) {
        var soort = (bestand.name.split(".").pop() || "").toUpperCase();
        vak.querySelector(".drop__kind").textContent = soort === "JPEG" ? "JPG" : soort;
        vak.querySelector(".drop__name").textContent = bestand.name;
        stand.textContent = "Received";
        stand.className = "badge badge--active";
      } else {
        stand.textContent = "Data incomplete";
        stand.className = "badge badge--pending";
      }
      stand.setAttribute("data-upload-status", "");
      /* Leeg, zodat hetzelfde bestand opnieuw kiezen ook weer iets doet. */
      vak.querySelector("input").value = "";
      /* Elders in de stap hangt de tekenknop hiervan af. */
      document.dispatchEvent(new CustomEvent("upload-stand"));
    }

    function uploadNeem(vak, bestand) {
      if (!bestand) return;
      if (!UPLOAD_SOORT.test(bestand.name)) {
        showToast("This file type is not accepted. Use a PDF or JPG.");
        return;
      }
      if (bestand.size > UPLOAD_MAX) {
        showToast("This file is larger than 25 MB.");
        return;
      }
      uploadToon(vak, bestand);
      showToast(vak.querySelector(".rev__title").textContent + " uploaded");
    }

    uploadVakken.forEach(function (vak) {
      var zone = vak.querySelector(".drop");
      var kiezer = vak.querySelector("input");

      ["dragenter", "dragover"].forEach(function (t) {
        zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.add("is-over"); });
      });
      ["dragleave", "drop"].forEach(function (t) {
        zone.addEventListener(t, function (e) { e.preventDefault(); zone.classList.remove("is-over"); });
      });
      zone.addEventListener("drop", function (e) { uploadNeem(vak, e.dataTransfer.files[0]); });
      kiezer.addEventListener("change", function () { uploadNeem(vak, this.files[0]); });

      vak.addEventListener("click", function (e) {
        if (e.target.closest("[data-upload-pick]")) kiezer.click();
      });
    });
  }


  /* ---- De samenvatting volgt wat er is ingevuld ----------------------------
     De blokken in stap 7 stonden vol met voorbeeldtekst. Ze lezen nu uit de
     velden van stap 1 en 2, zodat de ondernemer zijn eigen gegevens terugziet
     voordat hij de aanvraag verstuurt. */
  var sumVak = document.querySelector("[data-sum-legal]");

  if (sumVak) {
    function sumWaarde(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    }

    function sumZet(kies, tekst, terug) {
      document.querySelectorAll(kies).forEach(function (el) {
        el.textContent = tekst || terug;
      });
    }

    function vulSamenvatting() {
      var naam = sumWaarde("biz-name");
      var kvk = sumWaarde("biz-kvk");
      var btw = sumWaarde("biz-vat");
      var adres = [sumWaarde("biz-street"), sumWaarde("biz-nr")].filter(Boolean).join(" ");
      var plaats = [sumWaarde("biz-zip"), sumWaarde("biz-city")].filter(Boolean).join(" ");
      var land = sumWaarde("biz-addr-country");

      sumZet("[data-sum-name]", naam, "Your business");
      /* Het vierkantje bij de naam: de eerste letter van de zaak. */
      sumZet("[data-sum-mark]", (naam || "O").charAt(0).toUpperCase(), "O");
      sumZet("[data-sum-legal]", sumWaarde("biz-legal"), "Not filled in yet");
      sumZet("[data-sum-ids]", [kvk ? "KVK " + kvk : "", btw ? "VAT " + btw : ""]
        .filter(Boolean).join(" · "), "No registration number yet");
      sumZet("[data-sum-address]", [adres, plaats, land].filter(Boolean).join(", "),
        "No address yet");
      sumZet("[data-sum-category]", sumWaarde("act-category"), "Not chosen yet");
      sumZet("[data-sum-desc]", sumWaarde("act-desc"), "Not described yet");
    }

    /* De stand van een sectie hangt af van de stukken die erin gevraagd
       worden: zolang er een ontbreekt is de sectie niet klaar om te versturen.
       De overeenkomst heeft een eigen stand en blijft hier buiten. */
    function zetSectieStand() {
      document.querySelectorAll(".wiz .card--flush").forEach(function (kaart) {
        var stand = kaart.querySelector(".badge.u-normal");
        if (!stand) return;
        var mist = [].filter.call(kaart.querySelectorAll("[data-doc] [data-doc-file]"),
          function (el) { return el.hidden; }).length;
        stand.textContent = mist
          ? (mist === 1 ? "Document required" : "Documents required")
          : "Ready to submit";
        stand.className = "badge " + (mist ? "badge--pending" : "badge--active") + " u-normal";
      });
    }


    /* Wat de zaak doet, ook hier te wijzigen. De keuzelijst wordt gevuld
       vanuit stap 2, zodat de categorieen op een plek staan en niet uit elkaar
       kunnen lopen. */
    var actKeuze = document.getElementById("rev-category");
    var actBron  = document.getElementById("act-category");
    if (actKeuze && actBron) {
      [].forEach.call(actBron.options, function (o) { actKeuze.add(new Option(o.text, o.value)); });
    }

    var ACT_PAREN = [["rev-category", "act-category"]];

    document.addEventListener("click", function (e) {
      if (!document.getElementById("review-activity")) return;

      if (e.target.closest("#review-activity .rev__pen")) {
        ACT_PAREN.forEach(function (p) {
          if (sumVeld(p[0]) && sumVeld(p[1])) sumVeld(p[0]).value = sumVeld(p[1]).value;
        });
        return;
      }

      if (e.target.closest("#review-activity .rev__save")) {
        ACT_PAREN.forEach(function (p) {
          if (sumVeld(p[0]) && sumVeld(p[1])) sumVeld(p[1]).value = sumVeld(p[0]).value;
        });
        vulSamenvatting();
        zetSectieStand();
      }
    });

    /* De zaak is ook in de samenvatting te wijzigen. Dat mag niet naast de
       velden van stap 1 gaan leven, dus het potlood haalt ze daar op en
       opslaan schrijft ze terug. Daarna kloppen de regels, de documenten en
       de eerste alinea van de overeenkomst weer met elkaar. */
    var BIZ_PAREN = [["rev-type", "biz-legal"], ["rev-name", "biz-name"],
                     ["rev-kvk", "biz-kvk"], ["rev-vat", "biz-vat"],
                     ["rev-zip2", "biz-zip"], ["rev-city2", "biz-city"]];

    function sumVeld(id) { return document.getElementById(id); }

    document.addEventListener("click", function (e) {
      if (!document.getElementById("review-business")) return;

      if (e.target.closest("#review-business .rev__pen")) {
        BIZ_PAREN.forEach(function (p) {
          if (sumVeld(p[0]) && sumVeld(p[1])) sumVeld(p[0]).value = sumVeld(p[1]).value;
        });
        var straat = sumVeld("rev-street2");
        if (straat) {
          straat.value = [sumWaarde("biz-street"), sumWaarde("biz-nr")].filter(Boolean).join(" ");
        }
        return;
      }

      if (e.target.closest("#review-business .rev__save")) {
        /* Een andere rechtsvorm betekent andere vragen, andere betrokkenen en
           andere stukken. Dan is bijwerken niet genoeg: de aanvraag begint
           opnieuw, zoals het venster ook aankondigt. */
        var vorm = sumVeld("biz-legal");
        var nieuweVorm = sumVeld("rev-type") ? sumVeld("rev-type").value.trim() : "";
        var anders = !!(vorm && nieuweVorm && nieuweVorm !== vorm.value);

        BIZ_PAREN.forEach(function (p) {
          if (sumVeld(p[0]) && sumVeld(p[1])) sumVeld(p[1]).value = sumVeld(p[0]).value.trim();
        });
        /* Straat en huisnummer staan in stap 1 apart; hier op één regel. */
        var heel = sumVeld("rev-street2") ? sumVeld("rev-street2").value.trim() : "";
        var deel = /^(.*?)\s+([0-9]\S*)$/.exec(heel);
        if (sumVeld("biz-street")) sumVeld("biz-street").value = deel ? deel[1] : heel;
        if (sumVeld("biz-nr")) sumVeld("biz-nr").value = deel ? deel[2] : "";

        if (anders) { herstartWiz(); return; }
        vulSamenvatting();
        zetSectieStand();
        /* De overeenkomst leest dezelfde gegevens. */
        document.dispatchEvent(new CustomEvent("wiz-bij"));
      }
    });

    /* Opnieuw beginnen: alles wat is ingevuld gaat eruit, behalve de zojuist
       gekozen rechtsvorm. De blokken die hun eigen gegevens bijhouden ruimen
       zichzelf op; daarvoor is het bericht. */
    function herstartWiz() {
      var wiz = document.getElementById("pay-wiz");
      if (!wiz) return;

      wiz.querySelectorAll("input, textarea").forEach(function (el) {
        if (el.type === "file" || el.type === "radio" || el.type === "checkbox") return;
        /* De rechtsvorm zelf blijft staan: daar begin je mee opnieuw. */
        el.value = "";
      });
      /* Aangeleverde stukken zijn van de vorige rechtsvorm. */
      wiz.querySelectorAll("[data-doc]").forEach(function (rij) {
        var stuk = rij.querySelector("[data-doc-file]");
        var naam = rij.querySelector("[data-doc-name]");
        var knop = rij.querySelector("[data-doc-upload]");
        if (stuk) { stuk.textContent = ""; stuk.hidden = true; }
        if (naam) { naam.textContent = ""; naam.hidden = true; }
        if (knop) {
          knop.className = "btn btn--ghost btn--sm";
          knop.removeAttribute("aria-label");
          knop.textContent = "Upload";
        }
      });

      document.dispatchEvent(new CustomEvent("wiz-herstart"));
      vulSamenvatting();
      zetSectieStand();
      document.dispatchEvent(new CustomEvent("wiz-ga", { detail: 1 }));
      showToast("Business type changed. Start the setup again.");
    }

    /* Het contract opnieuw opmaken zodra je het opent: er kan sinds de vorige
       stapwissel van alles gewijzigd zijn. */
    document.addEventListener("click", function (e) {
      if (e.target.closest('[data-dialog="agreement-dialog"]')) {
        document.dispatchEvent(new CustomEvent("wiz-bij"));
      }
    });

    /* De rechtsvorm bepaalt de rest van de aanvraag: welke betrokkenen er
       gevraagd worden, welke stukken erbij horen en of er een stap bij komt.
       Daarom eerst een bevestiging; pas daarna klapt het vak open. In de
       opvangfase, zodat de gewone potloodafhandeling niet voorgaat. */
    document.addEventListener("click", function (e) {
      var pen = e.target.closest("[data-type-pen]");
      if (!pen) return;
      e.preventDefault();
      e.stopPropagation();
      var venster = document.getElementById("type-dialog");
      if (venster) venster.hidden = false;
    }, true);

    document.addEventListener("click", function (e) {
      if (!e.target.closest("#type-go")) return;
      document.getElementById("type-dialog").hidden = true;
      var blok = document.getElementById("review-type");
      if (!blok) return;
      var keuze = document.getElementById("rev-type");
      var vorm = document.getElementById("biz-legal");
      if (keuze && vorm) keuze.value = vorm.value;
      blok.querySelector(".rev__read").hidden = true;
      blok.querySelector(".rev__form").hidden = false;
      if (keuze) keuze.focus();
    });
    document.addEventListener("wiz-stap", function () {
      vulSamenvatting();
      zetSectieStand();
    });
    document.addEventListener("upload-stand", zetSectieStand);
    vulSamenvatting();
    zetSectieStand();
  }
  /* ---- De overeenkomst in stap 6 -------------------------------------------
     De eerste alinea van het contract is geen vaste tekst: daar staat de zaak
     in zoals die in stap 1 is ingevuld, met de tekenbevoegde erbij. Zo leest
     de ondernemer zijn eigen gegevens terug voordat hij tekent. Wat je kiest
     bij Legitimatie bepaalt of er een achterkant bij hoort; een paspoort heeft
     er maar een. */
  var contract = document.querySelector(".contract");

  if (contract) {
    var tekenNaam = document.getElementById("sign-name");

    function waarde(id) {
      var el = document.getElementById(id);
      return el ? el.value.trim() : "";
    }

    /* De tekenbevoegde: bij een eenmanszaak de eigenaar uit stap 3, anders de
       eerste betrokkene uit de lijst. */
    function tekenbevoegde() {
      var enkel = document.querySelector('[data-people="single"]');
      if (enkel && enkel.dataset.off !== "ja") {
        return [waarde("rep-first"), waarde("rep-last")].filter(Boolean).join(" ");
      }
      var zelf = document.querySelector("[data-person-self]");
      return zelf ? (zelf.dataset.personName || "") : "";
    }

    function zetTekst(kies, tekst, terug) {
      var el = contract.querySelector(kies);
      if (el) el.textContent = tekst || terug;
    }

    function vulContract() {
      var naam = waarde("biz-name");
      var stad = waarde("biz-city");
      var adres = [waarde("biz-street"), waarde("biz-nr")].filter(Boolean).join(" ");
      var teken = tekenbevoegde();

      zetTekst("[data-ct-name]", naam.toUpperCase(), "YOUR BUSINESS");
      zetTekst("[data-ct-city]", stad, "your city");
      /* Alleen straat en huisnummer: de plaats staat al in "established in",
         anders zou die er twee keer staan. */
      zetTekst("[data-ct-address]", adres, "your business address");
      zetTekst("[data-ct-kvk]", waarde("biz-kvk"), "your Chamber of Commerce number");
      zetTekst("[data-ct-rep]", teken.toUpperCase(), "THE ACCOUNT REPRESENTATIVE");

      /* De naam staat vast zodra je er zelf iets anders neerzet. */
      if (tekenNaam && !tekenNaam.dataset.getypt) tekenNaam.value = teken;
    }

    if (tekenNaam) {
      tekenNaam.addEventListener("input", function () { this.dataset.getypt = "ja"; });
    }

    /* ---- Tekenen met een knop ---------------------------------------------
       Ondertekenen is een handeling, geen invulveld: je typt je naam en drukt
       op de knop. Wat je typte komt dan onder het contract te staan, met de
       datum van vandaag en de plaats uit stap 1 erbij. Ongedaan maken kan,
       zolang de aanvraag niet de deur uit is. */
    var tekenKnop = document.getElementById("sign-go");

    function vandaag() {
      var d = new Date();
      function twee(n) { return (n < 10 ? "0" : "") + n; }
      return twee(d.getDate()) + "-" + twee(d.getMonth() + 1) + "-" + d.getFullYear();
    }

    /* Waarom er nog niet getekend kan worden: het identiteitsbewijs ontbreekt,
       of de naam eronder. Dat staat op drie plekken, zodat je het ziet zonder
       het venster te openen: in de stand van de sectie, in de regel eronder en
       naast de knop in het venster zelf. */
    function tekenReden() {
      var stuk = document.querySelector('[data-doc="identity"] [data-doc-file]');
      if (!stuk || stuk.hidden) return "id";
      if (!tekenNaam.value.trim()) return "naam";
      return "";
    }

    function tekenMag() { return tekenReden() === ""; }

    function zetTekenKlaar() {
      /* Is er al getekend, dan valt er niets meer te melden. */
      if (!tekenKnop || tekenKnop.hidden) return;
      var reden = tekenReden();
      tekenKnop.disabled = !!reden;

      var uitleg = document.querySelector(".signbar__note");
      if (uitleg) {
        uitleg.hidden = !reden;
        if (reden === "id") {
          uitleg.innerHTML = 'You need to upload your identity document before you can sign. '
            + '<button class="link link--btn" type="button" data-ga-identity>Upload it now</button>';
        } else if (reden === "naam") {
          uitleg.textContent = "Fill in the name of the undersigned.";
        }
      }
      if (tekenStand) {
        tekenStand.textContent = reden === "id" ? "Identity document required" : "Not signed yet";
      }
      if (tekenRegel) {
        tekenRegel.textContent = reden === "id"
          ? "Upload your identity document first, at People involved"
          : "Read it and sign with your name";
      }
    }

    /* Vanuit het venster meteen naar het uploadvenster van het identiteits-
       bewijs: dat scheelt zoeken. */
    document.addEventListener("click", function (e) {
      if (!e.target.closest("[data-ga-identity]")) return;
      var venster = document.getElementById("agreement-dialog");
      if (venster) venster.hidden = true;
      var knop = document.querySelector('[data-doc="identity"] [data-doc-upload]');
      if (knop) knop.click();
    });

    if (tekenKnop) {
      var tekenVenster = document.getElementById("agreement-dialog");
      var tekenRegel = document.querySelector("[data-sign-meta]");
      var tekenOpen = document.getElementById("sign-open");
      var tekenStand = document.querySelector("[data-sign-state]");
      var tekenLead = document.querySelector("[data-sign-lead]");
      var merk = contract.querySelector("[data-sign-mark]");

      /* Tekenen is eenmalig: terugdraaien kan niet, want dan is de
         handtekening niets meer waard. */
      function zetHandtekening(naam) {
        var datum = vandaag();
        merk.textContent = naam;
        merk.hidden = false;
        zetTekst("[data-sign-name]", naam, "");
        zetTekst("[data-sign-date]", datum, "");
        zetTekst("[data-sign-place]", waarde("biz-city"), "");

        /* Het venster gaat dicht; de regel en de kop zeggen dat het stuk de
           deur uit is. */
        var zin = "Signed by " + naam + " on " + datum;
        tekenVenster.hidden = true;
        tekenStand.textContent = "Sent";
        tekenStand.className = "badge badge--active";
        tekenStand.setAttribute("data-sign-state", "");
        tekenLead.textContent = zin;
        tekenRegel.textContent = zin;
        tekenOpen.textContent = "View";
        tekenKnop.hidden = true;
        /* In het venster blijft staan wie er wanneer tekende. */
        var uitleg = document.querySelector(".signbar__note");
        if (uitleg) {
          uitleg.textContent = zin + ".";
          uitleg.hidden = false;
        }
        tekenNaam.readOnly = true;
        /* De knop van de stap kijkt hier ook naar. */
        document.dispatchEvent(new CustomEvent("wiz-klaar"));
      }

      tekenKnop.addEventListener("click", function () {
        if (!tekenMag()) return;
        zetHandtekening(tekenNaam.value.trim());
        showToast("Agreement signed and sent");
      });

      /* De knop volgt de velden: de naam erboven en het identiteitsbewijs dat
         je bij de betrokkenen aanlevert. Dat bericht komt uit het uploadblok
         en uit het documentvenster. */
      tekenNaam.addEventListener("input", zetTekenKlaar);
      document.addEventListener("upload-stand", zetTekenKlaar);
      zetTekenKlaar();
    }

    /* Bijwerken zodra de wizard een stap laat zien: dan is stap 1 net langs
       geweest en klopt de alinea met wat er staat. */
    document.addEventListener("wiz-stap", vulContract);
    /* En zodra er elders iets is gewijzigd dat in het contract terugkomt. */
    document.addEventListener("wiz-bij", vulContract);

    /* Opnieuw beginnen: de handtekening hoort bij de vorige aanvraag. */
    document.addEventListener("wiz-herstart", function () {
      if (!tekenKnop) return;
      merk.textContent = "";
      merk.hidden = true;
      zetTekst("[data-sign-name]", "", "");
      zetTekst("[data-sign-date]", "", "");
      zetTekst("[data-sign-place]", "", "");
      tekenVenster.hidden = true;
      tekenKnop.hidden = false;
      tekenOpen.textContent = "Review and sign";
      tekenNaam.readOnly = false;
      tekenNaam.value = "";
      delete tekenNaam.dataset.getypt;
      tekenStand.textContent = "Not signed yet";
      tekenStand.className = "badge badge--pending";
      tekenStand.setAttribute("data-sign-state", "");
      tekenLead.textContent = "Read it, confirm your identity and sign with your name";
      zetTekenKlaar();
    });
    vulContract();

  }
  /* ---- Uitbetaalrekening in de onboarding ---------------------------------
     De velden blijven gewoon staan, ook als ze ingevuld zijn: er valt hier
     niets te bevestigen. Bij elke stapwissel schrijven we wat er staat door
     naar de samenvatting, zodat die klopt met wat je hebt ingevuld. */
  var bankVak = document.getElementById("bank-form");

  if (bankVak) {
    function bewaarBank() {
      var iban = document.getElementById("bank-iban").value.trim();
      var houder = document.getElementById("bank-holder").value.trim();
      var bic = document.getElementById("bank-bic").value.trim().toUpperCase();
      if (!iban || !houder) return false;
      /* In de samenvatting staat de BIC achter het IBAN, als hij is ingevuld. */
      document.querySelectorAll("[data-payout-iban]").forEach(function (el) {
        el.textContent = bic ? iban + " · " + bic : iban;
      });
      document.querySelectorAll("[data-payout-holder]").forEach(function (el) {
        el.textContent = houder;
      });
      return true;
    }

    /* In de samenvatting is dezelfde rekening te wijzigen. Het potlood vult
       de velden met wat er staat; opslaan schrijft het terug naar de stap en
       naar de regel erboven. */
    document.addEventListener("click", function (e) {
      var vak = document.getElementById("review-payout");
      if (!vak) return;
      var velden = [["rev-holder", "bank-holder"], ["rev-iban", "bank-iban"], ["rev-bic", "bank-bic"]];

      if (e.target.closest("#review-payout .rev__pen")) {
        velden.forEach(function (p) {
          document.getElementById(p[0]).value = document.getElementById(p[1]).value;
        });
        return;
      }
      if (e.target.closest("#review-payout .rev__save")) {
        velden.forEach(function (p) {
          document.getElementById(p[1]).value = document.getElementById(p[0]).value.trim();
        });
        bewaarBank();
      }
    });

    document.addEventListener("wiz-stap", bewaarBank);
  }
})();
