/**
 * The DynamicLoad class provides dynamic loading functionality for different grid types (product, collection, article).
 * This class contains common properties and methods to be inherited by subclasses.
 */
class DynamicLoad extends HTMLElement {
  constructor() {
    super();

    // Selects DOM elements for different grid types
    this.itemGrid =
      document.querySelector("#product-grid") ||
      document.querySelector("#collection-grid") ||
      document.querySelector("#article-grid");

    // Determines the grid type
    if (this.itemGrid) {
      if (this.itemGrid.id === "collection-grid") {
        this.gridType = "collection";
      } else if (this.itemGrid.id === "product-grid") {
        this.gridType = "product";
      } else if (this.itemGrid.id === "article-grid") {
        this.gridType = "article";
      } else {
        this.gridType = "unknown";
      }
    } else {
      console.error("Grid element not found.");
      return;
    }

    this.setProperties();
  }

  /**
   * A placeholder method for subclasses to set additional properties.
   */
  setProperties() {
    // Additional properties can be set here if needed
  }

  /**
   * Appends newly loaded content to the existing grid.
   * @param {string} newContent - The HTML content to append.
   * @param {boolean} prepend - Determines whether to prepend or append the content.
   */
  appendContent(newContent, prepend = false) {
    if (prepend) {
      this.itemGrid.insertAdjacentHTML("afterbegin", newContent);
    } else {
      this.itemGrid.insertAdjacentHTML("beforeend", newContent);
    }
  }

  /**
   * Updates the page URL.
   * @param {number} pageNumber - The new page number.
   */
  updateUrl(pageNumber) {
    const currentUrl = new URL(window.location.href);
    const currentUrlParams = new URLSearchParams(currentUrl.search);

    if (pageNumber === 1) {
      currentUrlParams.delete("page");
    } else {
      currentUrlParams.set("page", pageNumber);
    }

    currentUrl.search = currentUrlParams.toString();
    history.replaceState({}, "", currentUrl.toString());
  }

  /**
   * Updates the product/collection/article count.
   */
  updateItemCount() {
    let selector;
    switch (this.gridType) {
      case "product":
        selector = ".product-card";
        break;
      case "collection":
        selector = ".card-collection";
        break;
      case "article":
        selector = ".card-article";
        break;
      default:
        selector = ".card-item";
    }

    // Counts items within the itemGrid
    const itemCount = this.itemGrid.querySelectorAll(selector).length;

    if (this.gridType !== 'product') return;

    const itemCountOfAll = document.querySelector(
      `.collection-facets__product-count .product-count-of-all`
    );

    if (itemCountOfAll) {
      itemCountOfAll.innerText = itemCount;
    }
  }
}

// DynamicLoadMore Custom Element
if (!customElements.get("dynamic-load-more")) {
  class DynamicLoadMore extends DynamicLoad {
    constructor() {
      super();

      this.btnLoadMore = this.querySelector(".js-btn-load-more");
      this.observer = null;
      this.isInfinityScrollActive = false;

      this.setProperties();
      this.toggleItemsVisibility();

      // Updates properties and visibility when a Shopify section is loaded
      window.addEventListener("shopify:section:load", () => {
        this.setProperties();
        this.toggleItemsVisibility();
      });

      this.updateItemCount();

      this.btnLoadMore.addEventListener("click", (e) => {
        e.preventDefault();
        this.loadMoreItems();
      });

      // Check and initialize Infinity Scroll
      this.checkAndSetupInfinityScroll();
    }

    /**
     * Checks if infinity scroll should be set up and initializes it.
     */
    checkAndSetupInfinityScroll() {
      if (this.itemGrid) {
        const containerId =
          this.gridType === 'product' ? 'ProductGridContainer' :
          this.gridType === 'collection' ? 'CollectionGridContainer' :
          this.gridType === 'article' ? 'ArticleGridContainer' :
          null;

        if (containerId) {
          const parentContainer = this.itemGrid.closest(`#${containerId}`);

          console.log("Parent Container:", parentContainer, parentContainer.classList);

          if (parentContainer && parentContainer.classList.contains('infinity-scroll-active')) {
            console.log("Infinity Scroll is active for:", this.gridType);
            this.isInfinityScrollActive = true;
            this.setupInfinityScroll();
          } else {
            this.isInfinityScrollActive = false;
          }
        } else {
          this.isInfinityScrollActive = false;
        }
      } else {
        this.isInfinityScrollActive = false;
      }
    }

    /**
     * Sets up the Intersection Observer for infinite scrolling.
     * The observer will trigger a click on the "Load More" button when it becomes visible.
     */
    setupInfinityScroll() {
      if (!this.btnLoadMore) {
        return;
      }

      // Disconnect existing observer if it exists
      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          // Trigger click only if the button is intersecting and not currently disabled
          if (entry.isIntersecting && !this.btnLoadMore.hasAttribute('disabled')) {
            this.btnLoadMore.click();
          }
        });
      }, {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
      });

      this.observer.observe(this.btnLoadMore);
    }

    /**
     * Controls the visibility of the "Load More" button.
     */
    toggleItemsVisibility() {
      const nextPageLink = this.btnLoadMore.dataset.href;
      if (!nextPageLink) {
        this.btnLoadMore.style.display = "none";
      } else {
        this.btnLoadMore.style.display = "";
      }
    }

    /**
     * Loads more products/collections/articles.
     */
    async loadMoreItems() {
      this.btnLoadMore.setAttribute("disabled", "true");
      const nextPageLink = this.btnLoadMore.dataset.href;

      if (!nextPageLink) {
        this.btnLoadMore.removeAttribute("disabled");
        return;
      }

      try {
        const nextPageResponse = await fetch(nextPageLink);
        const nextPageText = await nextPageResponse.text();

        const nextPageHTML = new DOMParser().parseFromString(
          nextPageText,
          "text/html"
        );

        // Find the relevant grid element from the new page
        let newGridContainer;
        if (this.gridType === "product") {
          newGridContainer = nextPageHTML.querySelector("#ProductGridContainer");
        } else if (this.gridType === "collection") {
          newGridContainer = nextPageHTML.querySelector("#CollectionGridContainer");
        } else if (this.gridType === "article") {
          newGridContainer = nextPageHTML.querySelector("#ArticleGridContainer");
        }

        const newGrid = newGridContainer
          ? newGridContainer.querySelector(`#${this.gridType}-grid`)
          : null;

        if (newGrid) {
          this.appendContent(newGrid.innerHTML);
        } else {
          console.warn(`New grid element (#${this.gridType}-grid) not found in fetched page.`);
        }

        // After appending content, re-query for the button to ensure it's the current one
        this.btnLoadMore = this.querySelector(".js-btn-load-more");
        if (!this.btnLoadMore) {
          console.error("Load More button disappeared after content append. Cannot continue.");
          return;
        }

        // Find the next page button and update its href
        const nextButtonOnNewPage = nextPageHTML.querySelector(
          ".js-btn-load-more"
        );
        if (nextButtonOnNewPage) {
          const nextPageLinkNew = nextButtonOnNewPage.dataset.href;
          this.btnLoadMore.dataset.href = nextPageLinkNew;
        } else {
          this.btnLoadMore.dataset.href = "";
        }

        // Update the URL
        const currentUrl = new URL(window.location.href);
        const currentUrlParams = new URLSearchParams(currentUrl.search);
        const currentPage = parseInt(currentUrlParams.get("page"), 10) || 1;
        this.updateUrl(currentPage + 1);

        this.updateItemCount();
        this.toggleItemsVisibility();

        // If infinity scroll is active, re-setup the observer for the potentially new button
        if (this.isInfinityScrollActive) {
          this.setupInfinityScroll();
        }

      } catch (error) {
        console.error("Load more error:", error);
        // Show error message to the user (a better UI should be used instead of alert)
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message p-4 bg-red-100 border border-red-400 text-red-700 rounded-md mt-4';
        errorMessage.textContent = `An error occurred: ${error.message}`;
        this.btnLoadMore.after(errorMessage);
        setTimeout(() => errorMessage.remove(), 5000);
      } finally {
        this.btnLoadMore.removeAttribute("disabled");
      }
    }
  }

  customElements.define("dynamic-load-more", DynamicLoadMore);
}

// DynamicLoadPrevious Custom Element
if (!customElements.get("dynamic-load-previous")) {
  class DynamicLoadPrevious extends DynamicLoad {
    constructor() {
      super();

      this.btnLoadPrevious = this.querySelector(".js-btn-load-previous");
      this.setProperties();
      this.checkPageParameter();

      // Updates properties and page parameter when a Shopify section is loaded
      window.addEventListener("shopify:section:load", () => {
        this.setProperties();
        this.checkPageParameter();
      });

      this.updateItemCount();

      this.btnLoadPrevious.addEventListener("click", (e) => {
        e.preventDefault();
        this.loadPreviousItems();
      });
    }

    /**
     * Checks the page parameter and sets the visibility of the "Load Previous" button.
     */
    checkPageParameter() {
      const currentUrl = new URL(window.location.href);
      const currentUrlParams = new URLSearchParams(currentUrl.search);
      const currentPage = parseInt(currentUrlParams.get("page"), 10) || 1;

      if (currentPage <= 1) {
        this.btnLoadPrevious.style.display = "none";
      } else {
        this.btnLoadPrevious.style.display = "";
      }
    }

    /**
     * Loads previous products/collections/articles.
     */
    async loadPreviousItems() {
      this.btnLoadPrevious.setAttribute("disabled", "true");
      const prevPageLink = this.btnLoadPrevious.dataset.href;

      if (!prevPageLink) {
        this.btnLoadPrevious.removeAttribute("disabled");
        return;
      }

      try {
        const prevPageResponse = await fetch(prevPageLink);
        const prevPageText = await prevPageResponse.text();

        const prevPageHTML = new DOMParser().parseFromString(
          prevPageText,
          "text/html"
        );

        // Find the relevant grid element from the new page
        let newGridContainer;
        if (this.gridType === "product") {
          newGridContainer = prevPageHTML.querySelector("#ProductGridContainer");
        } else if (this.gridType === "collection") {
          newGridContainer = prevPageHTML.querySelector("#CollectionGridContainer");
        } else if (this.gridType === "article") {
          newGridContainer = prevPageHTML.querySelector("#ArticleGridContainer");
        }

        const newGrid = newGridContainer
          ? newGridContainer.querySelector(`#${this.gridType}-grid`)
          : null;

        if (newGrid) {
          this.appendContent(newGrid.innerHTML, true);
        } else {
          console.warn(`New grid element (#${this.gridType}-grid) not found in fetched page.`);
        }

        // After appending content, re-query for the button to ensure it's the current one
        this.btnLoadPrevious = this.querySelector(".js-btn-load-previous");
        if (!this.btnLoadPrevious) {
          console.error("Load Previous button disappeared after content prepend. Cannot continue.");
          return;
        }

        // Find the previous page button and update its href
        const prevButtonOnNewPage = prevPageHTML.querySelector(
          ".js-btn-load-previous"
        );
        if (prevButtonOnNewPage) {
          const prevPageLinkNew = prevButtonOnNewPage.dataset.href;
          this.btnLoadPrevious.dataset.href = prevPageLinkNew;
        } else {
          this.btnLoadPrevious.dataset.href = "";
        }

        // Update the URL
        const currentUrl = new URL(window.location.href);
        const currentUrlParams = new URLSearchParams(currentUrl.search);
        const currentPage = parseInt(currentUrlParams.get("page"), 10) || 1;
        this.updateUrl(currentPage - 1);

        this.checkPageParameter();
        this.updateItemCount();
      } catch (error) {
        console.error("Load previous error:", error);
        // Show error message to the user (a better UI should be used instead of alert)
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message p-4 bg-red-100 border border-red-400 text-red-700 rounded-md mt-4';
        errorMessage.textContent = `An error occurred: ${error.message}`;
        this.btnLoadPrevious.after(errorMessage);
        setTimeout(() => errorMessage.remove(), 5000);
      } finally {
        this.btnLoadPrevious.removeAttribute("disabled");
      }
    }
  }

  customElements.define("dynamic-load-previous", DynamicLoadPrevious);
}
