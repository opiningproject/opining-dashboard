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

    var bij = [].slice.call(tools.querySelectorAll(".btn:not(.btn--primary)"));
    if (bij.length < 1 || bij.length === tools.querySelectorAll(".btn").length) return;

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
      if (dichtSort && som.classList.contains("sort__menu--row")) plaatsRijMenu(sortKnop, som);
      return;
    }

    var sortItem = e.target.closest(".sort__item");
    if (sortItem) {
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
    document.getElementById("buy-go").addEventListener("click", function () {
      if (!koopWinkel.value.trim()) {
        koopWinkel.classList.add("input--error");
        koopFout.hidden = false;
        koopWinkel.focus();
        return;
      }
      showToast(koopNaam.textContent + " purchased");
      backFromSub();
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
    /* Verwijderen kan pas vanaf twee diensten, en "Add shift" hoort alleen op
       de onderste regel — anders staat hij midden in de rij. */
    function syncShifts(rij) {
      var shifts = rij.querySelectorAll(".shift");
      shifts.forEach(function (shift, i) {
        shift.querySelector(".shift__del").hidden = shifts.length < 2;
        shift.querySelector(".shift__add").hidden = i !== shifts.length - 1;
      });
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
      rij.querySelectorAll(".shift").forEach(function (shift) {
        var velden = shift.querySelectorAll(".time");
        if (velden.length === 2) delen.push(velden[0].value + " - " + velden[1].value);
      });
      sum.textContent = delen.join("  ·  ");
    }

    /* Open of dicht is puur een mobiele stand: op desktop doet de klasse
       niets, dus hoeft hier niets met schermbreedtes gerekend te worden. */
    function setDagUitgeklapt(rij, uit) {
      rij.classList.toggle("hrow--shut", !uit);
      var knop = rij.querySelector(".hrow__more");
      if (knop) knop.setAttribute("aria-expanded", uit ? "true" : "false");
      if (!uit) syncSamenvatting(rij);
    }

    function setDagOpen(rij, open) {
      rij.classList.toggle("is-off", !open);
      rij.querySelector(".shifts").hidden = !open;
      rij.querySelector(".closed").hidden = open;
      syncSamenvatting(rij);
    }

    hoursView.addEventListener("click", function (e) {
      var rij = e.target.closest(".hrow");
      if (!rij) return;

      /* De hele kopregel klapt de dag open, niet alleen de chevron. Wat je
         zelf bedient blijft van zichzelf: de schakelaar, de tijdvelden en de
         knoppen daarnaast. En alleen waar de chevron ook echt staat: op
         desktop staat elke dag altijd open. */
      var chevron = rij.querySelector(".hrow__more");
      if (chevron && chevron.offsetParent && !e.target.closest(".switch, .shifts, .closed")) {
        setDagUitgeklapt(rij, rij.classList.contains("hrow--shut"));
        return;
      }

      if (e.target.closest(".shift__add")) {
        /* Niet .shift:last-child: onder de laatste dienst kan een foutmelding
           staan, en die is dan het laatste kind. */
        var alle = rij.querySelectorAll(".shift");
        var laatste = alle[alle.length - 1];
        var kopie = laatste.cloneNode(true);
        /* De foutstaat hoort bij die ene waarde, niet bij een nieuwe dienst. */
        kopie.querySelectorAll(".time").forEach(function (veld) {
          veld.classList.remove("time--error");
          veld.removeAttribute("aria-invalid");
          veld.removeAttribute("aria-describedby");
        });
        /* Achter de melding van de laatste dienst, anders zou de kopie de
           melding van zijn voorganger overnemen. */
        var na = laatste.nextElementSibling;
        (na && na.classList.contains("shift__error") ? na : laatste).after(kopie);
        /* De kopie draagt dezelfde tijden, dus geldt dezelfde toets. */
        valideerShift(kopie);
        syncShifts(rij);
        syncSamenvatting(rij);
        markUnsaved("Opening hours");
      }

      if (e.target.closest(".shift__del")) {
        if (rij.querySelectorAll(".shift").length < 2) return;
        var weg = e.target.closest(".shift");
        var melding = weg.nextElementSibling;
        if (melding && melding.classList.contains("shift__error")) melding.remove();
        weg.remove();
        syncShifts(rij);
        syncSamenvatting(rij);
        markUnsaved("Opening hours");
      }
    });

    hoursView.addEventListener("change", function (e) {
      if (e.target.matches('.switch input')) setDagOpen(e.target.closest(".hrow"), e.target.checked);
      markUnsaved("Opening hours");
    });
    hoursView.addEventListener("input", function (e) {
      var shift = e.target.closest(".shift");
      if (shift) valideerShift(shift);
      var rij = e.target.closest(".hrow");
      if (rij) syncSamenvatting(rij);
      markUnsaved("Opening hours");
    });

    /* Alles begint dicht: op mobiel is dat de hele winst, op desktop doet de
       klasse niets. */
    hoursView.querySelectorAll(".hrow").forEach(function (rij) {
      setDagUitgeklapt(rij, false);
    });
    hoursView.querySelectorAll(".shift").forEach(valideerShift);
  }


  /* ---- Inklapbare kaartsecties ------------------------------------------- */
  /* Een .cardhead klapt in wat zijn aria-controls aanwijst. Gedelegeerd, dus
     het werkt ook voor secties die later in de HTML bijkomen. */
  document.addEventListener("click", function (e) {
    var kop = e.target.closest(".cardhead");
    if (!kop) return;
    var open = kop.getAttribute("aria-expanded") === "true";
    kop.setAttribute("aria-expanded", open ? "false" : "true");
    var doel = document.getElementById(kop.getAttribute("aria-controls"));
    if (doel) doel.hidden = open;
    /* Een knop onder de lijst (Add Holiday) hoort bij de sectie, niet bij de
       kaart eromheen, dus die gaat mee. */
    var extra = doel && doel.nextElementSibling;
    if (extra && extra.classList.contains("card__pad")) extra.hidden = open;
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
     touch niets. De greep vangt de pointer, zodat slepen doorgaat ook als je
     buiten de rij komt. */
  document.addEventListener("pointerdown", function (e) {
    var greep = e.target.closest(".prod__handle");
    if (!greep) return;

    var rij = greep.closest(".prod");
    var lijst = rij.parentElement;
    e.preventDefault();
    rij.classList.add("is-dragging");
    greep.setPointerCapture(e.pointerId);

    function verplaats(ev) {
      /* De gesleepte rij staat op pointer-events:none, dus elementFromPoint
         geeft de rij eronder terug in plaats van zichzelf. */
      var onder = document.elementFromPoint(ev.clientX, ev.clientY);
      var doel = onder && onder.closest(".prod");
      if (!doel || doel === rij || doel.parentElement !== lijst) return;
      var vak = doel.getBoundingClientRect();
      var bovenHelft = ev.clientY < vak.top + vak.height / 2;
      lijst.insertBefore(rij, bovenHelft ? doel : doel.nextSibling);
    }

    function stop(ev) {
      rij.classList.remove("is-dragging");
      greep.releasePointerCapture(ev.pointerId);
      greep.removeEventListener("pointermove", verplaats);
      greep.removeEventListener("pointerup", stop);
      greep.removeEventListener("pointercancel", stop);
    }

    greep.addEventListener("pointermove", verplaats);
    greep.addEventListener("pointerup", stop);
    greep.addEventListener("pointercancel", stop);
  });

  /* Tabs zitten op meerdere plekken (producten, billing), dus één gedelegeerde
     afhandeling binnen de eigen .tabs-groep. */
  document.addEventListener("click", function (e) {
    var tab = e.target.closest(".tab");
    if (!tab) return;
    tab.closest(".tabs").querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-active"); });
    tab.classList.add("is-active");

    /* Twee lijsten die niets met elkaar te maken hebben wisselen om in plaats
       van te filteren; de groep zegt met data-tabs-for welke blokken. */
    var groep = tab.closest(".tabs");
    if (groep.dataset.tabsFor) {
      document.querySelectorAll('[data-tabpane="' + groep.dataset.tabsFor + '"]')
        .forEach(function (blok) { blok.hidden = blok.dataset.tab !== tab.dataset.tab; });
      return;
    }

    /* Anders is een tab een filter, geen etiket: de lijst volgt meteen. */
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
    products:       { label: "Add product",   icon: "i-plus", zacht: false },
    choices:        { label: "Add new",       icon: "i-plus", zacht: false },
    categories:     { label: "Add categorie", icon: "i-plus", zacht: false },
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
    pageActionIcon.setAttribute("href", "#" + actie.icon);
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
    /* De knoppen van de pagina erboven horen hier niet meer; een subpagina
       met eigen knoppen zet ze met data-sub-tools. */
    setTools.forEach(function (el) { el.hidden = el.dataset.subTools !== sub; });
    /* Een pagina die om je aandacht vraagt (afrekenen) krijgt de volle breedte:
       de settingsnavigatie ernaast leidt daar alleen maar van af. */
    var vol = document.querySelector('[data-set-sub="' + sub + '"]');
    if (vol && vol.hasAttribute("data-sub-full")) root.dataset.settingsFull = "on";
    else delete root.dataset.settingsFull;

    /* Een subpagina mag een eigen stand naast de titel zetten. */
    setBadge.textContent = (vol && vol.dataset.subBadge) || "";
    setBadge.hidden = !setBadge.textContent;

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
    delete root.dataset.settingsFull;
    setCrumb.hidden = true;
    setIcon.removeAttribute("hidden");
    setTitle.textContent = ouder.titel;
    setLead.hidden = true;
    setBadge.hidden = true;
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
     Eén of meer kaarten per stap; de teller en de balk volgen de actieve stap. */
  var wiz = document.getElementById("pay-wiz");
  /* Buiten het blok gedeclareerd zodat openSetSub het formulier kan
     terugzetten als je de wizard opnieuw binnenkomt. */
  var resetWiz = null;

  if (wiz) {
    var wizStappen = wiz.querySelectorAll("[data-step]");
    var wizNu      = document.getElementById("wiz-now");
    var wizTotaal  = document.getElementById("wiz-total");
    var wizBalk    = document.getElementById("wiz-bar");
    var wizTrack   = wizBalk.parentNode;
    var wizVorige  = document.getElementById("wiz-back");
    var wizVolgende = document.getElementById("wiz-next");
    var stap = 1;

    /* Een stap kan uit meer dan één kaart bestaan, dus tel de stapnummers en
       niet de kaarten: anders klopt "stap 3 van 6" niet meer. */
    var wizLaatste = 1;
    wizStappen.forEach(function (kaart) {
      wizLaatste = Math.max(wizLaatste, Number(kaart.dataset.step));
    });
    wizTotaal.textContent = wizLaatste;
    wizTrack.setAttribute("aria-valuemax", wizLaatste);

    function toonStap(n) {
      stap = Math.min(Math.max(n, 1), wizLaatste);
      wizStappen.forEach(function (kaart) { kaart.hidden = Number(kaart.dataset.step) !== stap; });
      wizNu.textContent = stap;
      wizBalk.style.width = (stap / wizLaatste * 100) + "%";
      wizTrack.setAttribute("aria-valuenow", stap);
      wizVorige.hidden = stap === 1;
      /* Laatste stap rondt af in plaats van door te gaan. */
      wizVolgende.textContent = stap === wizLaatste ? "Submit for verification" : "Next";
      /* Een vakje dat nog openstond hoort dicht als je de stap opnieuw ziet. */
      wiz.querySelectorAll(".rev").forEach(function (vak) { zetRev(vak, false); });
      overlay.scrollTop = 0;
    }

    wizVorige.addEventListener("click", function () { toonStap(stap - 1); });
    wizVolgende.addEventListener("click", function () {
      if (stap < wizLaatste) { toonStap(stap + 1); return; }
      backFromSub();
      /* De aanvraag is de deur uit; de betaalpagina laat vanaf nu zien wat je
         te regelen hebt in plaats van waarom je zou beginnen. */
      zetBetaalStand("on");
      showToast("Details submitted for verification");
    });

    /* Het potlood klapt hetzelfde vakje open als formulier: je wijzigt het
       gegeven waar het staat, in plaats van zes stappen terug te lopen. */
    function zetRev(vak, bewerken) {
      vak.querySelector(".rev__read").hidden = bewerken;
      vak.querySelector(".rev__form").hidden = !bewerken;
    }

    wiz.addEventListener("click", function (e) {
      var pen = e.target.closest(".rev__pen");
      if (pen) { zetRev(pen.closest(".rev"), true); return; }
      var stop = e.target.closest(".rev__cancel");
      if (stop) { zetRev(stop.closest(".rev"), false); return; }
      var bewaar = e.target.closest(".rev__save");
      if (bewaar) { zetRev(bewaar.closest(".rev"), false); showToast("Changes saved"); }
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


  /* Een menu in een tabelrij hangt vast aan het venster, want het paneel
     eromheen knipt alles af wat buiten zijn rand valt. De plek komt dus van
     hier: onder de knop, rechts uitgelijnd, en nooit half buiten beeld. */
  function plaatsRijMenu(knop, menu) {
    var r = knop.getBoundingClientRect();
    /* Uitlijnen op randen in plaats van op een gemeten breedte: die staat nog
       niet vast op het moment dat het menu net zichtbaar wordt. */
    menu.style.right = Math.max(8, window.innerWidth - r.right) + "px";
    menu.style.left = "auto";

    /* Te dicht bij de onderkant: dan klapt het menu omhoog open. */
    if (r.bottom > window.innerHeight - 120) {
      menu.style.top = "auto";
      menu.style.bottom = (window.innerHeight - r.top + 6) + "px";
    } else {
      menu.style.bottom = "auto";
      menu.style.top = (r.bottom + 6) + "px";
    }
  }

  /* Scrollen zou het menu laten zweven op de plek waar de rij stond. */
  document.addEventListener("scroll", function () {
    var open = document.querySelector(".sort__menu--row:not([hidden])");
    if (open) sluitFilterMenus();
  }, true);

  /* ---- Standaardtaal ------------------------------------------------------
     Twee talen liggen vast; welke van de twee de klant als eerste ziet niet.
     De standaard is altijd gepubliceerd, anders wijs je naar een taal die er
     voor de klant niet is. */
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-lang-default]")) return;

    var rij = e.target.closest("tr");
    var lijst = rij.closest("tbody");
    if (rij.hasAttribute("data-default")) { sluitFilterMenus(); return; }

    lijst.querySelectorAll("tr").forEach(function (r) {
      var standaard = r === rij;
      var meta = r.querySelector(".cell__meta");
      var stand = r.querySelector(".badge");

      if (standaard) {
        r.setAttribute("data-default", "");
        meta.textContent = "Default";
        stand.className = "badge badge--active";
        stand.textContent = "Published";
      } else {
        r.removeAttribute("data-default");
        meta.textContent = "Translated by you";
      }
      /* Je eigen standaard omzetten kan niet; die regel wijst nergens heen. */
      var item = r.querySelector("[data-lang-default]");
      if (item) item.disabled = standaard;
    });

    sluitFilterMenus();
    showToast(rij.dataset.lang + " is now the default language");
  });
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

  /* "Lusthofstraat 27A" -> "lusthofstraat". Het huisnummer bepaalt bij ons
     niets, dus dat gaat eraf. */
  function straatNaam(waarde) {
    return waarde.toLowerCase().replace(/\s*\d.*$/, "").trim();
  }

  document.addEventListener("input", function (e) {
    var veld = e.target.closest("[data-lookup]");
    if (!veld) return;

    var post = document.getElementById(veld.dataset.lookupZip);
    var plaats = document.getElementById(veld.dataset.lookupCity);
    var notitie = document.getElementById(veld.dataset.lookupNote);
    var waarde = veld.value.trim();
    /* Zonder huisnummer is het adres nog niet af; dan zoeken we nog niet. */
    var af = /\d/.test(waarde);
    var gevonden = af ? ADRESSEN[straatNaam(waarde)] : null;

    if (gevonden) {
      post.value = gevonden.post;
      plaats.value = gevonden.plaats;
    } else if (!waarde) {
      post.value = "";
      plaats.value = "";
    }

    if (!notitie) return;
    if (gevonden) {
      notitie.textContent = "Postal code and city found.";
      notitie.hidden = false;
    } else if (af) {
      notitie.textContent = "We could not find this address. Fill in the postal code and city yourself.";
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
})();
