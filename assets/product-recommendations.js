if (!customElements.get('product-recommendations')) {
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
      return Boolean(fallback?.querySelector('[data-recommendations]')?.children.length);
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
