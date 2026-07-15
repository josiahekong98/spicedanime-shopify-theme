(() => {
  const shuffle = items => {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  };

  const chooseMixedProducts = (cards, maxProducts) => {
    const selected = [];
    const selectedTypes = new Set();
    const groups = [
      shuffle(cards.filter(card => card.dataset.saPriority === 'true')),
      shuffle(cards.filter(card => card.dataset.saPriority !== 'true'))
    ];

    groups.forEach(group => {
      group.forEach(card => {
        const productType = card.dataset.saProductType || 'unknown';
        if (selected.length >= maxProducts || selectedTypes.has(productType)) return;
        selected.push(card);
        selectedTypes.add(productType);
      });
    });

    groups.flat().forEach(card => {
      if (selected.length >= maxProducts || selected.includes(card)) return;
      selected.push(card);
    });

    return selected;
  };

  const initSeriesRecommendations = root => {
    root.querySelectorAll('[data-sa-recommendations]').forEach(section => {
      if (section.dataset.saInitialized === 'true') return;

      const grid = section.querySelector('.sa-more-series__grid');
      if (!grid) return;

      const cards = Array.from(grid.querySelectorAll('[data-sa-product-card]'));
      const maxProducts = Number(section.dataset.saMaxProducts) || 8;
      const selectedCards = chooseMixedProducts(cards, maxProducts);
      const selectedSet = new Set(selectedCards);

      selectedCards.forEach(card => {
        card.hidden = false;
        grid.append(card);
      });

      cards.forEach(card => {
        if (!selectedSet.has(card)) card.hidden = true;
      });

      section.dataset.saInitialized = 'true';
    });
  };

  document.addEventListener('DOMContentLoaded', () => initSeriesRecommendations(document));
  document.addEventListener('shopify:section:load', event => initSeriesRecommendations(event.target));
})();
