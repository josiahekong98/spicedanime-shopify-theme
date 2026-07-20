(() => {
  if (window.saCartCompleteSetControllerLoaded) return;
  window.saCartCompleteSetControllerLoaded = true;

  const HOST_SELECTOR = '[data-sa-cart-complete-set-host]';
  const MODULE_SELECTOR = '[data-sa-cart-complete-set]';
  const SELECTOR_CONTROL = '[data-sa-cart-set-select]';
  const ACTION_SELECTOR = '[data-sa-cart-add-selected]';
  const ACTIONS_SELECTOR = '[data-sa-cart-complete-set-actions]';
  const STATUS_SELECTOR = '[data-sa-cart-complete-set-status]';

  class SaCartCompleteSetController {
    constructor(host) {
      this.host = host;
      this.activeModule = null;
      this.cartVariantIds = new Set();
      this.cartStateReady = false;
      this.cartStateSequence = 0;
      this.refreshSequence = 0;
      this.operationSequence = 0;
      this.operationController = null;
      this.operationModule = null;
      this.pending = false;
      this.pendingAnnouncement = null;

      this.handleChange = this.handleChange.bind(this);
      this.handleClick = this.handleClick.bind(this);
      this.handleCartRefreshed = this.handleCartRefreshed.bind(this);
      this.handleRecommendationsUpdated = this.handleRecommendationsUpdated.bind(this);

      this.host.addEventListener('change', this.handleChange);
      this.host.addEventListener('click', this.handleClick);
      this.host.addEventListener('sa:cart:recommendations:updated', this.handleRecommendationsUpdated);
      document.addEventListener('sa:cart:refreshed', this.handleCartRefreshed);

      this.cartUpdateUnsubscriber = this.subscribeToCartUpdates();
      this.syncModules();
      this.loadCurrentCart();
    }

    destroy() {
      this.operationSequence += 1;
      this.operationController?.abort();
      this.operationController = null;
      this.cartStateSequence += 1;
      this.cartUpdateUnsubscriber?.();
      this.host.removeEventListener('change', this.handleChange);
      this.host.removeEventListener('click', this.handleClick);
      this.host.removeEventListener('sa:cart:recommendations:updated', this.handleRecommendationsUpdated);
      document.removeEventListener('sa:cart:refreshed', this.handleCartRefreshed);
      this.deactivateModules();
    }

    subscribeToCartUpdates() {
      if (typeof subscribe !== 'function' || typeof PUB_SUB_EVENTS === 'undefined') return null;

      return subscribe(PUB_SUB_EVENTS.cartUpdate, event => {
        if (!event || event.source !== 'product-form') return;

        const variantId = this.parseVariantId(event.productVariantId);
        if (!variantId) return;

        const addedItem = this.findAddedItem(event.cartData, variantId);
        const productTitle = addedItem?.product_title || addedItem?.title || '';
        const message = productTitle
          ? `Added ${productTitle} to cart.`
          : 'Item added to cart.';

        this.queueAnnouncement(message, 'success', variantId);
      });
    }

    findAddedItem(cartData, variantId) {
      if (!cartData) return null;

      const items = Array.isArray(cartData.items)
        ? cartData.items
        : [cartData];

      return items.find(item => {
        const itemVariantId = this.parseVariantId(item?.variant_id ?? item?.id);
        return itemVariantId === variantId;
      }) || null;
    }

    async loadCurrentCart() {
      const requestSequence = ++this.cartStateSequence;

      try {
        const response = await fetch(`${routes.cart_url}.js`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) return;

        const cart = await response.json();
        if (requestSequence !== this.cartStateSequence || !this.isHostCurrent()) return;

        this.updateCartState(cart);
        this.syncModules();
      } catch (error) {
        // Controls remain disabled when current cart membership cannot be verified.
      }
    }

    handleCartRefreshed(event) {
      if (!this.isHostCurrent() || !event.detail?.cart) return;

      this.refreshSequence += 1;
      this.updateCartState(event.detail.cart);
      this.syncModules();
      this.flushAnnouncement();
    }

    handleRecommendationsUpdated(event) {
      if (!this.isHostCurrent() || !this.host.contains(event.target)) return;

      this.syncModules();
      this.flushAnnouncement();
    }

    handleChange(event) {
      const control = event.target.closest?.(SELECTOR_CONTROL);
      if (!control || !this.host.contains(control)) return;

      const module = control.closest(MODULE_SELECTOR);
      if (!this.isCurrentModule(module) || control.disabled) {
        control.checked = false;
        return;
      }

      control.setAttribute('aria-checked', String(control.checked));
      control.closest('[data-sa-cart-set-product]')?.classList.toggle('is-selected', control.checked);
      this.updateActionState(module);
    }

    handleClick(event) {
      const action = event.target.closest?.(ACTION_SELECTOR);
      if (!action || !this.host.contains(action)) return;

      event.preventDefault();
      const module = action.closest(MODULE_SELECTOR);
      this.submitSelected(module);
    }

    isHostCurrent() {
      return this.host.isConnected
        && this.host.matches(HOST_SELECTOR)
        && this.host.saCartCompleteSetController === this;
    }

    resolveCurrentModule() {
      if (!this.isHostCurrent()) return null;

      const modules = Array.from(this.host.querySelectorAll(MODULE_SELECTOR));
      const visibleModules = modules.filter(module => (
        module.isConnected
        && this.host.contains(module)
        && !module.hidden
        && !module.classList.contains('hidden')
      ));

      return visibleModules.find(module => module.dataset.saCartRecommendationSource === 'complementary')
        || visibleModules.find(module => module.dataset.saCartRecommendationSource === 'fallback')
        || null;
    }

    isCurrentModule(module) {
      return Boolean(
        module
        && module.isConnected
        && this.host.contains(module)
        && module === this.activeModule
        && module === this.resolveCurrentModule()
      );
    }

    syncModules() {
      if (!this.isHostCurrent()) return;

      const nextModule = this.resolveCurrentModule();
      if (nextModule !== this.activeModule) {
        if (this.pending && this.operationModule && this.operationModule !== nextModule) {
          this.operationSequence += 1;
          this.operationController?.abort();
          this.operationController = null;
          this.operationModule = null;
          this.pending = false;
        }
        this.activeModule = nextModule;
      }

      this.host.querySelectorAll(MODULE_SELECTOR).forEach(module => {
        if (module === this.activeModule) {
          this.activateModule(module);
        } else {
          this.deactivateModule(module);
        }
      });
    }

    activateModule(module) {
      if (!module.isConnected || !this.host.contains(module)) return;

      const seenVariantIds = new Set();
      let selectableCount = 0;

      module.querySelectorAll(SELECTOR_CONTROL).forEach(control => {
        const card = control.closest('[data-sa-cart-set-product]');
        const variantId = this.parseVariantId(control.dataset.variantId);
        const eligible = Boolean(
          this.cartStateReady
          && card
          && card.dataset.productSelectable === 'true'
          && card.dataset.productAvailable === 'true'
          && variantId
          && !seenVariantIds.has(variantId)
          && !this.cartVariantIds.has(variantId)
        );

        if (variantId) seenVariantIds.add(variantId);

        control.disabled = !eligible || this.pending;
        if (control.disabled) {
          control.setAttribute('aria-disabled', 'true');
        } else {
          control.removeAttribute('aria-disabled');
        }
        if (!eligible) {
          control.checked = false;
          control.setAttribute('aria-checked', 'false');
          card?.classList.remove('is-selected');
        } else {
          control.setAttribute('aria-checked', String(control.checked));
          selectableCount += 1;
        }
      });

      const actions = module.querySelector(ACTIONS_SELECTOR);
      if (actions) actions.hidden = selectableCount === 0;
      this.updateActionState(module);
    }

    deactivateModule(module) {
      module.querySelectorAll(SELECTOR_CONTROL).forEach(control => {
        control.checked = false;
        control.disabled = true;
        control.setAttribute('aria-disabled', 'true');
        control.setAttribute('aria-checked', 'false');
        control.closest('[data-sa-cart-set-product]')?.classList.remove('is-selected');
      });

      const actions = module.querySelector(ACTIONS_SELECTOR);
      if (actions) {
        actions.hidden = true;
        actions.removeAttribute('aria-busy');
      }

      const action = module.querySelector(ACTION_SELECTOR);
      if (action) action.disabled = true;

      const status = module.querySelector(STATUS_SELECTOR);
      if (status) {
        status.hidden = true;
        status.textContent = '';
        status.removeAttribute('data-status-state');
      }
    }

    deactivateModules() {
      this.host.querySelectorAll(MODULE_SELECTOR).forEach(module => this.deactivateModule(module));
      this.activeModule = null;
    }

    updateActionState(module) {
      const action = module.querySelector(ACTION_SELECTOR);
      if (!action) return;

      const hasSelection = Array.from(module.querySelectorAll(SELECTOR_CONTROL))
        .some(control => control.checked && !control.disabled);
      action.disabled = this.pending || !hasSelection;
    }

    collectSelectedVariants(module) {
      if (!this.isCurrentModule(module) || !this.cartStateReady) return [];

      const variantIds = new Set();
      module.querySelectorAll(`${SELECTOR_CONTROL}:checked`).forEach(control => {
        const card = control.closest('[data-sa-cart-set-product]');
        const variantId = this.parseVariantId(control.dataset.variantId);
        if (
          !control.disabled
          && card?.dataset.productSelectable === 'true'
          && card.dataset.productAvailable === 'true'
          && variantId
          && !this.cartVariantIds.has(variantId)
        ) {
          variantIds.add(variantId);
        }
      });

      return Array.from(variantIds);
    }

    async submitSelected(module) {
      if (this.pending || !this.isCurrentModule(module)) return;

      const variantIds = this.collectSelectedVariants(module);
      if (!variantIds.length || !this.isCurrentModule(module)) return;

      const sections = this.getSectionDescriptors();
      if (!sections.length) return;

      const operationSequence = ++this.operationSequence;
      this.operationController = new AbortController();
      this.operationModule = module;
      this.pending = true;
      this.setPendingState(module, true);

      try {
        const response = await fetch(routes.cart_add_url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            items: variantIds.map(id => ({ id, quantity: 1 })),
            sections: sections.map(section => section.section),
            sections_url: window.location.pathname,
          }),
          signal: this.operationController.signal,
        });

        const responseData = await this.parseJsonResponse(response);
        if (!this.isCurrentOperation(operationSequence, module)) return;

        if (!response.ok || responseData?.status || responseData?.errors || !this.hasRenderedSections(responseData, sections)) {
          throw new Error('Batch add response could not be confirmed.');
        }

        this.queueAnnouncement(
          variantIds.length === 1 ? 'Selected item added to cart.' : 'Selected items added to cart.',
          'success'
        );
        this.host.renderContents(responseData);
        this.pending = false;
        this.operationModule = null;
        this.operationController = null;
      } catch (error) {
        if (error.name === 'AbortError' || operationSequence !== this.operationSequence) return;
        await this.reconcileFailure(operationSequence, module);
      }
    }

    async reconcileFailure(operationSequence, module) {
      try {
        if (!this.isCurrentOperation(operationSequence, module)) return;

        const sections = this.getSectionDescriptors();
        const renderedSections = await this.fetchRenderedSections(sections, this.operationController.signal);
        const freshCart = await this.fetchCartState(this.operationController.signal);

        if (!this.isCurrentOperation(operationSequence, module)) return;

        this.pending = false;
        this.operationModule = null;
        this.operationController = null;
        this.queueAnnouncement(
          "We couldn't confirm every selected item. Your cart has been refreshed.",
          'error'
        );
        this.host.renderContents({ ...freshCart, sections: renderedSections });
      } catch (error) {
        if (error.name === 'AbortError' || operationSequence !== this.operationSequence) return;

        this.pending = false;
        this.operationModule = null;
        this.operationController = null;
        this.clearSelections(module);
        this.setPendingState(module, false);
        this.showStatus(module, "We couldn't confirm every selected item. Please review your cart.", 'error');
        this.syncModules();
      }
    }

    async fetchRenderedSections(sections, signal) {
      if (!sections.length) throw new Error('No cart sections are available.');

      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('sections', sections.map(section => section.section).join(','));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
        signal,
      });
      const renderedSections = await this.parseJsonResponse(response);

      if (!response.ok || !this.hasRenderedSections({ sections: renderedSections }, sections)) {
        throw new Error('Cart sections could not be refreshed.');
      }

      return renderedSections;
    }

    async fetchCartState(signal) {
      const response = await fetch(`${routes.cart_url}.js`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal,
      });
      const cart = await this.parseJsonResponse(response);
      if (!response.ok || !Array.isArray(cart?.items)) {
        throw new Error('Cart state could not be refreshed.');
      }
      return cart;
    }

    async parseJsonResponse(response) {
      try {
        return await response.json();
      } catch (error) {
        return null;
      }
    }

    getSectionDescriptors() {
      if (typeof this.host.getSectionsToRender !== 'function') return [];

      const sections = this.host.getSectionsToRender();
      return Array.isArray(sections)
        ? sections.filter(section => section?.section && section?.selector)
        : [];
    }

    hasRenderedSections(responseData, sections) {
      return Boolean(
        responseData?.sections
        && sections.every(section => {
          const html = responseData.sections[section.section];
          if (typeof html !== 'string') return false;

          return Boolean(
            new DOMParser()
              .parseFromString(html, 'text/html')
              .querySelector(section.selector)
          );
        })
      );
    }

    isCurrentOperation(operationSequence, module) {
      return this.pending
        && operationSequence === this.operationSequence
        && module === this.operationModule
        && this.isCurrentModule(module);
    }

    setPendingState(module, isPending) {
      if (!module?.isConnected || !this.host.contains(module)) return;

      const actions = module.querySelector(ACTIONS_SELECTOR);
      const action = module.querySelector(ACTION_SELECTOR);
      if (actions) {
        if (isPending) {
          actions.setAttribute('aria-busy', 'true');
        } else {
          actions.removeAttribute('aria-busy');
        }
      }

      if (action) {
        action.dataset.defaultLabel ||= action.textContent.trim();
        action.textContent = isPending ? 'Adding...' : action.dataset.defaultLabel;
        action.disabled = isPending || !module.querySelector(`${SELECTOR_CONTROL}:checked:not(:disabled)`);
      }

      module.querySelectorAll(SELECTOR_CONTROL).forEach(control => {
        control.disabled = isPending;
        if (isPending) {
          control.setAttribute('aria-disabled', 'true');
        } else {
          control.removeAttribute('aria-disabled');
        }
      });
    }

    clearSelections(module) {
      if (!module) return;
      module.querySelectorAll(SELECTOR_CONTROL).forEach(control => {
        control.checked = false;
        control.setAttribute('aria-checked', 'false');
        control.closest('[data-sa-cart-set-product]')?.classList.remove('is-selected');
      });
    }

    updateCartState(cart) {
      if (!Array.isArray(cart?.items)) return;

      this.cartVariantIds = new Set(
        cart.items
          .map(item => this.parseVariantId(item.variant_id ?? item.id))
          .filter(Boolean)
      );
      this.cartStateReady = true;
    }

    parseVariantId(value) {
      const variantId = Number(value);
      return Number.isSafeInteger(variantId) && variantId > 0 ? variantId : null;
    }

    queueAnnouncement(message, state, variantId = null) {
      this.pendingAnnouncement = {
        message,
        state,
        variantId,
        targetRefresh: this.refreshSequence + 1,
      };
    }

    flushAnnouncement() {
      const announcement = this.pendingAnnouncement;
      if (!announcement) return;

      if (announcement.targetRefresh < this.refreshSequence) {
        this.pendingAnnouncement = null;
        return;
      }
      if (announcement.targetRefresh !== this.refreshSequence) return;
      if (announcement.variantId && !this.cartVariantIds.has(announcement.variantId)) {
        this.pendingAnnouncement = null;
        return;
      }

      const module = this.resolveCurrentModule();
      if (!this.isCurrentModule(module)) return;

      this.showStatus(module, announcement.message, announcement.state);
      this.pendingAnnouncement = null;
    }

    showStatus(module, message, state) {
      if (!this.isCurrentModule(module)) return;

      const status = module.querySelector(STATUS_SELECTOR);
      if (!status || !status.isConnected) return;

      status.textContent = message;
      status.dataset.statusState = state;
      status.hidden = false;
    }
  }

  const initializeHosts = root => {
    const hosts = [];
    if (root instanceof Element && root.matches(HOST_SELECTOR)) hosts.push(root);
    root.querySelectorAll?.(HOST_SELECTOR).forEach(host => hosts.push(host));

    hosts.forEach(host => {
      if (host.saCartCompleteSetController) return;
      host.saCartCompleteSetController = new SaCartCompleteSetController(host);
    });
  };

  initializeHosts(document);

  document.addEventListener('shopify:section:load', event => initializeHosts(event.target));
  document.addEventListener('shopify:section:unload', event => {
    const host = event.target.matches?.(HOST_SELECTOR)
      ? event.target
      : event.target.querySelector?.(HOST_SELECTOR);
    if (!host?.saCartCompleteSetController) return;

    host.saCartCompleteSetController.destroy();
    delete host.saCartCompleteSetController;
  });
})();
