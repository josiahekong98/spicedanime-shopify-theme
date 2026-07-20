(() => {
  const namespace = "SAAnimeCollectionsDirectory";
  const rootSelector = "[data-anime-directory]";

  const initialize = root => {
    if (!root || root.dataset.animeDirectoryInitialized === "true") return;

    const search = root.querySelector("[data-anime-search]");
    const cards = Array.from(root.querySelectorAll("[data-anime-card]"));
    const filterButtons = Array.from(root.querySelectorAll("[data-anime-filter]"));
    const quickFilterButtons = Array.from(root.querySelectorAll("[data-anime-quick-filter]"));
    const reset = root.querySelector("[data-anime-reset]");
    const empty = root.querySelector("[data-anime-empty]");
    const count = root.querySelector("[data-anime-count]");

    if (!search || !reset || !empty) return;

    const availableLetters = new Set(cards.map(card => card.dataset.letter));
    const state = {
      query: search.value.trim().toLowerCase(),
      letter: "",
      quickSeries: ""
    };

    const updateFilterButtons = () => {
      filterButtons.forEach(button => {
        const letter = button.dataset.letter;
        const available = availableLetters.has(letter);
        const active = available && state.letter === letter;

        button.disabled = !available;
        button.setAttribute("aria-disabled", String(!available));
        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("active", active);
      });
    };

    const updateQuickFilterButtons = () => {
      quickFilterButtons.forEach(button => {
        const active = state.quickSeries === button.dataset.seriesName;

        button.setAttribute("aria-pressed", String(active));
        button.classList.toggle("active", active);
      });
    };

    const applyFilters = () => {
      let visibleCount = 0;

      cards.forEach(card => {
        const matchesSearch = !state.query || card.dataset.name.includes(state.query);
        const matchesLetter = !state.letter || card.dataset.letter === state.letter;
        const matchesQuickSeries = !state.quickSeries || card.dataset.name === state.quickSeries;
        const visible = matchesSearch && matchesLetter && matchesQuickSeries;

        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      updateFilterButtons();
      updateQuickFilterButtons();

      const hasNoResults = visibleCount === 0;
      empty.hidden = !hasNoResults;
      empty.setAttribute("aria-hidden", String(!hasNoResults));

      if (count) {
        count.textContent = `${visibleCount} ${visibleCount === 1 ? "collection" : "collections"} shown`;
      }
    };

    search.addEventListener("input", () => {
      state.query = search.value.trim().toLowerCase();
      state.quickSeries = "";
      applyFilters();
    });

    filterButtons.forEach(button => {
      button.addEventListener("click", () => {
        if (button.disabled) return;

        const selectedLetter = button.dataset.letter;
        state.quickSeries = "";
        state.letter = state.letter === selectedLetter ? "" : selectedLetter;
        applyFilters();
      });
    });

    quickFilterButtons.forEach(button => {
      button.addEventListener("click", () => {
        const selectedSeries = button.dataset.seriesName;
        const isActive = state.quickSeries === selectedSeries;

        state.quickSeries = isActive ? "" : selectedSeries;
        if (!isActive) state.letter = "";
        applyFilters();
      });
    });

    reset.addEventListener("click", () => {
      state.query = "";
      state.letter = "";
      state.quickSeries = "";
      search.value = "";
      applyFilters();
    });

    root.dataset.animeDirectoryInitialized = "true";
    applyFilters();
  };

  const initializeAll = (scope = document) => {
    if (scope instanceof Element && scope.matches(rootSelector)) {
      initialize(scope);
    }

    scope.querySelectorAll?.(rootSelector).forEach(initialize);
  };

  if (window[namespace]) {
    window[namespace].initializeAll(document);
    return;
  }

  window[namespace] = { initializeAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initializeAll(document), { once: true });
  } else {
    initializeAll(document);
  }

  document.addEventListener("shopify:section:load", event => {
    initializeAll(event.target);
  });
})();
