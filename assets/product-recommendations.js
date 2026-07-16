if (!customElements.get('product-recommendations')) {
  class ProductRecommendations extends HTMLElement {
    constructor() {
      super();
      this.slider = null;
    }

    connectedCallback() {
      this.performRecommendations();
    }

    performRecommendations() {
      const recommendations = this.querySelector('[data-recommendations]');
      if (!recommendations || !this.dataset.url) {
        this.showFallback();
        return;
      }

      fetch(this.dataset.url)
        .then(response => response.text())
        .then(text => {
          const recommendationsHTML = new DOMParser()
            .parseFromString(text, 'text/html')
            .querySelector('[data-recommendations]')?.innerHTML?.trim();

          if (!recommendationsHTML) {
            this.hideRecommendations();
            this.showFallback();
            return;
          }

          recommendations.innerHTML = recommendationsHTML;
          this.hideFallback();
          this.classList.remove('hidden');
          this.removeAttribute('hidden');
          this.setDrawerItemsFull(false);
          this.initSlider(this);
          this.initQuickCart(this);
        })
        .catch(() => {
          this.hideRecommendations();
          this.showFallback();
        });
    }

    getFallback() {
      return this.parentElement?.querySelector('[data-sa-cart-series-transfer-fallback]');
    }

    hasFallbackItems(fallback) {
      return Boolean(fallback?.querySelector('[data-recommendations]')?.children.length);
    }

    showFallback() {
      const fallback = this.getFallback();

      if (!this.hasFallbackItems(fallback)) {
        this.setDrawerItemsFull(true);
        return;
      }

      fallback.classList.remove('hidden');
      fallback.removeAttribute('hidden');
      this.setDrawerItemsFull(false);
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

    setDrawerItemsFull(isFull) {
      const cartDrawerItems = document.querySelector('.cart-drawer-items');
      if (!cartDrawerItems) return;

      cartDrawerItems.classList.toggle('cart-drawer-items__full', isFull);
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
      }
    }

    initQuickCart(scope = this) {
      setTimeout(() => {
        const drawer = document.querySelector('quick-cart-drawer');

        if (drawer) {
          drawer.init();
          return;
        }

        scope.querySelectorAll('.quick-cart-drawer__trigger').forEach(el => {
          el?.remove();
        });
      }, 500);
    }
  }

  customElements.define('product-recommendations', ProductRecommendations);
}
