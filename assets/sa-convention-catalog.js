(() => {
  const normalize = (value) => String(value || '').trim().toLocaleLowerCase();

  const initCatalog = (root) => {
    if (!root || root.dataset.saConventionReady === 'true') return;
    root.dataset.saConventionReady = 'true';
    root.classList.add('is-enhanced');

    const typeTriggers = [...root.querySelectorAll('[data-sa-type-trigger]')];
    const panels = [...root.querySelectorAll('[data-sa-catalog-panel]')];
    const filterControls = root.querySelector('[data-sa-filter-controls]');
    const searchInput = root.querySelector('[data-sa-catalog-search]');
    const artFilter = root.querySelector('[data-sa-art-filter]');
    const artTriggers = [...root.querySelectorAll('[data-sa-art-trigger]')];
    const popularGroup = root.querySelector('[data-sa-popular-series]');
    const popularTriggers = [...root.querySelectorAll('[data-sa-popular-series-trigger]')];
    const seriesWrap = root.querySelector('[data-sa-series-wrap]');
    const seriesSelect = root.querySelector('[data-sa-series-select]');
    const resultText = root.querySelector('[data-sa-results]');
    const dialog = root.querySelector('[data-sa-design-dialog]');
    const dialogImage = dialog?.querySelector('[data-sa-dialog-image]');
    const dialogTitle = dialog?.querySelector('[data-sa-dialog-title]');
    const dialogSeries = dialog?.querySelector('[data-sa-dialog-series]');
    const batchSize = Math.max(1, Number.parseInt(root.dataset.initialBatch, 10) || 24);
    const visibleLimits = new Map(panels.map((panel) => [panel.dataset.saCatalogPanel, batchSize]));

    let activeType = 'tapestries';
    let activeArt = 'all';
    let activeSeries = '';
    let lastPreviewTrigger = null;

    filterControls.hidden = false;
    const activePanel = () => panels.find((panel) => panel.dataset.saCatalogPanel === activeType);
    const activeCards = () => [...(activePanel()?.querySelectorAll('[data-sa-catalog-card]') || [])];

    const availableSeries = () => {
      const values = new Map();
      activeCards().forEach((card) => {
        if (card.dataset.artCategory !== 'anime') return;
        const series = card.dataset.series.trim();
        if (series) values.set(normalize(series), series);
      });
      return [...values.values()].sort((first, second) => first.localeCompare(second));
    };

    const updateSeriesControls = () => {
      const seriesValues = availableSeries();
      const normalizedValues = new Set(seriesValues.map(normalize));

      if (activeSeries && !normalizedValues.has(normalize(activeSeries))) activeSeries = '';

      seriesSelect.replaceChildren(new Option('All series', ''));
      seriesValues.forEach((series) => seriesSelect.add(new Option(series, series)));
      seriesSelect.value = activeSeries;

      popularTriggers.forEach((trigger) => {
        const exists = normalizedValues.has(normalize(trigger.dataset.seriesValue));
        trigger.hidden = !exists;
        const selected = exists && normalize(activeSeries) === normalize(trigger.dataset.seriesValue);
        trigger.classList.toggle('is-active', selected);
        trigger.setAttribute('aria-pressed', String(selected));
      });

      const hasSeries = seriesValues.length > 0;
      seriesWrap.hidden = !hasSeries;
      popularGroup.hidden = !popularTriggers.some((trigger) => !trigger.hidden);
    };

    const cardMatches = (card) => {
      const query = normalize(searchInput.value);
      const searchValue = normalize([
        card.dataset.productTitle,
        card.dataset.series,
        card.dataset.shopifyProductType,
        card.dataset.categoryLabel,
      ].join(' '));
      const artMatches = activeType === 'hoodies' || activeArt === 'all' || card.dataset.artCategory === activeArt;
      const seriesMatches = !activeSeries || normalize(card.dataset.series) === normalize(activeSeries);
      const searchMatches = !query || searchValue.includes(query);
      return artMatches && seriesMatches && searchMatches;
    };

    const applyFilters = () => {
      const panel = activePanel();
      if (!panel) return;

      const cards = activeCards();
      const matchingCards = cards.filter(cardMatches);
      const visibleLimit = visibleLimits.get(activeType) || batchSize;

      cards.forEach((card) => {
        card.hidden = true;
      });
      matchingCards.slice(0, visibleLimit).forEach((card) => {
        card.hidden = false;
      });

      const showMore = panel.querySelector('[data-sa-show-more]');
      const emptyMessage = panel.querySelector('[data-sa-empty-filter]');
      showMore.hidden = matchingCards.length <= visibleLimit;
      emptyMessage.hidden = matchingCards.length !== 0 || cards.length === 0;
      resultText.textContent = `Showing ${Math.min(matchingCards.length, visibleLimit)} of ${matchingCards.length} matching designs.`;
    };

    const setArt = (value) => {
      activeArt = value;
      if (value === 'black-art') activeSeries = '';
      artTriggers.forEach((trigger) => {
        const selected = trigger.dataset.saArtTrigger === value;
        trigger.classList.toggle('is-active', selected);
        trigger.setAttribute('aria-pressed', String(selected));
      });
      updateSeriesControls();
      if (value === 'black-art') {
        seriesWrap.hidden = true;
        popularGroup.hidden = true;
      }
      visibleLimits.set(activeType, batchSize);
      applyFilters();
    };

    const setType = (value, focusPanel = false) => {
      activeType = value;
      activeArt = 'all';
      activeSeries = '';
      searchInput.value = '';

      typeTriggers.forEach((trigger) => {
        const selected = trigger.dataset.saTypeTrigger === value;
        trigger.classList.toggle('is-active', selected);
        if (selected) trigger.setAttribute('aria-current', 'true');
        else trigger.removeAttribute('aria-current');
      });

      panels.forEach((panel) => {
        panel.hidden = panel.dataset.saCatalogPanel !== value;
      });

      const isHoodies = value === 'hoodies';
      artFilter.hidden = isHoodies;
      updateSeriesControls();
      setArt('all');

      if (focusPanel) activePanel()?.scrollIntoView({ block: 'start' });
    };

    typeTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (event) => {
        event.preventDefault();
        setType(trigger.dataset.saTypeTrigger, true);
      });
    });

    artTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => setArt(trigger.dataset.saArtTrigger));
    });

    popularTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const value = trigger.dataset.seriesValue;
        activeSeries = normalize(activeSeries) === normalize(value) ? '' : value;
        seriesSelect.value = activeSeries;
        updateSeriesControls();
        visibleLimits.set(activeType, batchSize);
        applyFilters();
      });
    });

    seriesSelect.addEventListener('change', () => {
      activeSeries = seriesSelect.value;
      updateSeriesControls();
      visibleLimits.set(activeType, batchSize);
      applyFilters();
    });

    searchInput.addEventListener('input', () => {
      visibleLimits.set(activeType, batchSize);
      applyFilters();
    });

    panels.forEach((panel) => {
      panel.querySelector('[data-sa-show-more]')?.addEventListener('click', () => {
        const type = panel.dataset.saCatalogPanel;
        visibleLimits.set(type, (visibleLimits.get(type) || batchSize) + batchSize);
        applyFilters();
      });
    });

    root.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-sa-preview-trigger]');
      if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;

      const card = trigger.closest('[data-sa-catalog-card]');
      lastPreviewTrigger = trigger;
      dialogImage.src = trigger.dataset.previewSrc;
      dialogImage.srcset = trigger.dataset.previewSrcset;
      dialogImage.sizes = '(max-width: 780px) calc(100vw - 52px), 720px';
      dialogImage.alt = trigger.dataset.previewAlt || card.dataset.productTitle;
      dialogTitle.textContent = card.dataset.productTitle;

      const series = card.dataset.series || (card.dataset.artCategory === 'black-art' ? 'Black Art' : '');
      dialogSeries.textContent = series;
      dialogSeries.hidden = !series;
      dialog.showModal();
    });

    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog?.addEventListener('close', () => {
      dialogImage.removeAttribute('src');
      dialogImage.removeAttribute('srcset');
      lastPreviewTrigger?.focus();
    });

    setType('tapestries');
  };

  const initAll = (scope = document) => {
    scope.querySelectorAll('[data-sa-convention-catalog]').forEach(initCatalog);
  };

  document.addEventListener('shopify:section:load', (event) => initAll(event.target));
  initAll();
})();
