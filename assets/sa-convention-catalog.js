(() => {
  const normalize = (value) => String(value || '').trim().toLocaleLowerCase();

  const initCatalog = (root) => {
    if (!root || root.dataset.saConventionReady === 'true') return;
    root.dataset.saConventionReady = 'true';
    root.classList.add('is-enhanced');

    const typeTriggers = [...root.querySelectorAll('[data-sa-type-trigger]')];
    const typeNavigation = root.querySelector('.sa-convention__type-nav');
    const panels = [...root.querySelectorAll('[data-sa-catalog-panel]')];
    const filterControls = root.querySelector('[data-sa-filter-controls]');
    const searchInput = root.querySelector('[data-sa-catalog-search]');
    const artFilter = root.querySelector('[data-sa-art-filter]');
    const artTriggers = [...root.querySelectorAll('[data-sa-art-trigger]')];
    const seriesWrap = root.querySelector('[data-sa-series-wrap]');
    const seriesSelect = root.querySelector('[data-sa-series-select]');
    const resultText = root.querySelector('[data-sa-results]');
    const priceTrigger = root.querySelector('[data-sa-price-trigger]');
    const priceDialog = root.querySelector('[data-sa-price-dialog]');
    const dialog = root.querySelector('[data-sa-design-dialog]');
    const dialogTrack = dialog?.querySelector('[data-sa-dialog-track]');
    const dialogPrevious = dialog?.querySelector('[data-sa-dialog-previous]');
    const dialogNext = dialog?.querySelector('[data-sa-dialog-next]');
    const dialogCounter = dialog?.querySelector('[data-sa-dialog-counter]');
    const dialogTitle = dialog?.querySelector('[data-sa-dialog-title]');
    const dialogSeries = dialog?.querySelector('[data-sa-dialog-series]');
    const batchSize = Math.max(1, Number.parseInt(root.dataset.initialBatch, 10) || 24);
    const visibleLimits = new Map(panels.map((panel) => [panel.dataset.saCatalogPanel, batchSize]));

    let activeType = 'tapestries';
    let activeArt = 'all';
    let activeSeries = '';
    let lastPreviewTrigger = null;
    let lastPriceTrigger = null;
    let galleryIndex = 0;
    let gallerySize = 0;

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

      const hasSeries = seriesValues.length > 0;
      seriesWrap.hidden = !hasSeries;
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

      const filterMount = activePanel()?.querySelector('[data-sa-filter-mount]');
      const typeNavigationMount = activePanel()?.querySelector('[data-sa-type-nav-mount]');
      if (typeNavigationMount) typeNavigationMount.append(typeNavigation);
      if (filterMount) filterMount.append(filterControls);

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

    const updateGalleryControls = () => {
      const hasMultipleImages = gallerySize > 1;
      dialogPrevious.hidden = !hasMultipleImages;
      dialogNext.hidden = !hasMultipleImages;
      dialogCounter.hidden = !hasMultipleImages;
      dialogPrevious.disabled = galleryIndex === 0;
      dialogNext.disabled = galleryIndex === gallerySize - 1;
      dialogCounter.textContent = hasMultipleImages ? `Image ${galleryIndex + 1} of ${gallerySize}` : '';
    };

    const showGalleryImage = (nextIndex) => {
      galleryIndex = Math.min(Math.max(nextIndex, 0), gallerySize - 1);
      dialogTrack.scrollTo({
        left: dialogTrack.clientWidth * galleryIndex,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
      updateGalleryControls();
    };

    dialogPrevious?.addEventListener('click', () => showGalleryImage(galleryIndex - 1));
    dialogNext?.addEventListener('click', () => showGalleryImage(galleryIndex + 1));

    let galleryScrollFrame = null;
    dialogTrack?.addEventListener('scroll', () => {
      if (galleryScrollFrame) window.cancelAnimationFrame(galleryScrollFrame);
      galleryScrollFrame = window.requestAnimationFrame(() => {
        if (!dialogTrack.clientWidth) return;
        galleryIndex = Math.round(dialogTrack.scrollLeft / dialogTrack.clientWidth);
        updateGalleryControls();
      });
    });

    priceTrigger?.addEventListener('click', () => {
      if (!priceDialog || typeof priceDialog.showModal !== 'function') return;
      lastPriceTrigger = priceTrigger;
      priceDialog.showModal();
    });

    priceDialog?.addEventListener('click', (event) => {
      if (event.target === priceDialog) priceDialog.close();
    });

    priceDialog?.addEventListener('close', () => {
      lastPriceTrigger?.focus();
    });

    root.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-sa-preview-trigger]');
      if (!trigger || !dialog || typeof dialog.showModal !== 'function') return;

      const card = trigger.closest('[data-sa-catalog-card]');
      const mediaTemplate = card.querySelector('[data-sa-preview-media]');
      const mediaItems = mediaTemplate ? [...mediaTemplate.content.querySelectorAll('[data-preview-src]')] : [];
      if (mediaItems.length === 0) return;

      lastPreviewTrigger = trigger;
      galleryIndex = 0;
      gallerySize = mediaItems.length;
      dialogTrack.replaceChildren(...mediaItems.map((mediaItem, index) => {
        const image = document.createElement('img');
        image.src = mediaItem.dataset.previewSrc;
        image.srcset = mediaItem.dataset.previewSrcset;
        image.sizes = '(max-width: 780px) calc(100vw - 52px), 720px';
        image.alt = mediaItem.dataset.previewAlt || card.dataset.productTitle;
        image.width = 1200;
        image.height = 1200;
        image.loading = index === 0 ? 'eager' : 'lazy';
        image.decoding = 'async';
        return image;
      }));
      dialogTitle.textContent = card.dataset.productTitle;

      const series = card.dataset.series || (card.dataset.artCategory === 'black-art' ? 'Black Art' : '');
      dialogSeries.textContent = series;
      dialogSeries.hidden = !series;
      updateGalleryControls();
      dialog.showModal();
    });

    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog?.addEventListener('close', () => {
      dialogTrack.replaceChildren();
      galleryIndex = 0;
      gallerySize = 0;
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
