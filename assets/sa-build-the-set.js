(() => {
  if (customElements.get('sa-build-the-set')) return;

  const SERIES_BUTTON = '[data-sa-build-set-series]';
  const SERIES_PANEL = '[data-sa-build-set-series-panel]';
  const SETUP_BUTTON = '[data-sa-build-set-setup]';
  const SETUP_PANEL = '[data-sa-build-set-setup-panel]';
  const PRODUCT = '[data-sa-build-set-product]';
  const SELECT_CONTROL = '[data-sa-build-set-select]';

  class SaBuildTheSet extends HTMLElement {
    constructor() {
      super();
      this.handleClick = this.handleClick.bind(this);
      this.handleChange = this.handleChange.bind(this);
      this.handleBlockSelect = this.handleBlockSelect.bind(this);
      this.pending = false;
      this.operationSequence = 0;
      this.operationController = null;
    }

    connectedCallback() {
      if (this.initialized) return;
      this.initialized = true;
      this.addEventListener('click', this.handleClick);
      this.addEventListener('change', this.handleChange);
      this.addEventListener('shopify:block:select', this.handleBlockSelect);
      this.initializeSelection();
    }

    disconnectedCallback() {
      this.operationSequence += 1;
      this.operationController?.abort();
      this.operationController = null;
      this.pending = false;
      this.setPendingState(false);
      this.clearSelections();
      this.removeEventListener('click', this.handleClick);
      this.removeEventListener('change', this.handleChange);
      this.removeEventListener('shopify:block:select', this.handleBlockSelect);
      this.initialized = false;
    }

    initializeSelection() {
      const firstSeries = this.querySelector(SERIES_BUTTON);
      if (!firstSeries) return;
      this.activateSeries(firstSeries.dataset.seriesKey, false);
    }

    handleClick(event) {
      const addButton = event.target.closest('[data-sa-build-set-add]');
      if (addButton && this.contains(addButton)) {
        event.preventDefault();
        this.submitSelected();
        return;
      }

      const seriesButton = event.target.closest(SERIES_BUTTON);
      if (seriesButton && this.contains(seriesButton)) {
        if (!this.pending && seriesButton.getAttribute('aria-pressed') !== 'true') {
          this.activateSeries(seriesButton.dataset.seriesKey, true);
        }
        return;
      }

      const setupButton = event.target.closest(SETUP_BUTTON);
      if (!setupButton || !this.contains(setupButton) || this.pending) return;

      const seriesPanel = setupButton.closest(SERIES_PANEL);
      if (!seriesPanel || setupButton.getAttribute('aria-pressed') === 'true') return;
      this.activateSetup(seriesPanel, setupButton.dataset.setupKey, true);
    }

    handleChange(event) {
      const control = event.target.closest(SELECT_CONTROL);
      if (!control || !this.contains(control)) return;

      const activePanel = this.getActiveSetupPanel();
      const wrapper = control.closest(PRODUCT);
      if (
        this.pending
        || !activePanel
        || !activePanel.contains(control)
        || !this.isStructuredSelectable(wrapper, control)
        || control.disabled
      ) {
        control.checked = false;
        wrapper?.classList.remove('is-selected');
        return;
      }

      wrapper.classList.toggle('is-selected', control.checked);
      this.clearError();
      this.updateSelectionSummary();
    }

    handleBlockSelect(event) {
      if (this.pending) return;
      const seriesPanel = event.target.closest(SERIES_PANEL);
      if (!seriesPanel || !this.contains(seriesPanel)) return;
      this.activateSeries(seriesPanel.dataset.seriesKey, false);
    }

    activateSeries(seriesKey, announce) {
      this.clearSelections();
      let activePanel = null;

      this.querySelectorAll(SERIES_BUTTON).forEach(button => {
        const isActive = button.dataset.seriesKey === seriesKey;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });

      this.querySelectorAll(SERIES_PANEL).forEach(panel => {
        const isActive = panel.dataset.seriesKey === seriesKey;
        panel.hidden = !isActive;
        panel.setAttribute('aria-hidden', String(!isActive));
        if (isActive) activePanel = panel;
      });

      if (!activePanel) return;
      const firstSetup = activePanel.querySelector(SETUP_BUTTON);
      if (firstSetup) {
        this.activateSetup(activePanel, firstSetup.dataset.setupKey, announce, false);
      }
    }

    activateSetup(seriesPanel, setupKey, announce, clearSelection = true) {
      if (clearSelection) this.clearSelections();
      let activeButton = null;

      seriesPanel.querySelectorAll(SETUP_BUTTON).forEach(button => {
        const isActive = button.dataset.setupKey === setupKey;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
        if (isActive) activeButton = button;
      });

      seriesPanel.querySelectorAll(SETUP_PANEL).forEach(panel => {
        const isActive = panel.dataset.setupKey === setupKey;
        panel.hidden = !isActive;
        panel.setAttribute('aria-hidden', String(!isActive));
      });

      const activeSetupPanel = this.getActiveSetupPanel();
      this.syncSelectableControls(activeSetupPanel);
      this.updateSelectionSummary();

      if (!announce || !activeButton) return;
      const seriesTitle = seriesPanel.dataset.seriesTitle?.trim();
      const setupTitle = activeButton.textContent.trim();
      if (seriesTitle && setupTitle) {
        this.announce(`Showing ${setupTitle} for ${seriesTitle}.`);
      }
    }

    getActiveSetupPanel() {
      const activeSeries = Array.from(this.querySelectorAll(SERIES_PANEL))
        .find(panel => !panel.hidden);
      if (!activeSeries) return null;
      return Array.from(activeSeries.querySelectorAll(SETUP_PANEL))
        .find(panel => !panel.hidden) || null;
    }

    syncSelectableControls(activePanel) {
      this.querySelectorAll(SELECT_CONTROL).forEach(control => {
        control.checked = false;
        control.disabled = true;
        delete control.dataset.duplicateVariant;
        control.closest(PRODUCT)?.classList.remove('is-selected');
        const selection = control.closest('[data-sa-build-set-selection]');
        if (selection) selection.hidden = false;
      });

      if (!activePanel) return;
      const seenVariantIds = new Set();

      activePanel.querySelectorAll(SELECT_CONTROL).forEach(control => {
        const wrapper = control.closest(PRODUCT);
        const variantId = this.parseVariantId(control.dataset.variantId);
        const duplicate = variantId && seenVariantIds.has(variantId);
        const eligible = this.isStructuredSelectable(wrapper, control) && !duplicate;

        control.disabled = !eligible;
        if (variantId && !duplicate) seenVariantIds.add(variantId);
        if (duplicate) control.dataset.duplicateVariant = 'true';

        const selection = control.closest('[data-sa-build-set-selection]');
        if (selection) selection.hidden = Boolean(duplicate);
      });
    }

    isStructuredSelectable(wrapper, control) {
      if (!wrapper || !control || !wrapper.isConnected || !this.contains(wrapper)) return false;
      const variantId = this.parseVariantId(control.dataset.variantId);
      return Boolean(
        variantId
        && wrapper.dataset.singleVariant === 'true'
        && wrapper.dataset.available === 'true'
        && wrapper.dataset.variantAvailable === 'true'
      );
    }

    parseVariantId(value) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
    }

    parsePrice(value) {
      const parsed = Number(value);
      return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
    }

    getSelectedEntries() {
      const activePanel = this.getActiveSetupPanel();
      if (!activePanel || !activePanel.isConnected) return [];

      const entries = [];
      const seenVariantIds = new Set();
      activePanel.querySelectorAll(`${SELECT_CONTROL}:checked`).forEach(control => {
        const wrapper = control.closest(PRODUCT);
        const variantId = this.parseVariantId(control.dataset.variantId);
        if (
          control.disabled
          || !this.isStructuredSelectable(wrapper, control)
          || !variantId
          || seenVariantIds.has(variantId)
        ) {
          control.checked = false;
          wrapper?.classList.remove('is-selected');
          return;
        }

        seenVariantIds.add(variantId);
        entries.push({
          id: variantId,
          price: this.parsePrice(control.dataset.priceCents),
        });
      });

      return entries;
    }

    clearSelections() {
      this.querySelectorAll(SELECT_CONTROL).forEach(control => {
        control.checked = false;
        control.closest(PRODUCT)?.classList.remove('is-selected');
      });
      this.clearError();
      this.updateSelectionSummary();
    }

    updateSelectionSummary() {
      const entries = this.getSelectedEntries();
      const count = entries.length;
      const countElement = this.querySelector('[data-sa-build-set-count]');
      const subtotalRow = this.querySelector('[data-sa-build-set-subtotal-row]');
      const subtotalElement = this.querySelector('[data-sa-build-set-subtotal]');
      const addButton = this.querySelector('[data-sa-build-set-add]');
      const action = this.querySelector('[data-sa-build-set-action]');
      const eligibilityNote = this.querySelector('[data-sa-build-set-eligibility-note]');
      const activePanel = this.getActiveSetupPanel();
      const selectableCount = activePanel
        ? Array.from(activePanel.querySelectorAll(SELECT_CONTROL)).filter(control => !control.disabled).length
        : 0;

      if (countElement) {
        countElement.textContent = count === 1 ? '1 piece selected' : `${count} pieces selected`;
      }

      const pricesAreReliable = count > 0 && entries.every(entry => entry.price !== null);
      const subtotal = pricesAreReliable
        ? entries.reduce((total, entry) => total + entry.price, 0)
        : null;
      const formattedSubtotal = subtotal === null ? null : this.formatMoney(subtotal);

      if (subtotalRow) subtotalRow.hidden = !formattedSubtotal;
      if (subtotalElement) subtotalElement.textContent = formattedSubtotal || '';
      if (addButton) addButton.disabled = this.pending || count === 0;
      if (action) action.classList.toggle('has-selection', count > 0);
      if (eligibilityNote) eligibilityNote.hidden = selectableCount > 0;
    }

    formatMoney(cents) {
      const template = this.dataset.moneyFormat?.trim();
      const match = template?.match(/\{\{\s*([a-z_]+)\s*\}\}/i);
      if (!template || !match) return null;

      const amount = cents / 100;
      const formats = {
        amount: ['en-US', 2],
        amount_no_decimals: ['en-US', 0],
        amount_with_comma_separator: ['de-DE', 2],
        amount_no_decimals_with_comma_separator: ['de-DE', 0],
        amount_with_space_separator: ['fr-FR', 2],
        amount_no_decimals_with_space_separator: ['fr-FR', 0],
        amount_with_apostrophe_separator: ['de-CH', 2],
      };
      const format = formats[match[1]];
      if (!format) return null;

      const value = new Intl.NumberFormat(format[0], {
        minimumFractionDigits: format[1],
        maximumFractionDigits: format[1],
      }).format(amount);
      return template.replace(match[0], value);
    }

    async submitSelected() {
      if (this.pending || !this.initialized || !this.isConnected) return;
      const entries = this.getSelectedEntries();
      if (!entries.length) return;

      const cartContext = this.getCartContext();
      if (!cartContext) {
        this.setError("We couldn't connect to the cart. Please try again.");
        return;
      }

      const operationSequence = ++this.operationSequence;
      this.operationController = new AbortController();
      this.pending = true;
      this.setPendingState(true);
      let preRequestQuantities = null;

      try {
        try {
          const cartBeforeRequest = await this.fetchCartState(this.operationController.signal);
          if (!this.isCurrentOperation(operationSequence)) return;
          preRequestQuantities = this.getVariantQuantityMap(cartBeforeRequest);
        } catch (error) {
          if (error.name === 'AbortError' || !this.isCurrentOperation(operationSequence)) return;
        }

        const response = await fetch(routes.cart_add_url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
          },
          body: JSON.stringify({
            items: entries.map(entry => ({ id: entry.id, quantity: 1 })),
            sections: cartContext.sections.map(section => section.section),
            sections_url: window.location.pathname,
          }),
          signal: this.operationController.signal,
        });
        const responseData = await this.parseJsonResponse(response);

        if (!this.isCurrentOperation(operationSequence)) return;
        if (
          !response.ok
          || responseData?.status
          || responseData?.errors
          || !this.hasRenderedSections(responseData, cartContext.sections)
        ) {
          throw new Error('The cart response could not be confirmed.');
        }

        cartContext.drawer.renderContents(responseData);
        if (!this.isCurrentOperation(operationSequence)) return;

        this.pending = false;
        this.operationController = null;
        this.setPendingState(false);
        this.clearSelections();
        this.announce(
          entries.length === 1
            ? 'Selected piece was added to your cart.'
            : 'Selected pieces were added to your cart.'
        );
      } catch (error) {
        if (error.name === 'AbortError' || !this.isCurrentOperation(operationSequence)) return;
        await this.reconcileFailure(
          operationSequence,
          entries.map(entry => entry.id),
          preRequestQuantities
        );
      }
    }

    getCartContext() {
      const drawer = document.querySelector('cart-drawer');
      if (
        !drawer?.isConnected
        || typeof drawer.getSectionsToRender !== 'function'
        || typeof drawer.renderContents !== 'function'
      ) {
        return null;
      }

      const sections = drawer.getSectionsToRender();
      const validSections = Array.isArray(sections)
        ? sections.filter(section => section?.section && section?.selector)
        : [];
      return validSections.length ? { drawer, sections: validSections } : null;
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

    async reconcileFailure(operationSequence, submittedVariantIds, preRequestQuantities) {
      try {
        const cartContext = this.getCartContext();
        if (!cartContext || !this.isCurrentOperation(operationSequence)) {
          throw new Error('Cart reconciliation is unavailable.');
        }

        const [sections, cart] = await Promise.all([
          this.fetchRenderedSections(cartContext.sections, this.operationController.signal),
          this.fetchCartState(this.operationController.signal),
        ]);
        if (!this.isCurrentOperation(operationSequence)) return;

        cartContext.drawer.renderContents({ ...cart, sections });
        this.clearSelectionsConfirmedAdded(cart, submittedVariantIds, preRequestQuantities);
      } catch (error) {
        if (error.name === 'AbortError' || !this.isCurrentOperation(operationSequence)) return;
      }

      if (!this.isCurrentOperation(operationSequence)) return;
      this.pending = false;
      this.operationController = null;
      this.setPendingState(false);
      this.updateSelectionSummary();
      this.setError("We couldn't confirm every selected item. Please review your cart and try again.");
    }

    async fetchRenderedSections(sections, signal) {
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

    getVariantQuantityMap(cart) {
      const quantities = new Map();
      cart.items.forEach(item => {
        const variantId = this.parseVariantId(item.variant_id ?? item.id);
        const quantity = Number(item.quantity);
        if (!variantId || !Number.isSafeInteger(quantity) || quantity < 0) return;
        quantities.set(variantId, (quantities.get(variantId) || 0) + quantity);
      });
      return quantities;
    }

    clearSelectionsConfirmedAdded(cart, submittedVariantIds, preRequestQuantities) {
      if (!(preRequestQuantities instanceof Map)) return;
      const submitted = new Set(submittedVariantIds);
      const currentQuantities = this.getVariantQuantityMap(cart);
      this.querySelectorAll(`${SELECT_CONTROL}:checked`).forEach(control => {
        const variantId = this.parseVariantId(control.dataset.variantId);
        const previousQuantity = preRequestQuantities.get(variantId) || 0;
        const currentQuantity = currentQuantities.get(variantId) || 0;
        if (!submitted.has(variantId) || currentQuantity <= previousQuantity) return;
        control.checked = false;
        control.closest(PRODUCT)?.classList.remove('is-selected');
      });
    }

    setPendingState(isPending) {
      const action = this.querySelector('[data-sa-build-set-action]');
      const addButton = this.querySelector('[data-sa-build-set-add]');
      const label = this.querySelector('[data-sa-build-set-add-label]');
      if (action) action.setAttribute('aria-busy', String(isPending));
      const activePanel = this.getActiveSetupPanel();
      activePanel?.querySelectorAll(SELECT_CONTROL).forEach(control => {
        control.disabled = isPending || control.dataset.duplicateVariant === 'true';
      });

      if (addButton) {
        addButton.disabled = isPending || this.getSelectedEntries().length === 0;
      }
      if (label && addButton) {
        label.textContent = isPending
          ? addButton.dataset.loadingLabel
          : addButton.dataset.defaultLabel;
      }
    }

    isCurrentOperation(operationSequence) {
      return Boolean(
        this.initialized
        && this.isConnected
        && this.operationController
        && operationSequence === this.operationSequence
      );
    }

    async parseJsonResponse(response) {
      try {
        return await response.json();
      } catch (error) {
        return null;
      }
    }

    clearError() {
      const error = this.querySelector('[data-sa-build-set-error]');
      if (!error) return;
      error.hidden = true;
      error.textContent = '';
    }

    setError(message) {
      const error = this.querySelector('[data-sa-build-set-error]');
      if (!error) return;
      error.textContent = message;
      error.hidden = false;
    }

    announce(message) {
      const status = this.querySelector('[data-sa-build-set-status]');
      if (status) status.textContent = message;
    }
  }

  customElements.define('sa-build-the-set', SaBuildTheSet);
})();
