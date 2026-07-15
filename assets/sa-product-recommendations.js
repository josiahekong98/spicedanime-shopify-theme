(() => {
  const shuffle = items => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  };

  const hasAny = (value, needles) => needles.some(needle => value.includes(needle));

  const isTapestry = value => hasAny(value, ['tapestry', 'tapestries']);
  const isTote = value => hasAny(value, ['tote-bag', 'tote-bags', 'tote']);
  const isPillow = value => hasAny(value, ['pillow-cover', 'pillow-covers', 'pillow']);
  const isHoodie = value => hasAny(value, ['hoodie', 'hoodies']);

  const chooseMixedProducts = (cards, maxProducts, currentProductType) => {
    const selected = [];
    const selectedCards = new Set();

    const take = (predicate, limit = maxProducts) => {
      const group = shuffle(cards.filter(card => {
        if (selectedCards.has(card)) return false;
        return predicate(card.dataset.saProductType || '');
      }));

      group.forEach(card => {
        if (selected.length >= maxProducts || selected.filter(selectedCard => predicate(selectedCard.dataset.saProductType || '')).length >= limit) return;
        selected.push(card);
        selectedCards.add(card);
      });
    };

    const takeRemainder = () => {
      const remaining = shuffle(cards.filter(card => !selectedCards.has(card)));
      const usedTypes = new Set(selected.map(card => card.dataset.saProductType || 'unknown'));

      remaining.forEach(card => {
        const productType = card.dataset.saProductType || 'unknown';
        if (selected.length >= maxProducts || usedTypes.has(productType)) return;
        selected.push(card);
        selectedCards.add(card);
        usedTypes.add(productType);
      });

      remaining.forEach(card => {
        if (selected.length >= maxProducts || selectedCards.has(card)) return;
        selected.push(card);
        selectedCards.add(card);
      });
    };

    if (isTapestry(currentProductType)) {
      take(isTapestry, 3);
      take(isTote, 1);
      take(isPillow, 1);
    } else if (isTote(currentProductType)) {
      take(isTote, 2);
      take(isTapestry, 2);
      take(isPillow, 1);
    } else if (isHoodie(currentProductType)) {
      take(isTapestry, 1);
      take(isTote, 1);
      take(isPillow, 1);
    } else if (isPillow(currentProductType)) {
      take(isPillow, 2);
      take(isTapestry, 2);
      take(isTote, 1);
    } else {
      take(productType => productType === currentProductType, 1);
    }

    takeRemainder();

    return selected;
  };

  const toggleEmptyState = section => {
    const emptyState = section.querySelector('.sa-more-series__empty');
    const visibleCards = section.querySelectorAll('[data-sa-product-card]:not([hidden])');

    if (!emptyState || visibleCards.length > 0) return;

    emptyState.hidden = false;
  };

  const hideInitialRequestState = section => {
    const emptyState = section.querySelector('.sa-more-series__empty');
    const cards = section.querySelectorAll('[data-sa-product-card]');

    if (!emptyState || cards.length === 0) return;

    emptyState.hidden = true;
  };

  const initSection = section => {
    const grid = section.querySelector('.sa-more-series__grid');
    if (!grid) {
      toggleEmptyState(section);
      return;
    }

    const cards = Array.from(grid.querySelectorAll('[data-sa-product-card]'));
    if (cards.length === 0) {
      toggleEmptyState(section);
      return;
    }

    const maxProducts = Number(section.dataset.saMaxProducts) || 8;
    const currentProductType = section.dataset.saCurrentProductType || '';
    const selectedCards = chooseMixedProducts(cards, maxProducts, currentProductType);
    const selectedSet = new Set(selectedCards);

    selectedCards.forEach(card => {
      card.hidden = false;
      grid.append(card);
    });

    cards.forEach(card => {
      if (!selectedSet.has(card)) card.hidden = true;
    });

    hideInitialRequestState(section);
    section.dataset.saInitialized = 'true';
  };

  const initSeriesRecommendations = root => {
    root.querySelectorAll('[data-sa-recommendations]').forEach(section => {
      if (section.dataset.saInitialized === 'true') return;
      initSection(section);
    });
  };

  document.addEventListener('DOMContentLoaded', () => initSeriesRecommendations(document));
  document.addEventListener('shopify:section:load', event => initSeriesRecommendations(event.target));
})();
