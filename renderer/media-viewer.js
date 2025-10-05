const KEY_ESCAPE = 'Escape';
const KEY_PREV = 'ArrowLeft';
const KEY_NEXT = 'ArrowRight';

export function createMediaViewer({
  elements = {},
  mediaApi,
  getSession,
  getSessionTotal,
  setPendingIndex,
  fetchMore,
} = {}) {
  const {
    container,
    backdrop,
    closeButton,
    prevButton,
    nextButton,
    imageEl,
    videoEl,
    loadingEl,
    filenameEl,
    counterEl,
    openExternalButton,
  } = elements;

  const state = {
    isOpen: false,
    index: -1,
    sessionRequestId: 0,
    currentFile: null,
  };

  if (openExternalButton) {
    openExternalButton.disabled = true;
  }

  if (closeButton) {
    closeButton.addEventListener('click', () => close());
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => close());
  }

  if (prevButton) {
    prevButton.addEventListener('click', () => step(-1));
  }

  if (nextButton) {
    nextButton.addEventListener('click', () => step(1));
  }

  if (openExternalButton) {
    openExternalButton.addEventListener('click', () => {
      if (openExternalButton.disabled) {
        return;
      }
      const path = state.currentFile?.path;
      if (path) {
        void mediaApi?.openFile?.(path);
      }
    });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleKeydown);
  }

  return {
    openAtIndex,
    handleItemsAppended,
    reset,
    close,
    handleKeydown,
  };

  function openAtIndex(index) {
    if (typeof index !== 'number' || Number.isNaN(index)) {
      return;
    }

    const session = getSession?.();
    if (!session) {
      return;
    }

    const total = normalizeTotal(session);
    if (!total) {
      return;
    }

    const clampedIndex = Math.max(0, Math.min(index, total - 1));

    if (!container) {
      const file = session.items?.[clampedIndex];
      if (file?.path) {
        void mediaApi?.openFile?.(file.path);
      }
      return;
    }

    ensureActive(session.requestId);

    if (!Array.isArray(session.items) || clampedIndex >= session.items.length) {
      setPendingIndex?.(clampedIndex);
      showLoadingState(clampedIndex, total);
      void fetchMore?.(session);
      return;
    }

    setPendingIndex?.(null);
    showItem(clampedIndex);
  }

  function handleItemsAppended(session) {
    if (!session || session !== getSession?.()) {
      return;
    }

    const total = normalizeTotal(session);

    if (
      session.pendingIndex != null &&
      session.pendingIndex >= 0 &&
      session.pendingIndex < (session.items?.length ?? 0) &&
      state.isOpen &&
      state.sessionRequestId === session.requestId
    ) {
      showItem(session.pendingIndex);
      return;
    }

    if (!state.isOpen) {
      return;
    }

    updateNavigation(total);
  }

  function reset() {
    close(true);
  }

  function close(force = false) {
    if (!container) {
      if (!state.isOpen && !force) {
        return;
      }
      setPendingIndex?.(null);
      state.isOpen = false;
      state.index = -1;
      state.currentFile = null;
      state.sessionRequestId = 0;
      return;
    }

    setPendingIndex?.(null);

    if (!state.isOpen && !force) {
      return;
    }

    stopVideo();

    if (imageEl) {
      imageEl.src = '';
      imageEl.hidden = true;
      imageEl.alt = '';
    }

    if (videoEl) {
      videoEl.hidden = true;
      videoEl.removeAttribute('src');
    }

    if (loadingEl) {
      loadingEl.hidden = true;
    }

    if (filenameEl) {
      filenameEl.textContent = '';
    }

    if (counterEl) {
      counterEl.textContent = '';
    }

    if (openExternalButton) {
      openExternalButton.disabled = true;
    }

    delete container.dataset.active;
    container.setAttribute('aria-hidden', 'true');
    container.hidden = true;

    if (document?.body) {
      delete document.body.dataset.mediaViewerOpen;
    }

    state.isOpen = false;
    state.index = -1;
    state.currentFile = null;
    state.sessionRequestId = 0;

    updateNavigation(0);
  }

  function handleKeydown(event) {
    if (!state.isOpen) {
      return;
    }

    if (event.key === KEY_ESCAPE) {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === KEY_PREV) {
      event.preventDefault();
      step(-1);
      return;
    }

    if (event.key === KEY_NEXT) {
      event.preventDefault();
      step(1);
    }
  }

  function ensureActive(sessionRequestId) {
    if (!container) {
      return;
    }

    if (container.hidden) {
      container.hidden = false;
    }

    container.dataset.active = 'true';
    container.setAttribute('aria-hidden', 'false');

    if (document?.body) {
      document.body.dataset.mediaViewerOpen = 'true';
    }

    state.isOpen = true;
    state.sessionRequestId = sessionRequestId;
  }

  function showLoadingState(index, total) {
    ensureActive(state.sessionRequestId);
    stopVideo();

    if (imageEl) {
      imageEl.src = '';
      imageEl.hidden = true;
      imageEl.alt = '';
    }

    if (videoEl) {
      videoEl.hidden = true;
      videoEl.removeAttribute('src');
    }

    if (loadingEl) {
      loadingEl.hidden = false;
    }

    if (filenameEl) {
      filenameEl.textContent = '正在加载…';
    }

    if (counterEl) {
      if (typeof total === 'number' && total > 0) {
        const safeIndex = Math.min(index, total - 1);
        counterEl.textContent = `${safeIndex + 1} / ${total}`;
      } else {
        counterEl.textContent = '';
      }
    }

    if (openExternalButton) {
      openExternalButton.disabled = true;
    }

    state.index = index;
    state.currentFile = null;

    updateNavigation(total);
  }

  function showItem(index) {
    const session = getSession?.();
    if (!session || session.requestId === 0) {
      return;
    }

    const total = normalizeTotal(session);
    if (!total) {
      return;
    }

    const targetIndex = Math.max(0, Math.min(index, total - 1));

    if (!Array.isArray(session.items) || targetIndex >= session.items.length) {
      setPendingIndex?.(targetIndex);
      showLoadingState(targetIndex, total);
      void fetchMore?.(session);
      return;
    }

    const file = session.items[targetIndex];
    if (!file) {
      return;
    }

    ensureActive(session.requestId);
    setPendingIndex?.(null);

    if (loadingEl) {
      loadingEl.hidden = true;
    }

    stopVideo();

    const resolvedUrl =
      file.fileUrl || (file.path ? `file://${encodeURI(file.path)}` : '');

    if (file.type === 'video') {
      if (videoEl) {
        if (resolvedUrl) {
          videoEl.src = resolvedUrl;
        } else {
          videoEl.removeAttribute('src');
        }
        videoEl.hidden = false;
        videoEl.load?.();
      }
      if (imageEl) {
        imageEl.src = '';
        imageEl.hidden = true;
      }
    } else {
      if (imageEl) {
        if (resolvedUrl) {
          imageEl.src = resolvedUrl;
        } else {
          imageEl.removeAttribute('src');
        }
        imageEl.alt = file?.name || file?.path || '';
        imageEl.hidden = false;
      }
      if (videoEl) {
        videoEl.hidden = true;
        videoEl.removeAttribute('src');
      }
    }

    if (filenameEl) {
      filenameEl.textContent = file?.name || file?.path || '';
    }

    if (counterEl) {
      counterEl.textContent = `${targetIndex + 1} / ${total}`;
    }

    if (openExternalButton) {
      openExternalButton.disabled = !file?.path;
    }

    state.index = targetIndex;
    state.currentFile = file;
    state.sessionRequestId = session.requestId;

    updateNavigation(total);

    if (
      Array.isArray(session.items) &&
      targetIndex >= session.items.length - 2 &&
      session.items.length < total
    ) {
      void fetchMore?.(session);
    }
  }

  function step(delta) {
    if (!state.isOpen || typeof delta !== 'number' || !delta) {
      return;
    }

    const session = getSession?.();
    if (!session) {
      return;
    }

    const total = normalizeTotal(session);
    if (!total) {
      return;
    }

    const pendingIndex = session.pendingIndex;
    const currentIndex =
      pendingIndex != null ? pendingIndex : state.index;

    if (currentIndex < 0) {
      return;
    }

    const nextIndex = Math.max(0, Math.min(currentIndex + delta, total - 1));
    if (nextIndex === currentIndex) {
      return;
    }

    openAtIndex(nextIndex);
  }

  function updateNavigation(totalOverride) {
    if (!prevButton && !nextButton) {
      return;
    }

    const session = getSession?.();
    const pendingIndex = session?.pendingIndex;
    const activeIndex =
      pendingIndex != null ? pendingIndex : state.index;

    const total =
      typeof totalOverride === 'number' && totalOverride >= 0
        ? totalOverride
        : normalizeTotal(session);

    if (prevButton) {
      prevButton.disabled = !state.isOpen || total <= 0 || activeIndex <= 0;
    }

    if (nextButton) {
      nextButton.disabled =
        !state.isOpen || total <= 0 || activeIndex >= total - 1;
    }
  }

  function stopVideo() {
    if (!videoEl) {
      return;
    }

    try {
      videoEl.pause();
    } catch (error) {
      // Ignore pause errors so closing flow continues.
    }
    videoEl.removeAttribute('src');
    videoEl.load?.();
  }

  function normalizeTotal(session) {
    if (typeof getSessionTotal === 'function') {
      return getSessionTotal(session) || 0;
    }

    if (!session) {
      return 0;
    }

    if (typeof session.totalCount === 'number' && session.totalCount > 0) {
      return session.totalCount;
    }

    return Array.isArray(session.items) ? session.items.length : 0;
  }
}
