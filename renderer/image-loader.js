const activeTasks = new Map();

self.addEventListener('message', async (event) => {
  const data = event.data || {};
  const { id, url, type } = data;

  if (!id) {
    return;
  }

  if (type === 'cancel') {
    cancelTask(id);
    return;
  }

  if (!url) {
    postMessage({ id, error: '缺少图片地址' });
    return;
  }

  if (activeTasks.has(id)) {
    cancelTask(id);
  }

  const controller = new AbortController();
  activeTasks.set(id, controller);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`图片请求失败（${response.status}）`);
    }

    const blob = await response.blob();
    activeTasks.delete(id);

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      postMessage({ id, bitmap }, [bitmap]);
      return;
    }

    const buffer = await blob.arrayBuffer();
    postMessage({ id, buffer, type: blob.type }, [buffer]);
  } catch (error) {
    activeTasks.delete(id);
    if (error?.name === 'AbortError') {
      postMessage({ id, aborted: true });
    } else {
      postMessage({ id, error: error?.message || '图片加载失败' });
    }
  }
});

function cancelTask(id) {
  const controller = activeTasks.get(id);
  if (controller) {
    controller.abort();
    activeTasks.delete(id);
  }
}
