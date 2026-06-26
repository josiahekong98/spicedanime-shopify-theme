/**
 * Intersection Observer
 * Component for multiple sections animations
 * Optimized for performance and iOS compatibility
 */

// Cache frequently used values
const MOBILE_BREAKPOINT = 750;
const DEFAULT_DELAY = 300;
const DEFAULT_DURATION = 900;

// Performance helper functions
const parseIntSafe = (value, fallback) => {
  const parsed = parseInt(value);
  return isNaN(parsed) ? fallback : parsed;
};

const isMobileDevice = () => window.innerWidth < MOBILE_BREAKPOINT;

document.querySelectorAll("[data-intersection-observer]").forEach((intersectElement, i) => {
  // Cache DOM queries
  const intersectionID = intersectElement.dataset.id;
  const observerElement = document.querySelector(`[data-id="${intersectionID}"]`);

  // Early return if observer element not found
  if (!observerElement) {
    console.warn(`Observer element not found for ID: ${intersectionID}`);
    return;
  }

  const intersectOnce = observerElement.dataset.intersectOnce !== "false";
  const observerOptions = {
    rootMargin: "0px 0px -50% 0px",
    threshold: 0,
    ...((() => {
      try {
        return JSON.parse(observerElement.dataset.intersectionObserver || "{}");
      } catch {
        return {};
      }
    })())
  };

  // Cache animation elements
  const animationBody = observerElement.querySelector(".full-width-banner__animation--body");
  const animationElements = observerElement.querySelectorAll(".full-width-banner__animation");

  const intersectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting || intersectionID !== entry.target.dataset.id) {
        return;
      }

      const isMobile = isMobileDevice();
      const allowMobileAnimation = observerElement.dataset.animationMobile !== "false";

      // Exit if mobile and mobile animation is disabled
      if (isMobile && !allowMobileAnimation) {
        return;
      }

      // Check if already animated
      if (observerElement.classList.contains("isAnimated") && intersectOnce) {
        return;
      }

      // Clear previous animation classes
      observerElement.classList.remove("inAnimation", "isAnimated");

      // Get timing values
      const animationDelay = animationBody ? parseIntSafe(animationBody.dataset.animationDelay, DEFAULT_DELAY) : DEFAULT_DELAY;
      const animationDuration = animationBody ? parseIntSafe(animationBody.dataset.animationDuration, DEFAULT_DURATION) : DEFAULT_DURATION;

      setAnimation({ observerElement, animationBody, animationElements });

      // Cleanup timeout
      const cleanupDelay = (animationElements.length * animationDelay) + (animationDelay + animationDuration);
      setTimeout(() => {
        if (observerElement.classList.contains("isAnimated") && intersectOnce) {
          intersectionObserver.unobserve(observerElement);
        } else if (observerElement.classList.contains("isAnimated") && !intersectOnce) {
          observerElement.classList.remove("isAnimated");
        }
      }, cleanupDelay);
    });
  }, observerOptions);

  intersectionObserver.observe(observerElement);

  function setAnimation(params) {
    const { observerElement, animationBody, animationElements } = params;

    if (!animationElements?.length) {
      // If no animation elements, still add isAnimated class
      observerElement.classList.add("isAnimated");
      return;
    }

    // Get base timing values
    const baseAnimationDelay = animationBody ? parseIntSafe(animationBody.dataset.animationDelay, DEFAULT_DELAY) : DEFAULT_DELAY;
    const baseAnimationDuration = animationBody ? parseIntSafe(animationBody.dataset.animationDuration, DEFAULT_DURATION) : DEFAULT_DURATION;

    // Add inAnimation class to observer element
    observerElement.classList.add("inAnimation");

    let completedAnimations = 0;
    const totalAnimations = animationElements.length;

    // Use requestAnimationFrame for better performance
    const scheduleAnimation = (element, index) => {
      const elementDelay = parseIntSafe(element.dataset.animationDelay, baseAnimationDelay);
      const elementDuration = parseIntSafe(element.dataset.animationDuration, baseAnimationDuration);
      const startDelay = (index + 1) * elementDelay;
      const endDelay = startDelay + elementDuration;

      // Start animation
      setTimeout(() => {
        requestAnimationFrame(() => {
          element.classList.add("inAnimation");
          const childElement = element.querySelector("*");
          if (childElement) {
            childElement.style.animationDuration = `${elementDuration}ms`;
          }
        });
      }, startDelay);

      // End animation
      setTimeout(() => {
        requestAnimationFrame(() => {
          const childElement = element.querySelector("*");
          if (childElement) {
            childElement.style.animationDuration = "";
            if (!childElement.style.length) {
              childElement.removeAttribute("style");
            }
          }
          element.classList.remove("inAnimation");
          element.classList.add("isAnimated");

          completedAnimations++;

          // Mark observer element as animated when all animations complete
          if (completedAnimations === totalAnimations) {
            observerElement.classList.remove("inAnimation");
            observerElement.classList.add("isAnimated");
          }
        });
      }, endDelay);
    };

    // Schedule all animations
    animationElements.forEach((element, i) => {
      if (element) {
        scheduleAnimation(element, i);
      }
    });
  }
});
