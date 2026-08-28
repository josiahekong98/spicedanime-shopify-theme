(() => {
  const namespace = window.SpicedAnimeCollectionArchive || {};
  if (namespace.initialized) return;

  namespace.initialized = true;
  namespace.searchValues = namespace.searchValues || new Map();
  namespace.randomOrders = namespace.randomOrders || new Map();
  window.SpicedAnimeCollectionArchive = namespace;

  const normalize = (value) => String(value || '').trim().toLocaleLowerCase();

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
    }
    return shuffled;
  };

  const prepareRandomSeries = (controls) => {
    const row = controls.querySelector('[data-sa-random-series]');
    if (!row || row.dataset.saRandomReady === 'true') return;

    const sectionId = controls.dataset.sectionId;
    const links = [...row.querySelectorAll('[data-sa-filter-shortcut]')];
    const limit = Math.max(1, Number.parseInt(row.dataset.limit, 10) || links.length);
    let order = namespace.randomOrders.get(sectionId);

    if (!order) {
      order = shuffle(links.map((link) => link.dataset.filterValue));
      namespace.randomOrders.set(sectionId, order);
    }

    links.sort((first, second) => {
      return order.indexOf(first.dataset.filterValue) - order.indexOf(second.dataset.filterValue);
    });

    const activeLink = links.find((link) => link.dataset.active === 'true');
    const visibleLinks = links.slice(0, limit);
    if (activeLink && !visibleLinks.includes(activeLink)) {
      visibleLinks[visibleLinks.length - 1] = activeLink;
    }

    links.forEach((link) => {
      link.hidden = !visibleLinks.includes(link);
      row.append(link);
    });
    row.dataset.saRandomReady = 'true';
  };

  const filterCurrentPage = (controls) => {
    const input = controls.querySelector('[data-sa-collection-search]');
    if (!input) return;

    const sectionId = controls.dataset.sectionId;
    const query = normalize(input.value);
    namespace.searchValues.set(sectionId, input.value);

    const grid = document.getElementById('product-grid');
    if (!grid) return;

    const cards = [...grid.querySelectorAll('[data-sa-collection-card]')];
    let visibleCount = 0;

    cards.forEach((card) => {
      const matches = query === '' || normalize(card.dataset.saSearch).includes(query);
      card.hidden = !matches;
      if (matches) visibleCount += 1;
    });

    let emptyMessage = grid.querySelector('[data-sa-empty-search]');
    if (query && visibleCount === 0) {
      if (!emptyMessage) {
        emptyMessage = document.createElement('p');
        emptyMessage.className = 'sa-collection-archive__empty-search';
        emptyMessage.dataset.saEmptySearch = '';
        emptyMessage.textContent = 'No products on this page match your search.';
        grid.append(emptyMessage);
      }
      emptyMessage.hidden = false;
    } else if (emptyMessage) {
      emptyMessage.hidden = true;
    }

  };

  const prepareControls = (controls) => {
    if (controls.dataset.saReady === 'true') return;
    controls.dataset.saReady = 'true';

    prepareRandomSeries(controls);

    const input = controls.querySelector('[data-sa-collection-search]');
    if (input) {
      const savedValue = namespace.searchValues.get(controls.dataset.sectionId);
      if (savedValue) input.value = savedValue;
      input.addEventListener('input', () => filterCurrentPage(controls));
    }

    filterCurrentPage(controls);
  };

  const prepareAll = () => {
    document.querySelectorAll('[data-sa-collection-controls]').forEach(prepareControls);
  };

  document.addEventListener('click', (event) => {
    const shortcut = event.target.closest('[data-sa-filter-shortcut], [data-sa-instant-filter]');
    if (!shortcut) return;

    event.preventDefault();
    const facetForm = document.querySelector('facet-filters-form');
    if (!facetForm || typeof facetForm.onActiveFilterClick !== 'function') {
      window.location.assign(shortcut.href);
      return;
    }

    shortcut.setAttribute('aria-busy', 'true');
    facetForm.onActiveFilterClick({
      preventDefault() {},
      currentTarget: shortcut,
    });
  });

  const gridContainer = document.getElementById('ProductGridContainer');
  if (gridContainer) {
    const observer = new MutationObserver(() => window.requestAnimationFrame(prepareAll));
    observer.observe(gridContainer, { childList: true, subtree: true });
  }

  document.addEventListener('shopify:section:load', prepareAll);
  prepareAll();
})();
