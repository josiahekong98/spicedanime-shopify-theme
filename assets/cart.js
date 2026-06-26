// Function to generate section data
const getSectionData = (id, section, selector) => ({ id, section, selector });

// Check cart drawer and set sections to render
const cartDrawer = document.querySelector('cart-drawer');
let sectionsToRender = [];

if (cartDrawer) {
  const mainCartId = document.getElementById('main-cart-items')?.dataset.id;
  if (mainCartId) {
    sectionsToRender = [
      getSectionData(`#shopify-section-${mainCartId}`, mainCartId, `#shopify-section-${mainCartId} cart-items`),
      getSectionData("#cart-counter", "cart-counter", "#shopify-section-cart-counter"),
      getSectionData("#CartDrawer-Body", "cart-drawer", "#shopify-section-cart-drawer #CartDrawer-Body")
    ];
  } else {
    sectionsToRender = [
      getSectionData("#CartDrawer-Body", "cart-drawer", "#shopify-section-cart-drawer #CartDrawer-Body")
    ];
  }
} else {
  const mainCartId = document.getElementById('main-cart-items')?.dataset.id;
  if (mainCartId) {
    sectionsToRender = [
      getSectionData(`#shopify-section-${mainCartId}`, mainCartId, `#shopify-section-${mainCartId} cart-items`),
      getSectionData('#cart-counter', 'cart-counter', '#shopify-section-cart-counter')
    ];
  } else {
    sectionsToRender = [];
  }
}

class CartRemoveButton extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('click', event => {
      event.preventDefault();
      const cartItems =
        this.closest('cart-drawer-items') ||
        this.closest('cart-items');
      cartItems.updateQuantity(this.dataset.index, 0);
      updateFreeShipping();
    });
  }
}
customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();

    this.freeShipping = document.querySelectorAll('shipping-bar');

    this.currentItemCount = Array.from(
      this.querySelectorAll('[name="updates[]"]')
    ).reduce((total, quantityInput) => total + parseInt(quantityInput.value), 0);

    this.debouncedOnChange = debounce(event => {
      this.onChange(event);
    }, 300);
    this.addEventListener(
      'change', this.debouncedOnChange.bind(this)
    );

    updateFreeShipping();
  }

  calculateTotalItemCount(items) {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  onChange(event) {
    if (event.target.name !== 'updates[]') return;

    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute('name')
    );
  }

  getSectionsToRender() {
    return sectionsToRender;
  }

  updateQuantity(line, quantity, name) {
    this.classList.add('is-loading');

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map(section => section.section),
      sections_url: window.location.pathname
    });

    fetch(`${routes.cart_change_url}`, {
      ...fetchConfig(),
      ...{ body }
    })
      .then(response => response.text())
      .then(state => {
        const parsedState = JSON.parse(state);
        this.getSectionsToRender()?.forEach(section => {
          const elementToReplace = document.querySelector(section.selector) || document.querySelector(section.id);


          if (elementToReplace) {
            if (!parsedState.errors) {
              elementToReplace.innerHTML = this.getSectionInnerHTML(
                parsedState.sections[section.section],
                section.selector
              );
            }
          } else {
            console.error(`Element with selector ${section.selector} not found`);
          }

        });
        if (!parsedState.errors) {
          this.totalItemCount = this.calculateTotalItemCount(parsedState.items);
        }
        this.updateLiveRegions(line, parsedState.item_count, parsedState.errors);

        const lineItem = document.getElementById(`CartItem-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`))
          lineItem.querySelector(`[name="${name}"]`).focus();

        // update bar subtotal first
if (parsedState && parsedState.total_price !== undefined) {
  refreshShippingBarSubtotal(parsedState.total_price);
}

updateCartCounters();
updateFreeShipping();
sortFreeItemsToTop();



      })
      .finally(() => this.classList.remove('is-loading'));
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelector(selector).innerHTML;
  }

  updateLiveRegions(line, itemCount, parsedError) {
    if (parsedError) {
      document
        .querySelectorAll(`[data-line-item-error][data-line="${line}"]`)
        .forEach(error => {
          error.innerHTML = parsedError;
        });
    }

    this.currentItemCount = itemCount;
  }
}
customElements.define('cart-items', CartItems);

class CartDrawer extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("keyup", event => event.code.toUpperCase() === "ESCAPE" && this.close());
    this.setCartLink();
    this.parentElement.addEventListener("shopify:section:select", () => this.open());
    this.parentElement.addEventListener("shopify:section:deselect", () => this.close());
  }

  setCartLink() {
    const cartLink = document.querySelector("[data-cart-link]");
    if (cartLink) {
      cartLink.setAttribute("role", "button");
      cartLink.setAttribute("aria-haspopup", "dialog");
      cartLink.addEventListener("click", event => {
        event.preventDefault();
        this.open(cartLink);
      });
      cartLink.addEventListener("keydown", event => {
        if (event.code.toUpperCase() !== "SPACE") return;
        event.preventDefault();
        this.open(cartLink);
      });
    } else {
      console.error("Cart link not found");
    }
  }

  open(opener) {
    if (opener) this.setActiveElement(opener);
    this.classList.add("is-visible");
    document.querySelector('body').style.overflow = 'hidden';
    this.addEventListener("transitionend", () => { this.focusOnCartDrawer(); }, { once: true });

    setTimeout(() => {
      document.addEventListener("click", this.handleOutsideClick);
    }, 100);

    const productReccomendations = document.querySelector(".product-recommendations");
    if (productReccomendations) {
      if (productReccomendations.classList.contains("hidden")) {
        document.querySelector(".cart-drawer-items").classList.add("cart-drawer-items__full");
      } else {
        document.querySelector(".cart-drawer-items").classList.remove("cart-drawer-items__full");
      }
    }
  }

  close() {
    this.classList.remove("is-visible");
    document.querySelector('body').style.overflow = 'auto';
    removeTrapFocus(this.activeElement);

    document.removeEventListener("click", this.handleOutsideClick);

    const isHeaderMenuOpen = header.classList.contains("menu-open");

    if (isHeaderMenuOpen) {
      return;
    }

    // if we are on the cart page, resubmit form
    if (window.location.pathname === "/cart") {
      const cartDrawerForm = document.getElementById("CartDrawer-FormSummary");
      if (cartDrawerForm) {
        cartDrawerForm.submit();
      }
    }
  }

  handleOutsideClick = event => {
    const cartDrawerInner = this.querySelector(".cart-drawer__inner");
    if (cartDrawerInner && !cartDrawerInner.contains(event.target)) {
      this.close();
    }
  };

  setActiveElement(element) {
    this.activeElement = element;
  }

  focusOnCartDrawer() {
    const containerToTrapFocusOn = this.firstElementChild;
    const focusElement = this.querySelector("[data-drawer-close]");
    trapFocus(containerToTrapFocusOn, focusElement);
  }

  renderContents(response, open = true) {
    this.getSectionsToRender()?.forEach(section => {
      const sectionElement = document.querySelector(section.id);
      if (!sectionElement) return;
      sectionElement.innerHTML = this.getSectionInnerHTML(
        response.sections[section.section],
        section.selector
      );

      updateCartCounters();
    });
    if (!open) {
      return;
    }

    this.open();
  }

  getSectionsToRender() {
    return sectionsToRender;
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector).innerHTML;
  }
}
customElements.define("cart-drawer", CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return sectionsToRender;
  }
}
customElements.define("cart-drawer-items", CartDrawerItems);

// ----------------------
// FUNCTION FOR UPSELL
// ----------------------

function refreshShippingBarSubtotal(newSubtotal) {
  const bars = document.querySelectorAll('shipping-bar');
  bars.forEach(bar => {
    bar.dataset.cartSubtotal = newSubtotal;
  });
}

function updateFreeShipping() {
  const bars = document.querySelectorAll('shipping-bar');
  if (!bars.length) return;

  const formatMoney = cents => {
    const amount = (cents / 100).toFixed(2);
    return `$${amount}`;
  };

  bars.forEach(bar => {
    const subtotal = parseInt(bar.dataset.cartSubtotal || '0', 10);

    const lighterThreshold  = parseInt(bar.dataset.lighterThreshold  || '0', 10);
    const shippingThreshold = parseInt(bar.dataset.shippingThreshold || '0', 10);
    const toteThreshold     = parseInt(bar.dataset.toteThreshold     || '0', 10);
    const tapestryThreshold = parseInt(bar.dataset.tapestryThreshold || '0', 10);

    const topTextEl    = bar.querySelector('[data-upsell-main]');
    const bottomTextEl = bar.querySelector('[data-upsell-sub]');
    const progressLine = bar.querySelector('[data-progress-line]');

    if (!topTextEl || !bottomTextEl || !progressLine) return;

    // Progress is based on highest tier (tapestry)
    const maxThreshold = tapestryThreshold || shippingThreshold || lighterThreshold || 1;
    const progressRaw  = subtotal / maxThreshold;
    const progress     = Math.max(0, Math.min(progressRaw, 1)) * 100;

    progressLine.style.width = `calc(${progress.toFixed(2)}% + 2px)`;

    let topText   = '';
    let bottomText = '';

    if (subtotal < lighterThreshold) {
      const diff = Math.max(lighterThreshold - subtotal, 0);
      topText    = `Spend ${formatMoney(diff)} more for a free lighter`;
      bottomText = `Add more to your cart for free SpicedAnime products`;
    } else if (subtotal < shippingThreshold) {
      const diff = Math.max(shippingThreshold - subtotal, 0);
      topText    = `Spend ${formatMoney(diff)} more for a free tote bag and shipping`;
      bottomText = `Congrats! Add your free lighter to your cart!`;
    } else if (subtotal < toteThreshold) {
      const diff = Math.max(toteThreshold - subtotal, 0);
      topText    = `Spend ${formatMoney(diff)} more for a free tote bag`;
      bottomText = `Congrats! Free shipping is applied!`;
    } else if (subtotal < tapestryThreshold) {
      const diff = Math.max(tapestryThreshold - subtotal, 0);
      topText    = `Spend ${formatMoney(diff)} more for a free tapestry`;
      bottomText = `Congrats! Add your free tote bag to your cart!`;
    } else {
      topText    = `Enjoy the free additional SpicedAnime Merch!`;
      bottomText = `Congrats! Add your free tapestry to your cart!`;
    }

        topTextEl.textContent    = topText;
    bottomTextEl.textContent = bottomText;
  });
}


// ----------------------------------
// FREE ITEMS TO TOP (ALL FREE ITEMS)
// ----------------------------------

function sortFreeItemsToTop() {
  // Look for the cart drawer first, then cart page
  const container =
    document.querySelector('.cart-drawer-items') ||
    document.querySelector('cart-items');

  if (!container) return;

  const items = container.querySelectorAll('.cart-item');
  if (!items.length) return;

  const freeItems = [];
  const paidItems = [];

  items.forEach(item => {
    // Look for final visible price (handles <ins>, spans, etc.)
    const priceEl =
      item.querySelector('.cart-item__price ins') ||
      item.querySelector('.cart-item__price') ||
      item.querySelector('ins');

    if (!priceEl) {
      paidItems.push(item);
      return;
    }

    const priceText = priceEl.textContent.replace(/[^0-9.]/g, '');
    const price = parseFloat(priceText || "0");

    if (price === 0) {
      freeItems.push(item);
    } else {
      paidItems.push(item);
    }
  });

  // Rebuild cart item order
  container.innerHTML = "";
  [...freeItems, ...paidItems].forEach(node => container.appendChild(node));
}

// Make sure it runs on first load
document.addEventListener('DOMContentLoaded', updateFreeShipping);
document.addEventListener('DOMContentLoaded', sortFreeItemsToTop);

