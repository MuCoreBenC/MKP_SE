(function mkpLayoutDefaultsRuntimeBootstrap() {
  const MIN_LAYOUT_SIZE_PX = 12;
  const EMPTY_INLINE_STYLE_TOKEN = '__mkp_layout_empty__';
  const MANAGED_SELECTOR = '[data-mkp-layout-managed="true"]';

  const state = {
    observer: null,
    resizeObserver: null,
    observedContainers: new Set(),
    reapplyFrame: 0
  };

  function normalizeConstraintValue(value) {
    if (value === '' || value === null || value === undefined) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.round(parsed);
  }

  function normalizeConstraints(constraints) {
    const next = {
      left: normalizeConstraintValue(constraints && constraints.left),
      right: normalizeConstraintValue(constraints && constraints.right),
      top: normalizeConstraintValue(constraints && constraints.top),
      bottom: normalizeConstraintValue(constraints && constraints.bottom)
    };

    const hasAny = Object.values(next).some((value) => value !== undefined);
    return hasAny ? next : null;
  }

  function normalizeLayout(layout) {
    const parsedX = Number(layout && layout.x);
    const parsedY = Number(layout && layout.y);
    const parsedWidth = Number(layout && layout.width);
    const parsedHeight = Number(layout && layout.height);
    const constraints = normalizeConstraints(layout && layout.constraints);

    return {
      x: Number.isFinite(parsedX) ? Math.round(parsedX) : 0,
      y: Number.isFinite(parsedY) ? Math.round(parsedY) : 0,
      width: Number.isFinite(parsedWidth) && parsedWidth > 0 ? Math.max(MIN_LAYOUT_SIZE_PX, Math.round(parsedWidth)) : null,
      height: Number.isFinite(parsedHeight) && parsedHeight > 0 ? Math.max(MIN_LAYOUT_SIZE_PX, Math.round(parsedHeight)) : null,
      constraints
    };
  }

  function cloneLayoutMap(map) {
    const next = {};
    Object.entries(map && typeof map === 'object' ? map : {}).forEach(([key, value]) => {
      if (!key) return;
      next[key] = normalizeLayout(value);
    });
    return next;
  }

  function getLayouts() {
    return cloneLayoutMap(window.__MKP_LAYOUT_DEFAULTS__ || {});
  }

  function resolveElementByKey(key) {
    if (!key) return null;

    try {
      return document.querySelector(key);
    } catch (error) {
      return null;
    }
  }

  function rememberOriginalInlineDimension(element, propertyName, attributeName) {
    if (!(element instanceof HTMLElement)) return;
    if (element.hasAttribute(attributeName)) return;
    const inlineValue = element.style.getPropertyValue(propertyName);
    element.setAttribute(attributeName, inlineValue || EMPTY_INLINE_STYLE_TOKEN);
  }

  function restoreOriginalInlineDimension(element, propertyName, attributeName) {
    if (!(element instanceof HTMLElement)) return;

    const inlineValue = element.getAttribute(attributeName);
    if (!inlineValue || inlineValue === EMPTY_INLINE_STYLE_TOKEN) {
      element.style.removeProperty(propertyName);
      return;
    }

    element.style.setProperty(propertyName, inlineValue);
  }

  function captureAppliedElementState(element) {
    if (!(element instanceof Element)) return null;

    return {
      translate: element.style.translate || '',
      widthStyle: element instanceof HTMLElement ? element.style.getPropertyValue('width') : '',
      heightStyle: element instanceof HTMLElement ? element.style.getPropertyValue('height') : '',
      managed: element.getAttribute('data-mkp-layout-managed') || ''
    };
  }

  function restoreCapturedElementState(element, snapshot) {
    if (!(element instanceof Element) || !snapshot) return;

    element.style.translate = snapshot.translate || '';
    if (snapshot.managed) {
      element.setAttribute('data-mkp-layout-managed', snapshot.managed);
    } else {
      element.removeAttribute('data-mkp-layout-managed');
    }

    if (element instanceof HTMLElement) {
      if (snapshot.widthStyle) {
        element.style.setProperty('width', snapshot.widthStyle);
      } else {
        restoreOriginalInlineDimension(element, 'width', 'data-mkp-layout-origin-width');
      }

      if (snapshot.heightStyle) {
        element.style.setProperty('height', snapshot.heightStyle);
      } else {
        restoreOriginalInlineDimension(element, 'height', 'data-mkp-layout-origin-height');
      }
    }
  }

  function getConstraintContainerRect(target) {
    const parent = target && target.parentElement;
    if (parent instanceof HTMLElement) {
      const rect = parent.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    }

    return {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  function measureBaseRect(element) {
    if (!(element instanceof Element)) {
      return {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0
      };
    }

    const snapshot = captureAppliedElementState(element);
    element.style.translate = '';
    element.removeAttribute('data-mkp-layout-managed');

    if (element instanceof HTMLElement) {
      restoreOriginalInlineDimension(element, 'width', 'data-mkp-layout-origin-width');
      restoreOriginalInlineDimension(element, 'height', 'data-mkp-layout-origin-height');
    }

    const rect = element.getBoundingClientRect();
    restoreCapturedElementState(element, snapshot);
    return rect;
  }

  function resolveEffectiveLayoutForElement(element, layout) {
    const normalized = normalizeLayout(layout);
    if (!normalized.constraints) {
      return normalized;
    }

    const baseRect = measureBaseRect(element);
    const containerRect = getConstraintContainerRect(element);
    const next = {
      ...normalized
    };

    let visualWidth = normalized.width ?? Math.round(baseRect.width);
    let visualHeight = normalized.height ?? Math.round(baseRect.height);

    if (normalized.constraints.left !== undefined && normalized.constraints.right !== undefined) {
      visualWidth = Math.max(
        MIN_LAYOUT_SIZE_PX,
        Math.round(containerRect.width - normalized.constraints.left - normalized.constraints.right)
      );
    }

    if (normalized.constraints.top !== undefined && normalized.constraints.bottom !== undefined) {
      visualHeight = Math.max(
        MIN_LAYOUT_SIZE_PX,
        Math.round(containerRect.height - normalized.constraints.top - normalized.constraints.bottom)
      );
    }

    let visualLeft = baseRect.left + normalized.x;
    let visualTop = baseRect.top + normalized.y;

    if (normalized.constraints.left !== undefined) {
      visualLeft = containerRect.left + normalized.constraints.left;
    } else if (normalized.constraints.right !== undefined) {
      visualLeft = containerRect.right - normalized.constraints.right - visualWidth;
    }

    if (normalized.constraints.top !== undefined) {
      visualTop = containerRect.top + normalized.constraints.top;
    } else if (normalized.constraints.bottom !== undefined) {
      visualTop = containerRect.bottom - normalized.constraints.bottom - visualHeight;
    }

    next.x = Math.round(visualLeft - baseRect.left);
    next.y = Math.round(visualTop - baseRect.top);
    next.width = (
      normalized.width !== null ||
      normalized.constraints.left !== undefined ||
      normalized.constraints.right !== undefined
    ) ? visualWidth : null;
    next.height = (
      normalized.height !== null ||
      normalized.constraints.top !== undefined ||
      normalized.constraints.bottom !== undefined
    ) ? visualHeight : null;

    return next;
  }

  function clearManagedElementState(element) {
    if (!(element instanceof Element)) return;

    element.style.translate = '';
    element.removeAttribute('data-mkp-layout-managed');

    if (element instanceof HTMLElement) {
      restoreOriginalInlineDimension(element, 'width', 'data-mkp-layout-origin-width');
      restoreOriginalInlineDimension(element, 'height', 'data-mkp-layout-origin-height');
    }
  }

  function applyLayoutToElement(element, layout) {
    if (!(element instanceof Element)) return;

    const normalized = resolveEffectiveLayoutForElement(element, layout);
    const hasOffset = normalized.x !== 0 || normalized.y !== 0;
    const hasSize = normalized.width !== null || normalized.height !== null;

    if (hasOffset || hasSize) {
      element.setAttribute('data-mkp-layout-managed', 'true');
    } else {
      element.removeAttribute('data-mkp-layout-managed');
    }

    element.style.translate = hasOffset ? `${normalized.x}px ${normalized.y}px` : '';

    if (element instanceof HTMLElement) {
      if (hasSize) {
        rememberOriginalInlineDimension(element, 'width', 'data-mkp-layout-origin-width');
        rememberOriginalInlineDimension(element, 'height', 'data-mkp-layout-origin-height');

        if (normalized.width === null) {
          restoreOriginalInlineDimension(element, 'width', 'data-mkp-layout-origin-width');
        } else {
          element.style.setProperty('width', `${normalized.width}px`);
        }

        if (normalized.height === null) {
          restoreOriginalInlineDimension(element, 'height', 'data-mkp-layout-origin-height');
        } else {
          element.style.setProperty('height', `${normalized.height}px`);
        }
      } else {
        restoreOriginalInlineDimension(element, 'width', 'data-mkp-layout-origin-width');
        restoreOriginalInlineDimension(element, 'height', 'data-mkp-layout-origin-height');
      }
    }
  }

  function refreshObservedContainers(layouts) {
    if (!state.resizeObserver) return;

    state.observedContainers.forEach((container) => {
      try {
        state.resizeObserver.unobserve(container);
      } catch (error) {
        // Ignore stale containers.
      }
    });
    state.observedContainers.clear();

    Object.entries(layouts).forEach(([key, layout]) => {
      if (!layout || !layout.constraints) return;
      const element = resolveElementByKey(key);
      const container = element && element.parentElement;
      if (!(container instanceof Element) || state.observedContainers.has(container)) return;
      state.resizeObserver.observe(container);
      state.observedContainers.add(container);
    });
  }

  function reapplyAllLayouts() {
    const layouts = getLayouts();

    document.querySelectorAll(MANAGED_SELECTOR).forEach((element) => {
      clearManagedElementState(element);
    });

    Object.entries(layouts).forEach(([key, layout]) => {
      const element = resolveElementByKey(key);
      if (!element) return;
      applyLayoutToElement(element, layout);
    });

    refreshObservedContainers(layouts);
  }

  function scheduleReapplyLayouts() {
    if (state.reapplyFrame) return;
    state.reapplyFrame = window.requestAnimationFrame(() => {
      state.reapplyFrame = 0;
      reapplyAllLayouts();
    });
  }

  function initObservers() {
    if (!state.observer) {
      state.observer = new MutationObserver(() => {
        scheduleReapplyLayouts();
      });
      state.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    if (!state.resizeObserver && typeof ResizeObserver === 'function') {
      state.resizeObserver = new ResizeObserver(() => {
        scheduleReapplyLayouts();
      });
    }
  }

  async function shouldApplyLayoutsAtRuntime() {
    if (!window.mkpAPI || typeof window.mkpAPI.getGodModeRuntimeState !== 'function') {
      return true;
    }

    try {
      const runtime = await window.mkpAPI.getGodModeRuntimeState();
      return !(runtime && runtime.success === true && runtime.isDeveloperMode);
    } catch (error) {
      return true;
    }
  }

  async function init() {
    const shouldApply = await shouldApplyLayoutsAtRuntime();
    if (!shouldApply) {
      window.__MKP_LAYOUT_DEFAULTS_RUNTIME__ = {
        reapply: () => {},
        getLayouts
      };
      return;
    }

    initObservers();
    reapplyAllLayouts();

    window.addEventListener('resize', scheduleReapplyLayouts);
    window.__MKP_LAYOUT_DEFAULTS_RUNTIME__ = {
      reapply: scheduleReapplyLayouts,
      getLayouts
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void init();
    }, { once: true });
  } else {
    void init();
  }
})();
