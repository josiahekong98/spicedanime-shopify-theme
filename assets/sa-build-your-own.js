(() => {
  const GLOBAL_KEY = "__saBuildYourOwn";

  if (window[GLOBAL_KEY]) {
    window[GLOBAL_KEY].initAll(document);
    return;
  }

  const controllers = new WeakMap();
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const allowedExtensions = new Set(["jpg", "jpeg", "png", "webp"]);

  class SABuildYourOwn {
    constructor(root) {
      this.root = root;
      this.form = root.querySelector("form.sa-build-your-own__form");
      this.abortController = new AbortController();
      this.requestController = null;
      this.operationSequence = 0;
      this.selectedFiles = [];
      this.fileSequence = 0;
      this.currentStep = 1;
      this.pending = false;
      this.modalOpen = false;
      this.previousFocus = null;

      if (!this.form) return;

      this.modal = root.querySelector("[data-sa-modal]");
      this.modalPanel = root.querySelector("[data-sa-modal-panel]");
      this.openButton = root.querySelector("[data-sa-open]");
      this.submitButton = root.querySelector("[data-sa-submit]");
      this.submitLabel = root.querySelector("[data-sa-submit-label]");
      this.variantInput = root.querySelector("[data-sa-variant-input]");
      this.variantButtons = Array.from(root.querySelectorAll("[data-sa-variant]"));
      this.fileInput = root.querySelector("[data-sa-file-input]");
      this.fileError = root.querySelector("[data-sa-file-error]");
      this.previewList = root.querySelector("[data-sa-preview-list]");
      this.summaryThumbs = root.querySelector("[data-sa-summary-thumbs]");
      this.summaryImages = root.querySelector("[data-sa-summary-images]");
      this.summaryCount = root.querySelector("[data-sa-summary-count]");
      this.homePreview = root.querySelector("[data-sa-home-preview]");
      this.homePreviewImage = root.querySelector("[data-sa-home-preview-image]");
      this.homePreviewCount = root.querySelector("[data-sa-home-preview-count]");
      this.optionStatus = root.querySelector("[data-sa-option-status]");
      this.helper = root.querySelector("[data-sa-helper]");
      this.price = root.querySelector("[data-sa-price]");
      this.summaryVariant = root.querySelector("[data-sa-summary-variant]");
      this.summaryPrice = root.querySelector("[data-sa-summary-price]");
      this.status = root.querySelector("[data-sa-status]");
      this.nextButton = root.querySelector("[data-sa-next]");
      this.maxFiles = Number.parseInt(root.dataset.maxFiles, 10) || 3;
      this.maxFileBytes = Number.parseInt(root.dataset.maxFileBytes, 10) || 10 * 1024 * 1024;
      this.defaultSubmitLabel = this.submitButton?.dataset.label || "Add to cart";
      this.defaultPrice = root.dataset.defaultPrice || "";
      this.availableVariantIds = new Set(
        this.variantButtons
          .filter(button => button.dataset.variantAvailable === "true")
          .map(button => button.dataset.variantId)
      );

      this.bindEvents();
      this.setStep(1);
      this.updateFileUI();
      this.updateSubmitState();
    }

    bindEvents() {
      const signal = this.abortController.signal;
      this.root.addEventListener("click", event => this.handleClick(event), { signal });
      this.fileInput?.addEventListener("change", event => this.handleFileSelection(event), { signal });
      this.form.addEventListener("submit", event => this.handleSubmit(event), { signal });
      document.addEventListener("keydown", event => this.handleDocumentKeydown(event), { signal });
    }

    handleClick(event) {
      const control = event.target.closest(
        "[data-sa-open], [data-sa-close], [data-sa-next], [data-sa-back], [data-sa-variant], [data-sa-clear-files], [data-sa-remove-file]"
      );

      if (control && !this.root.contains(control)) return;

      if (control?.matches("[data-sa-open]")) {
        this.openModal();
        return;
      }

      if (control?.matches("[data-sa-close]")) {
        this.closeModal();
        return;
      }

      if (control?.matches("[data-sa-next]")) {
        this.advanceStep();
        return;
      }

      if (control?.matches("[data-sa-back]")) {
        if (this.currentStep === 1) this.closeModal();
        else this.setStep(this.currentStep - 1);
        return;
      }

      if (control?.matches("[data-sa-variant]")) {
        this.selectVariant(control);
        return;
      }

      if (control?.matches("[data-sa-clear-files]")) {
        this.clearFiles();
        return;
      }

      if (control?.matches("[data-sa-remove-file]")) {
        this.removeFile(control.dataset.saRemoveFile);
        return;
      }

      if (event.target === this.modal) this.closeModal();
    }

    openModal() {
      if (!this.modal || this.pending) return;
      this.previousFocus = document.activeElement;
      this.modal.hidden = false;
      this.modal.setAttribute("aria-hidden", "false");
      this.modalOpen = true;
      this.setStep(1);
      this.root.querySelector("[data-sa-close]")?.focus();
    }

    closeModal(returnFocus = true) {
      if (!this.modal || !this.modalOpen) return;
      this.modal.hidden = true;
      this.modal.setAttribute("aria-hidden", "true");
      this.modalOpen = false;

      if (returnFocus && this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected) {
        this.previousFocus.focus();
      }
    }

    handleDocumentKeydown(event) {
      if (!this.modalOpen || !this.modal || !this.root.isConnected) return;

      if (event.key === "Escape") {
        event.preventDefault();
        this.closeModal();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        this.modal.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(element => !element.closest("[hidden]") && element.getClientRects().length > 0);

      if (focusable.length === 0) {
        event.preventDefault();
        this.modalPanel?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    advanceStep() {
      if (this.currentStep === 1 && !this.hasValidVariant()) {
        this.showStatus("Choose an available option before continuing.", "error");
        this.variantButtons.find(button => !button.disabled)?.focus();
        return;
      }

      if (this.currentStep < 3) {
        this.setStep(this.currentStep + 1);
        return;
      }

      this.closeModal();
      this.helper.textContent = this.selectedFiles.length
        ? "You're all set - Add to Cart!"
        : "Customize complete - Add to Cart";
      this.showStatus("Customization is ready to add to cart.", "success");
      this.submitButton?.focus();
    }

    setStep(step) {
      this.currentStep = Math.min(3, Math.max(1, step));

      this.root.querySelectorAll("[data-sa-step-indicator]").forEach(indicator => {
        const active = Number(indicator.dataset.saStepIndicator) === this.currentStep;
        indicator.classList.toggle("is-active", active);
        if (active) indicator.setAttribute("aria-current", "step");
        else indicator.removeAttribute("aria-current");
      });

      this.root.querySelectorAll("[data-sa-step-panel]").forEach(panel => {
        const active = Number(panel.dataset.saStepPanel) === this.currentStep;
        panel.classList.toggle("is-active", active);
        panel.hidden = !active;
      });

      if (this.nextButton) this.nextButton.textContent = this.currentStep === 3 ? "Done" : "Next";
      if (this.currentStep === 3) this.updateFileUI();
    }

    selectVariant(button) {
      const variantId = button.dataset.variantId;
      if (button.disabled || button.dataset.variantAvailable !== "true" || !this.availableVariantIds.has(variantId)) return;

      this.variantButtons.forEach(item => {
        const selected = item === button;
        item.classList.toggle("is-active", selected);
        item.setAttribute("aria-pressed", selected ? "true" : "false");
      });

      this.variantInput.value = variantId;
      this.variantInput.dataset.variantTitle = button.dataset.variantTitle || "Selected option";
      this.optionStatus.textContent = `Option: ${button.dataset.variantTitle}`;
      this.price.textContent = button.dataset.variantPrice || this.defaultPrice;
      this.summaryVariant.textContent = button.dataset.variantTitle || "Selected option";
      this.summaryPrice.textContent = button.dataset.variantPrice || this.defaultPrice;
      this.clearStatus();
      this.updateSubmitState();
    }

    hasValidVariant() {
      return Boolean(this.variantInput?.value && this.availableVariantIds.has(this.variantInput.value));
    }

    handleFileSelection(event) {
      const incomingFiles = Array.from(event.target.files || []);
      const errors = [];

      incomingFiles.forEach(file => {
        if (this.selectedFiles.length >= this.maxFiles) {
          errors.push(`You can upload up to ${this.maxFiles} reference images.`);
          return;
        }

        const validationError = this.validateFile(file);
        if (validationError) {
          errors.push(validationError);
          return;
        }

        const duplicate = this.selectedFiles.some(
          item => item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified
        );
        if (duplicate) {
          errors.push(`${file.name} is already selected.`);
          return;
        }

        let objectUrl = null;
        try {
          objectUrl = URL.createObjectURL(file);
        } catch (_error) {
          objectUrl = null;
        }

        this.fileSequence += 1;
        this.selectedFiles.push({
          id: `file-${this.fileSequence}`,
          file,
          objectUrl
        });
      });

      event.target.value = "";
      this.showFileErrors(Array.from(new Set(errors)));
      this.updateFileUI();
    }

    validateFile(file) {
      const extension = file.name.includes(".") ? file.name.split(".").pop().toLowerCase() : "";

      if (!allowedTypes.has(file.type) || !allowedExtensions.has(extension)) {
        return `${file.name} must be a JPEG, PNG, or WebP image.`;
      }

      if (file.size <= 0) return `${file.name} is empty and cannot be uploaded.`;
      if (file.size > this.maxFileBytes) {
        return `${file.name} is larger than ${this.formatMegabytes(this.maxFileBytes)} MB.`;
      }

      return "";
    }

    validateRetainedFiles() {
      if (this.selectedFiles.length > this.maxFiles) return `Choose no more than ${this.maxFiles} reference images.`;
      return this.selectedFiles.map(item => this.validateFile(item.file)).find(Boolean) || "";
    }

    formatMegabytes(bytes) {
      return Math.round(bytes / 1048576);
    }

    removeFile(fileId) {
      const index = this.selectedFiles.findIndex(item => item.id === fileId);
      if (index < 0) return;
      this.revokeObjectUrl(this.selectedFiles[index]);
      this.selectedFiles.splice(index, 1);
      this.showFileErrors([]);
      this.updateFileUI();
    }

    clearFiles() {
      this.selectedFiles.forEach(item => this.revokeObjectUrl(item));
      this.selectedFiles = [];
      if (this.fileInput) this.fileInput.value = "";
      this.showFileErrors([]);
      this.updateFileUI();
    }

    revokeObjectUrl(item) {
      if (!item?.objectUrl) return;
      URL.revokeObjectURL(item.objectUrl);
      item.objectUrl = null;
    }

    updateFileUI() {
      if (!this.previewList) return;
      this.previewList.replaceChildren();
      this.summaryThumbs?.replaceChildren();

      this.selectedFiles.forEach((item, index) => {
        const preview = document.createElement("div");
        preview.className = "sa-build-your-own__preview-item";

        if (item.objectUrl) {
          const image = this.createPreviewImage(item.objectUrl);
          preview.appendChild(image);
        }

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "sa-build-your-own__preview-remove";
        removeButton.dataset.saRemoveFile = item.id;
        removeButton.setAttribute("aria-label", `Remove ${item.file.name}`);
        removeButton.textContent = "x";
        preview.appendChild(removeButton);
        this.previewList.appendChild(preview);

        if (item.objectUrl && this.summaryThumbs) {
          this.summaryThumbs.appendChild(this.createPreviewImage(item.objectUrl));
        }

        if (index === 0 && this.homePreviewImage) {
          if (item.objectUrl) {
            this.homePreviewImage.src = item.objectUrl;
            this.homePreviewImage.hidden = false;
          } else {
            this.homePreviewImage.removeAttribute("src");
            this.homePreviewImage.hidden = true;
          }
        }
      });

      const fileCount = this.selectedFiles.length;
      const countText = fileCount === 1 ? "1 image added" : `${fileCount} images added`;
      const summaryText = fileCount === 1 ? "1 image attached" : `${fileCount} images attached`;
      const clearButton = this.root.querySelector("[data-sa-clear-files]");

      if (clearButton) clearButton.hidden = fileCount === 0;
      if (this.homePreview) this.homePreview.hidden = fileCount === 0;
      if (this.homePreviewCount) this.homePreviewCount.textContent = fileCount ? countText : "";
      if (this.summaryImages) this.summaryImages.hidden = fileCount === 0;
      if (this.summaryCount) this.summaryCount.textContent = fileCount ? summaryText : "";

      if (fileCount === 0 && this.homePreviewImage) {
        this.homePreviewImage.removeAttribute("src");
        this.homePreviewImage.hidden = false;
      }
    }

    createPreviewImage(objectUrl) {
      const image = document.createElement("img");
      image.src = objectUrl;
      image.alt = "";
      image.width = 55;
      image.height = 55;
      image.addEventListener("error", () => {
        image.hidden = true;
      }, { once: true });
      return image;
    }

    showFileErrors(errors) {
      if (!this.fileError) return;
      this.fileError.textContent = errors.join(" ");
      this.fileError.hidden = errors.length === 0;
    }

    updateSubmitState() {
      if (!this.submitButton) return;
      const disabled = this.pending || !this.hasValidVariant();
      this.submitButton.disabled = disabled;
      this.submitButton.setAttribute("aria-disabled", disabled ? "true" : "false");
    }

    setPending(pending) {
      this.pending = pending;
      this.form.setAttribute("aria-busy", pending ? "true" : "false");
      if (this.submitLabel) this.submitLabel.textContent = pending ? "Adding..." : this.defaultSubmitLabel;
      this.updateSubmitState();
    }

    async handleSubmit(event) {
      event.preventDefault();
      if (this.pending || !this.root.isConnected) return;

      if (!this.hasValidVariant()) {
        this.showStatus("Choose an available option before adding this item.", "error");
        this.openModal();
        return;
      }

      const fileError = this.validateRetainedFiles();
      if (fileError) {
        this.showFileErrors([fileError]);
        this.showStatus("Review the selected reference images before adding this item.", "error");
        this.openModal();
        this.setStep(2);
        return;
      }

      this.clearStatus();
      this.setPending(true);
      this.operationSequence += 1;
      const operation = this.operationSequence;
      this.requestController?.abort();
      this.requestController = new AbortController();

      const formData = new FormData(this.form);
      const notesKey = "properties[Image placement notes]";
      const notes = String(formData.get(notesKey) || "").trim();
      if (notes) formData.set(notesKey, notes);
      else formData.delete(notesKey);

      this.selectedFiles.forEach((item, index) => {
        formData.append(`properties[Reference image ${index + 1}]`, item.file, item.file.name);
      });

      const cart = document.querySelector("cart-notification") || document.querySelector("cart-drawer");
      const sections = cart?.getSectionsToRender?.().map(section => section.section).filter(Boolean) || [];

      if (sections.length) {
        formData.append("sections", sections.join(","));
        formData.append("sections_url", window.location.pathname);
        cart.setActiveElement?.(this.submitButton);
      }

      try {
        const response = await fetch(this.root.dataset.cartAddUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest"
          },
          body: formData,
          signal: this.requestController.signal
        });

        const payload = await this.parseResponse(response);
        if (!response.ok || payload?.status || payload?.errors) {
          throw this.customerError(this.getShopifyError(payload));
        }

        if (!this.isCurrentOperation(operation)) return;

        const selectedTitle = this.variantInput.dataset.variantTitle || "Custom item";
        if (cart?.renderContents && payload?.sections) {
          try {
            if (typeof publish === "function" && typeof PUB_SUB_EVENTS !== "undefined") {
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: "sa-build-your-own",
                productVariantId: this.variantInput.value,
                cartData: payload
              });
            }
            cart.renderContents(payload);
            cart.classList?.remove("is-empty");
          } catch (_renderError) {
            window.location.assign(this.root.dataset.cartUrl);
            return;
          }
        } else {
          window.location.assign(this.root.dataset.cartUrl);
          return;
        }

        this.resetAfterSuccess();
        this.showStatus(`Added ${selectedTitle} to cart.`, "success");
      } catch (error) {
        if (error.name === "AbortError" || !this.isCurrentOperation(operation)) return;
        this.showStatus(
          error.customerMessage || "We couldn't add this custom item. Please review your selections and try again.",
          "error"
        );
      } finally {
        if (this.isCurrentOperation(operation)) {
          this.requestController = null;
          this.setPending(false);
        }
      }
    }

    async parseResponse(response) {
      try {
        return await response.json();
      } catch (_error) {
        throw this.customerError("Shopify returned an unexpected response. Please try again.");
      }
    }

    getShopifyError(payload) {
      if (typeof payload?.description === "string" && payload.description) return payload.description;
      if (typeof payload?.errors === "string" && payload.errors) return payload.errors;
      if (typeof payload?.message === "string" && payload.message !== "Cart Error") return payload.message;
      return "Shopify couldn't add this custom item. Please check the option and image files, then try again.";
    }

    customerError(message) {
      const error = new Error("Customer-facing cart error");
      error.customerMessage = message;
      return error;
    }

    isCurrentOperation(operation) {
      return this.root.isConnected && operation === this.operationSequence;
    }

    resetAfterSuccess() {
      this.closeModal(false);
      this.clearFiles();
      this.form.reset();
      this.variantInput.value = "";
      delete this.variantInput.dataset.variantTitle;
      this.variantButtons.forEach(button => {
        button.classList.remove("is-active");
        button.setAttribute("aria-pressed", "false");
      });
      this.optionStatus.textContent = "Option: not selected";
      this.helper.textContent = this.root.dataset.initialHelper || "Step 1: Tap 'Customize'";
      this.price.textContent = this.defaultPrice;
      this.summaryVariant.textContent = "None";
      this.summaryPrice.textContent = this.defaultPrice;
      this.setStep(1);
      this.updateSubmitState();
    }

    showStatus(message, state) {
      if (!this.status) return;
      this.status.textContent = message;
      this.status.classList.toggle("is-success", state === "success");
      this.status.classList.toggle("is-error", state === "error");
      this.status.setAttribute("role", state === "error" ? "alert" : "status");
      this.status.hidden = !message;
    }

    clearStatus() {
      this.showStatus("", "");
    }

    destroy() {
      this.operationSequence += 1;
      this.requestController?.abort();
      this.abortController.abort();
      this.closeModal(false);
      this.selectedFiles.forEach(item => this.revokeObjectUrl(item));
      this.selectedFiles = [];
    }
  }

  function rootsWithin(scope) {
    const roots = [];
    if (scope instanceof Element && scope.matches("[data-sa-build-your-own]")) roots.push(scope);
    scope.querySelectorAll?.("[data-sa-build-your-own]").forEach(root => roots.push(root));
    return roots;
  }

  function initAll(scope = document) {
    rootsWithin(scope).forEach(root => {
      if (!controllers.has(root)) controllers.set(root, new SABuildYourOwn(root));
    });
  }

  function destroyAll(scope) {
    rootsWithin(scope).forEach(root => {
      controllers.get(root)?.destroy();
      controllers.delete(root);
    });
  }

  const api = { initAll, destroyAll };
  window[GLOBAL_KEY] = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => initAll(document), { once: true });
  } else {
    initAll(document);
  }

  document.addEventListener("shopify:section:load", event => initAll(event.target));
  document.addEventListener("shopify:section:unload", event => destroyAll(event.target));
})();
