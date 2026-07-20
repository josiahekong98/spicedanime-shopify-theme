if (!customElements.get('product-recommendations')) {
  const automaticSelectionCache = new WeakMap();

  class ProductRecommendations extends HTMLElement {
    constructor() {
      super();
      this.slider = null;
      this.fallbackSlider = null;
      this.requestController = null;
      this.requestSequence = 0;
    }

    connectedCallback() {
      this.updateDrawerRecommendationState();
      this.performRecommendations();
    }

    disconnectedCallback() {
      this.requestSequence += 1;
      this.requestController?.abort();
      this.requestController = null;

      if (this.slider?.destroy) {
        this.slider.destroy(true, true);
      }
      if (this.fallbackSlider?.destroy) {
        this.fallbackSlider.destroy(true, true);
      }
      this.slider = null;
      this.fallbackSlider = null;
    }

    performRecommendations() {
      this.requestController?.abort();
      this.requestController = new AbortController();
      const requestController = this.requestController;
      const requestSequence = ++this.requestSequence;
      const recommendations = this.querySelector('[data-recommendations]');

      if (!recommendations || !this.dataset.url) {
        if (this.isCurrentRequest(requestSequence, requestController)) {
          this.showFallback();
          this.notifyModuleUpdate();
        }
        return;
      }

      fetch(this.dataset.url, { signal: requestController.signal })
        .then(response => {
          if (!response.ok) throw new Error(`Recommendation request failed: ${response.status}`);
          return response.text();
        })
        .then(text => {
          if (!this.isCurrentRequest(requestSequence, requestController)) return;

          const recommendationsHTML = new DOMParser()
            .parseFromString(text, 'text/html')
            .querySelector('[data-recommendations]')?.innerHTML?.trim();

          if (!recommendationsHTML) {
            this.hideRecommendations();
            this.showFallback();
            this.notifyModuleUpdate();
            return;
          }

          recommendations.innerHTML = recommendationsHTML;
          this.materializeAutomaticCandidates(this);

          if (!this.hasRecommendationItems(this)) {
            this.hideRecommendations();
            this.showFallback();
            this.notifyModuleUpdate();
            return;
          }

          this.hideFallback();
          this.classList.remove('hidden');
          this.removeAttribute('hidden');
          this.updateDrawerRecommendationState();
          this.initSlider(this);
          this.initQuickCart(this);
          this.notifyModuleUpdate();
        })
        .catch(error => {
          if (error.name === 'AbortError' || !this.isCurrentRequest(requestSequence, requestController)) return;

          this.hideRecommendations();
          this.showFallback();
          this.notifyModuleUpdate();
        });
    }

    isCurrentRequest(requestSequence, requestController) {
      return this.isConnected
        && this.requestSequence === requestSequence
        && this.requestController === requestController
        && !requestController.signal.aborted;
    }

    getFallback() {
      const cartDrawer = this.closest('cart-drawer');
      return cartDrawer?.querySelector('[data-sa-cart-series-transfer-fallback]') || null;
    }

    hasFallbackItems(fallback) {
      if (!fallback) return false;

      this.materializeAutomaticCandidates(fallback);
      return this.hasRecommendationItems(fallback);
    }

    hasRecommendationItems(scope) {
      return Boolean(scope?.querySelector('.product-recommendations__item'));
    }

    shuffle(items) {
      const shuffled = [...items];

      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
      }

      return shuffled;
    }

    materializeAutomaticCandidates(scope) {
      const context = scope?.querySelector('template[data-sa-cart-automatic-context]');
      if (!context || !this.isConnected || !scope.isConnected) return;

      const track = context.parentElement;
      const candidateTemplates = [...track.querySelectorAll('template[data-sa-cart-automatic-candidate]')];
      const maxCards = Number.parseInt(context.dataset.maxCards, 10) || 4;
      const renderedCards = [...track.children].filter(element => element.matches('.product-recommendations__item'));
      const availableSlots = Math.max(0, maxCards - renderedCards.length);
      const candidateSignature = [
        maxCards,
        renderedCards.length,
        ...candidateTemplates.map(candidate => [
          candidate.dataset.source,
          candidate.dataset.slotIndex,
          candidate.dataset.productId,
        ].join(':')),
      ].join('|');
      const cacheKey = [
        context.dataset.anchorProductId || '',
        context.dataset.cartProductSignature || '',
        candidateSignature,
      ].join('::');
      const cartDrawer = this.closest('cart-drawer');
      let drawerCache = cartDrawer ? automaticSelectionCache.get(cartDrawer) : null;

      if (cartDrawer && !drawerCache) {
        drawerCache = new Map();
        automaticSelectionCache.set(cartDrawer, drawerCache);
      }

      let selectedCandidates = drawerCache?.get(cacheKey) || null;
      const candidatesByIdentity = new Map(candidateTemplates.map(candidate => [
        this.getCandidateIdentity(candidate),
        candidate,
      ]));

      if (!selectedCandidates || selectedCandidates.some(identity => !candidatesByIdentity.has(identity))) {
        selectedCandidates = this.selectAutomaticCandidates(candidateTemplates, availableSlots)
          .map(candidate => this.getCandidateIdentity(candidate));

        if (drawerCache) {
          drawerCache.set(cacheKey, selectedCandidates);
          if (drawerCache.size > 24) {
            drawerCache.delete(drawerCache.keys().next().value);
          }
        }
      }

      selectedCandidates
        .slice(0, availableSlots)
        .forEach(identity => this.insertAutomaticCandidate(track, candidatesByIdentity.get(identity)));

      candidateTemplates.forEach(candidate => candidate.remove());
      context.remove();
    }

    getCandidateIdentity(candidate) {
      return [
        candidate.dataset.source || '',
        candidate.dataset.slotIndex || '',
        candidate.dataset.productId || '',
      ].join(':');
    }

    selectAutomaticCandidates(candidateTemplates, availableSlots) {
      const selected = [];
      const selectedProductIds = new Set();
      const familyPools = new Map();
      const merchantCandidates = [];

      candidateTemplates.forEach(candidate => {
        if (candidate.dataset.source === 'family') {
          const slotIndex = candidate.dataset.slotIndex || '';
          if (!familyPools.has(slotIndex)) familyPools.set(slotIndex, []);
          familyPools.get(slotIndex).push(candidate);
        } else if (candidate.dataset.source === 'merchant') {
          merchantCandidates.push(candidate);
        }
      });

      for (const candidates of familyPools.values()) {
        if (selected.length >= availableSlots) break;

        const candidate = this.shuffle(candidates)
          .find(item => !selectedProductIds.has(item.dataset.productId));
        if (!candidate) continue;

        selected.push(candidate);
        selectedProductIds.add(candidate.dataset.productId);
      }

      for (const candidate of this.shuffle(merchantCandidates)) {
        if (selected.length >= availableSlots) break;
        if (selectedProductIds.has(candidate.dataset.productId)) continue;

        selected.push(candidate);
        selectedProductIds.add(candidate.dataset.productId);
      }

      return selected;
    }

    insertAutomaticCandidate(track, candidate) {
      if (!candidate) return;

      const card = candidate.content
        .cloneNode(true)
        .querySelector('.product-recommendations__item');
      if (!card) return;

      card.dataset.saCartAutomaticSource = candidate.dataset.source || '';
      card.dataset.saCartAutomaticProductId = candidate.dataset.productId || '';
      track.append(card);
    }

    showFallback() {
      const fallback = this.getFallback();

      if (!this.hasFallbackItems(fallback)) {
        this.updateDrawerRecommendationState();
        return;
      }

      fallback.classList.remove('hidden');
      fallback.removeAttribute('hidden');
      this.updateDrawerRecommendationState();
      this.initSlider(fallback);
      this.initQuickCart(fallback);
    }

    hideFallback() {
      const fallback = this.getFallback();
      if (!fallback) return;

      fallback.classList.add('hidden');
      fallback.setAttribute('hidden', '');
    }

    hideRecommendations() {
      this.classList.add('hidden');
      this.setAttribute('hidden', '');
    }

    notifyModuleUpdate() {
      if (!this.isConnected) return;

      this.dispatchEvent(new CustomEvent('sa:cart:recommendations:updated', {
        bubbles: true,
      }));
    }

    hasVisibleRecommendationCards(host) {
      return Boolean(
        host
        && host.isConnected
        && !host.hidden
        && !host.classList.contains('hidden')
        && host.querySelector('.product-recommendations__item')
      );
    }

    updateDrawerRecommendationState() {
      const cartDrawer = this.closest('cart-drawer');
      const cartDrawerBody = this.closest('[data-cart-body]');
      if (!cartDrawer || !cartDrawerBody || !this.isConnected) return;

      const fallback = this.getFallback();
      const hasVisibleRecommendations = this.hasVisibleRecommendationCards(this)
        || this.hasVisibleRecommendationCards(fallback);

      if (hasVisibleRecommendations) {
        cartDrawerBody.removeAttribute('data-sa-recommendations-empty');
      } else {
        cartDrawerBody.setAttribute('data-sa-recommendations-empty', 'true');
      }
    }

    initSlider(scope = this) {
      const sliderElement = scope.querySelector('.swiper');
      if (!sliderElement || typeof Swiper === 'undefined' || sliderElement.swiper) return;

      const instance = new Swiper(sliderElement, {
        slidesPerView: 'auto',
        spaceBetween: 16,
      });

      if (scope === this) {
        this.slider = instance;
      } else {
        this.fallbackSlider = instance;
      }
    }

    initQuickCart(scope = this) {
      if (!this.isConnected) return;

      const drawer = document.querySelector('quick-cart-drawer');

      if (drawer) {
        drawer.init();
        return;
      }

      scope.querySelectorAll('.quick-cart-drawer__trigger').forEach(el => {
        el?.remove();
      });
    }
  }

  customElements.define('product-recommendations', ProductRecommendations);
}
