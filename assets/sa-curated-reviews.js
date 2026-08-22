if (!customElements.get("sa-curated-reviews")) {
  class SaCuratedReviews extends HTMLElement {
    connectedCallback() {
      this.initialize();
    }

    disconnectedCallback() {
      this.destroy();
    }

    initialize() {
      if (this.swiper || this.dataset.saInitialized === "true") return;

      this.viewport = this.querySelector("[data-sa-review-viewport]");
      this.track = this.querySelector("[data-sa-review-track]");
      this.slides = Array.from(this.querySelectorAll("[data-sa-review-slide]"));
      this.previousButton = this.querySelector("[data-sa-review-prev]");
      this.nextButton = this.querySelector("[data-sa-review-next]");
      this.indicators = Array.from(this.querySelectorAll("[data-sa-review-indicator]"));
      this.status = this.querySelector("[data-sa-review-status]");
      this.prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
      this.indicatorHandlers = [];

      if (!this.viewport || !this.track || this.slides.length < 2 || typeof window.Swiper !== "function") {
        return;
      }

      this.dataset.saInitialized = "true";
      this.classList.add("is-enhanced");
      this.viewport.classList.add("swiper");
      this.track.classList.add("swiper-wrapper");
      this.slides.forEach((slide) => slide.classList.add("swiper-slide"));

      try {
        this.swiper = new window.Swiper(this.viewport, {
          effect: "fade",
          fadeEffect: { crossFade: true },
          slidesPerView: 1,
          spaceBetween: 0,
          speed: this.prefersReducedMotion.matches ? 0 : 440,
          rewind: true,
          autoHeight: true,
          allowTouchMove: true,
          touchAngle: 45,
          threshold: 8,
          watchOverflow: true,
          autoplay: false,
          keyboard: {
            enabled: true,
            onlyInViewport: true
          },
          navigation: this.previousButton && this.nextButton ? {
            prevEl: this.previousButton,
            nextEl: this.nextButton
          } : false,
          a11y: {
            enabled: true,
            prevSlideMessage: "Previous review",
            nextSlideMessage: "Next review",
            slideLabelMessage: "Review {{index}} of {{slidesLength}}"
          },
          on: {
            init: (swiper) => this.updateState(swiper),
            slideChange: (swiper) => this.updateState(swiper),
            slideChangeTransitionStart: () => this.startTransition(),
            slideChangeTransitionEnd: () => this.endTransition()
          }
        });

        this.indicators.forEach((indicator) => {
          const handler = () => {
            const index = Number.parseInt(indicator.dataset.saReviewIndicator, 10);
            if (Number.isInteger(index)) this.swiper.slideTo(index);
          };

          indicator.addEventListener("click", handler);
          this.indicatorHandlers.push([indicator, handler]);
        });
      } catch (error) {
        this.restoreStaticPresentation();
      }
    }

    updateState(swiper) {
      const activeIndex = swiper.realIndex ?? swiper.activeIndex ?? 0;

      this.indicators.forEach((indicator, index) => {
        const isActive = index === activeIndex;
        indicator.classList.toggle("is-active", isActive);
        if (isActive) {
          indicator.setAttribute("aria-current", "true");
        } else {
          indicator.removeAttribute("aria-current");
        }
      });

      this.slides.forEach((slide, index) => {
        const isActive = index === activeIndex;
        slide.setAttribute("aria-hidden", String(!isActive));
        slide.querySelectorAll("a, button, input, select, textarea, [tabindex]").forEach((element) => {
          if (isActive) {
            if (element.dataset.saPreviousTabindex !== undefined) {
              const previousTabindex = element.dataset.saPreviousTabindex;
              if (previousTabindex) element.setAttribute("tabindex", previousTabindex);
              else element.removeAttribute("tabindex");
              delete element.dataset.saPreviousTabindex;
            }
          } else {
            if (element.dataset.saPreviousTabindex === undefined) {
              element.dataset.saPreviousTabindex = element.getAttribute("tabindex") || "";
            }
            element.setAttribute("tabindex", "-1");
          }
        });
      });

      if (this.status) {
        this.status.textContent = `Review ${activeIndex + 1} of ${this.slides.length}`;
      }
    }

    startTransition() {
      if (this.prefersReducedMotion.matches) return;
      window.clearTimeout(this.transitionTimer);
      this.classList.remove("is-transitioning");
      void this.offsetWidth;
      this.classList.add("is-transitioning");
    }

    endTransition() {
      this.transitionTimer = window.setTimeout(() => this.classList.remove("is-transitioning"), 460);
    }

    restoreStaticPresentation() {
      this.dataset.saInitialized = "false";
      this.classList.remove("is-enhanced", "is-transitioning");
      this.viewport?.classList.remove("swiper", "swiper-initialized", "swiper-horizontal", "swiper-backface-hidden");
      this.track?.classList.remove("swiper-wrapper");
      this.slides?.forEach((slide) => {
        slide.classList.remove("swiper-slide", "swiper-slide-active", "swiper-slide-next", "swiper-slide-prev");
        slide.removeAttribute("aria-hidden");
        slide.removeAttribute("style");
      });
    }

    destroy() {
      window.clearTimeout(this.transitionTimer);
      this.indicatorHandlers?.forEach(([indicator, handler]) => indicator.removeEventListener("click", handler));
      this.indicatorHandlers = [];

      if (this.swiper) {
        this.swiper.destroy(true, true);
        this.swiper = null;
      }

      this.restoreStaticPresentation();
    }
  }

  customElements.define("sa-curated-reviews", SaCuratedReviews);

  document.addEventListener("shopify:section:load", (event) => {
    event.target.querySelectorAll("sa-curated-reviews").forEach((section) => section.initialize());
  });
}
