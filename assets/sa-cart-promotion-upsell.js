(() => {
  if (window.saCartPromotionUpsell) {
    window.saCartPromotionUpsell.initialize(document);
    return;
  }

  const ROOT_SELECTOR = '[data-sa-cart-promotion]';
  const CANDIDATE_SELECTOR = 'template[data-sa-promotion-candidate]';

  const GROUPS = {
    'flip-lighter-tin': {
      label: 'flip lighter tins',
      finalThreshold: 4,
      firstThreshold: 2,
      viewMoreUrl: '/collections/all-products-lighters',
      viewMoreLabel: 'View more flip lighters',
      tierType: 'two-tier',
    },
    'stash-jar': {
      label: 'stash jars',
      finalThreshold: 4,
      firstThreshold: 2,
      viewMoreUrl: '/collections/all-products-stash-jars',
      viewMoreLabel: 'View more stash jars',
      tierType: 'two-tier',
    },
    'grinder-only': {
      label: 'grinders',
      finalThreshold: 3,
      viewMoreUrl: '/collections/herb-grinders',
      viewMoreLabel: 'View more grinder sets',
      tierType: 'buy-two-get-one',
    },
    'rolling-tray': {
      label: 'rolling trays',
      finalThreshold: 3,
      viewMoreUrl: '/collections/all-rolling-trays',
      viewMoreLabel: 'View more rolling trays',
      tierType: 'buy-two-get-one',
    },
    'ashtray-only': {
      label: 'ashtrays',
      finalThreshold: 3,
      viewMoreUrl: '/collections/all-products-ashtray',
      viewMoreLabel: 'View more ashtrays',
      tierType: 'buy-two-get-one',
    },
  };

  class SaCartPromotionController {
    constructor(root) {
      this.root = root;
      this.dialog = root.querySelector('[data-sa-promotion-dialog]');
      this.items = root.querySelector('[data-sa-promotion-items]');
      this.status = root.querySelector('[data-sa-promotion-status]');
      this.emptyState = root.querySelector('[data-sa-promotion-empty]');
      this.recommendations = root.querySelector('[data-sa-promotion-recommendations]');
      this.maxRecommendations = Math.max(1, Number(root.dataset.maxRecommendations) || 4);
      this.preferSameSeries = root.dataset.preferSameSeries !== 'false';
      this.randomFallback = root.dataset.randomFallback !== 'false';
      this.lastTriggerSignature = '';
      this.previousFocus = null;
      this.activeGroupKey = '';
      this.activeTriggerCandidate = null;
      this.pending = false;
      this.inertSiblings = [];

      this.candidates = this.readCandidates();
      this.variantCandidates = this.indexCandidateVariants();

      this.handleClick = this.handleClick.bind(this);
      this.handleKeydown = this.handleKeydown.bind(this);
      this.root.addEventListener('click', this.handleClick);
      this.root.addEventListener('keydown', this.handleKeydown);
    }

    destroy() {
      this.root.removeEventListener('click', this.handleClick);
      this.root.removeEventListener('keydown', this.handleKeydown);
    }

    readCandidates() {
      return Array.from(this.root.querySelectorAll(CANDIDATE_SELECTOR)).map(template => ({
        template,
        group: template.dataset.group,
        productId: String(template.dataset.productId || ''),
        variantId: String(template.dataset.variantId || ''),
        qualifyingVariantIds: String(template.dataset.qualifyingVariantIds || '')
          .split('|')
          .filter(Boolean),
        series: template.dataset.series || '',
      }));
    }

    indexCandidateVariants() {
      const index = new Map();
      this.candidates.forEach(candidate => {
        candidate.qualifyingVariantIds.forEach(variantId => index.set(String(variantId), candidate));
      });
      return index;
    }

    async handleSuccessfulAdd(event) {
      if (!event || event.source === 'sa-cart-promotion-upsell' || this.pending) return;

      const variantIds = this.getEventVariantIds(event);
      const triggerCandidate = variantIds
        .map(variantId => this.variantCandidates.get(String(variantId)))
        .find(Boolean);

      if (!triggerCandidate || !GROUPS[triggerCandidate.group]) return;

      try {
        const cart = await this.fetchCart();
        if (!this.root.isConnected) return;

        const triggerStillPresent = cart.items.some(item => (
          variantIds.includes(String(item.variant_id ?? item.id)) && Number(item.quantity) > 0
        ));
        if (!triggerStillPresent) return;

        const quantity = this.getGroupQuantity(cart, triggerCandidate.group);
        const group = GROUPS[triggerCandidate.group];
        const addedQuantity = this.getAddedGroupQuantity(event, triggerCandidate.group, variantIds);
        const previousQuantity = Math.max(0, quantity - addedQuantity);
        if (quantity <= 0 || (quantity > group.finalThreshold && previousQuantity >= group.finalThreshold)) return;

        const signature = this.buildTriggerSignature(triggerCandidate.group, variantIds, cart);
        if (signature === this.lastTriggerSignature) return;
        this.lastTriggerSignature = signature;

        this.activeGroupKey = triggerCandidate.group;
        this.activeTriggerCandidate = triggerCandidate;
        this.renderState(cart, triggerCandidate.group, triggerCandidate);
        this.open();
      } catch (error) {
        // The cart drawer remains the source of truth if cart verification is unavailable.
      }
    }

    getEventVariantIds(event) {
      const values = Array.isArray(event.productVariantIds)
        ? event.productVariantIds
        : [event.productVariantId];
      return values.map(value => String(value || '')).filter(Boolean);
    }

    buildTriggerSignature(groupKey, variantIds, cart) {
      const cartSignature = cart.items
        .map(item => `${item.key || item.variant_id}:${item.quantity}`)
        .sort()
        .join('|');
      return `${groupKey}:${variantIds.join(',')}:${cartSignature}`;
    }

    getGroupQuantity(cart, groupKey) {
      return cart.items.reduce((total, item) => {
        const candidate = this.variantCandidates.get(String(item.variant_id ?? item.id));
        return candidate?.group === groupKey ? total + Number(item.quantity || 0) : total;
      }, 0);
    }

    getAddedGroupQuantity(event, groupKey, fallbackVariantIds) {
      const cartData = event.cartData || {};
      const addedItems = Array.isArray(cartData.items) ? cartData.items : [cartData];
      const quantity = addedItems.reduce((total, item) => {
        const variantId = String(item.variant_id ?? item.id ?? '');
        const candidate = this.variantCandidates.get(variantId);
        return candidate?.group === groupKey ? total + Number(item.quantity || 0) : total;
      }, 0);

      if (quantity > 0) return quantity;
      return fallbackVariantIds.reduce((total, variantId) => {
        const candidate = this.variantCandidates.get(String(variantId));
        return candidate?.group === groupKey ? total + 1 : total;
      }, 0);
    }

    renderState(cart, groupKey, triggerCandidate) {
      const group = GROUPS[groupKey];
      if (!group) return;

      const quantity = this.getGroupQuantity(cart, groupKey);
      const state = this.getProgressState(group, quantity);
      const title = this.root.querySelector('[data-sa-promotion-title]');
      const message = this.root.querySelector('[data-sa-promotion-message]');
      const quantityLabel = this.root.querySelector('[data-sa-promotion-quantity]');
      const progress = this.root.querySelector('[data-sa-promotion-progress]');
      const viewMore = this.root.querySelector('[data-sa-promotion-view-more]');

      if (title) title.textContent = state.title;
      if (message) message.textContent = state.message;
      if (quantityLabel) quantityLabel.textContent = state.quantityLabel;
      if (progress) progress.style.width = `${state.progress}%`;
      if (viewMore) {
        viewMore.href = group.viewMoreUrl;
        viewMore.textContent = group.viewMoreLabel;
      }

      this.recommendations.hidden = state.complete;
      if (!state.complete) this.renderRecommendations(cart, groupKey, triggerCandidate);
    }

    getProgressState(group, quantity) {
      if (quantity >= group.finalThreshold) {
        return {
          complete: true,
          title: 'Collector offer quantity reached',
          message: group.tierType === 'two-tier'
            ? `Your cart now has ${group.finalThreshold} eligible ${group.label}: three purchased and one eligible item for the free-item offer.`
            : `Your cart now has ${group.finalThreshold} eligible ${group.label}: two purchased and one eligible item for the free-item offer.`,
          quantityLabel: `${quantity} of ${group.finalThreshold} eligible items`,
          progress: 100,
        };
      }

      if (group.tierType === 'two-tier' && quantity < group.firstThreshold) {
        const remaining = group.firstThreshold - quantity;
        return {
          complete: false,
          title: `Build your ${group.label} archive`,
          message: `Add ${remaining} more eligible ${remaining === 1 ? 'item' : 'items'} to reach the quantity for $5 off.`,
          quantityLabel: `${quantity} of ${group.firstThreshold} eligible items`,
          progress: Math.min(100, (quantity / group.firstThreshold) * 100),
        };
      }

      const remaining = group.finalThreshold - quantity;
      return {
        complete: false,
        title: group.tierType === 'two-tier' ? '$5-off quantity reached' : `Build your ${group.label} archive`,
        message: group.tierType === 'two-tier'
          ? `Add ${remaining} more eligible ${remaining === 1 ? 'item' : 'items'} to reach four total and qualify for the free-item offer.`
          : `Add ${remaining} more eligible ${remaining === 1 ? 'item' : 'items'} to reach three total: buy two and qualify for one free.`,
        quantityLabel: `${quantity} of ${group.finalThreshold} eligible items`,
        progress: Math.min(100, (quantity / group.finalThreshold) * 100),
      };
    }

    renderRecommendations(cart, groupKey, triggerCandidate) {
      const cartProductIds = new Set(cart.items.map(item => String(item.product_id || '')));
      const eligible = this.candidates.filter(candidate => (
        candidate.group === groupKey
        && candidate.productId !== triggerCandidate.productId
        && !cartProductIds.has(candidate.productId)
      ));

      let sameSeries = [];
      let otherCandidates = eligible;
      if (this.preferSameSeries && triggerCandidate.series) {
        sameSeries = eligible.filter(candidate => candidate.series === triggerCandidate.series);
        otherCandidates = eligible.filter(candidate => candidate.series !== triggerCandidate.series);
      }

      const selected = sameSeries.slice(0, this.maxRecommendations);
      const remainingSlots = this.maxRecommendations - selected.length;
      if (remainingSlots > 0 && this.randomFallback) {
        const fallbackPool = sameSeries.length === 0
          ? this.shuffle(otherCandidates)
          : otherCandidates;
        selected.push(...fallbackPool.slice(0, remainingSlots));
      }

      this.items.replaceChildren();
      selected.forEach(candidate => {
        this.items.append(candidate.template.content.cloneNode(true));
      });

      this.emptyState.hidden = selected.length > 0;
    }

    shuffle(candidates) {
      const shuffled = [...candidates];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
      }
      return shuffled;
    }

    open() {
      if (!this.root.hidden) return;
      this.previousFocus = document.activeElement;
      if (this.status) {
        this.status.hidden = true;
        this.status.textContent = '';
        this.status.removeAttribute('data-state');
      }
      this.root.hidden = false;
      this.root.dataset.open = 'true';
      this.setBackgroundInert(true);
      requestAnimationFrame(() => {
        this.root.querySelector('.sa-cart-promotion__close')?.focus();
      });
    }

    close() {
      if (this.root.hidden) return;
      this.root.hidden = true;
      delete this.root.dataset.open;
      this.setBackgroundInert(false);

      const drawer = this.root.closest('cart-drawer');
      const drawerClose = drawer?.querySelector('[data-drawer-close]');
      if (drawer?.classList.contains('is-visible') && drawerClose) {
        drawerClose.focus();
      } else if (this.previousFocus?.isConnected) {
        this.previousFocus.focus();
      }
    }

    setBackgroundInert(shouldBeInert) {
      if (shouldBeInert) {
        this.inertSiblings = Array.from(this.root.parentElement?.children || [])
          .filter(element => element !== this.root && !element.hasAttribute('inert'));
        this.inertSiblings.forEach(element => element.setAttribute('inert', ''));
        return;
      }

      this.inertSiblings.forEach(element => element.removeAttribute('inert'));
      this.inertSiblings = [];
    }

    handleClick(event) {
      const closeControl = event.target.closest('[data-sa-promotion-close]');
      if (closeControl) {
        event.preventDefault();
        this.close();
        return;
      }

      const addButton = event.target.closest('[data-sa-promotion-add]');
      if (addButton) {
        event.preventDefault();
        this.addRecommendation(addButton);
      }
    }

    handleKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        this.close();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = Array.from(this.dialog.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter(element => !element.hidden && element.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        event.stopPropagation();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        event.stopPropagation();
        first.focus();
      }
    }

    async addRecommendation(button) {
      if (this.pending || !this.activeGroupKey) return;
      const variantId = String(button.dataset.variantId || '');
      if (!variantId || !this.variantCandidates.has(variantId)) return;

      const drawer = this.root.closest('cart-drawer');
      const sections = drawer?.getSectionsToRender?.() || [];
      this.pending = true;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.querySelector('.loading__spinner')?.classList.remove('hidden');
      this.announce('Adding item to cart.', 'loading');

      try {
        const response = await fetch(routes.cart_add_url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            items: [{ id: Number(variantId), quantity: 1 }],
            sections: sections.map(section => section.section),
            sections_url: window.location.pathname,
          }),
        });
        const responseData = await this.parseJson(response);
        if (!response.ok || responseData?.status || responseData?.errors) {
          throw new Error(responseData?.description || 'Item could not be added.');
        }

        drawer?.renderContents?.(responseData);
        const cart = await this.fetchCart();
        if (typeof syncCartAfterMutation === 'function') syncCartAfterMutation(cart);
        if (typeof publish === 'function' && typeof PUB_SUB_EVENTS !== 'undefined') {
          publish(PUB_SUB_EVENTS.cartUpdate, {
            source: 'sa-cart-promotion-upsell',
            productVariantId: variantId,
            cartData: responseData,
          });
        }

        button.dataset.state = 'success';
        button.querySelector('[data-sa-promotion-add-label]').textContent = 'Added';
        this.announce('Item added to cart. Promotion progress updated.', 'success');
        this.renderState(cart, this.activeGroupKey, this.activeTriggerCandidate);
      } catch (error) {
        button.disabled = false;
        this.announce(error.message || 'Item could not be added. Please try again.', 'error');
      } finally {
        this.pending = false;
        button.removeAttribute('aria-busy');
        button.querySelector('.loading__spinner')?.classList.add('hidden');
      }
    }

    announce(message, state) {
      if (!this.status) return;
      this.status.textContent = message;
      this.status.hidden = false;
      if (state) this.status.dataset.state = state;
    }

    async fetchCart() {
      const response = await fetch(`${routes.cart_url}.js`, {
        headers: { Accept: 'application/json' },
      });
      const cart = await this.parseJson(response);
      if (!response.ok || !Array.isArray(cart?.items)) throw new Error('Cart could not be verified.');
      return cart;
    }

    async parseJson(response) {
      try {
        return await response.json();
      } catch (error) {
        return null;
      }
    }
  }

  class SaCartPromotionManager {
    constructor() {
      this.controllers = new Set();
      this.cartUpdateUnsubscriber = null;
      this.initialize(document);
      this.subscribeToCartUpdates();

      document.addEventListener('shopify:section:load', event => this.initialize(event.target));
      document.addEventListener('shopify:section:unload', event => this.destroyWithin(event.target));
    }

    initialize(root) {
      const roots = [];
      if (root instanceof Element && root.matches(ROOT_SELECTOR)) roots.push(root);
      root.querySelectorAll?.(ROOT_SELECTOR).forEach(element => roots.push(element));

      roots.forEach(element => {
        if (element.saCartPromotionController) return;
        const controller = new SaCartPromotionController(element);
        element.saCartPromotionController = controller;
        this.controllers.add(controller);
      });
    }

    destroyWithin(root) {
      this.controllers.forEach(controller => {
        if (controller.root === root || root.contains?.(controller.root)) {
          controller.destroy();
          delete controller.root.saCartPromotionController;
          this.controllers.delete(controller);
        }
      });
    }

    subscribeToCartUpdates() {
      if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return;
      this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, event => {
        this.controllers.forEach(controller => controller.handleSuccessfulAdd(event));
      });
    }
  }

  window.saCartPromotionUpsell = new SaCartPromotionManager();
})();
