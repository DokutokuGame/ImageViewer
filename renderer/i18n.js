(function initializeI18n(globalScope) {
  const translations = {
    en: {
      appTitle: 'Local Media Browser',
      selectDirectory: 'Select directory',
      selectDirectoryUnavailable: 'Select directory (unavailable)',
      savedDirectories: 'Saved directories',
      folders: 'Folders',
      noDirectorySelected: 'No directory selected',
      tagFilters: 'Tag filters',
      subfolders: 'Subfolders',
      media: 'Media',
      openInExplorer: 'Open in File Explorer',
      closePreview: 'Close preview',
      previousImage: 'Previous image',
      nextImage: 'Next image',
      openInPhotos: 'Open in system photos app',
      demoNotice: 'Demo mode only displays virtual directory metadata and does not read or write media files.',
      noSavedDirectories: 'No directories have been saved yet.',
      savedDirectoriesUnavailable: 'Saved directories are unavailable.',
      removeItem: 'Remove {label}',
      tagsAfterSelection: 'Tags will be generated automatically after you select a directory.',
      noGeneratedTags: 'No repeated keywords were found, so there are no generated tags yet.',
      all: 'All',
      noMatchingTags: 'No matching tags found.',
      excludeTag: 'Exclude tag {label}',
      excludeTagTitle: 'Exclude this tag from the tag list',
      tagExclusions: 'Tag exclusions',
      collapse: 'Collapse',
      expand: 'Expand',
      collapseTagExclusions: 'Collapse tag exclusion settings',
      expandTagExclusions: 'Expand tag exclusion settings',
      excludedTagsHelp: 'Excluded tags are hidden from the filter list and are not used to group subfolders.',
      excludedTagInput: 'Enter a tag to exclude',
      add: 'Add',
      noExcludedTags: 'No tags have been excluded.',
      restore: 'Restore',
      noFoldersForTag: 'No folders match the “{label}” tag.',
      noFoldersForSelection: 'No folders match the selected tag.',
      noMediaInSelection: 'The selected directory contains no media files.',
      selectDirectoryToStart: 'Select a directory to get started.',
      folderContextHint: 'Right-click to open this directory in the system file manager',
      openNamedDirectory: 'Open {path} in File Explorer',
      directoryOpenFailed: 'Unable to open the directory',
      directoryOpenAlert: 'Unable to open this directory in the system file manager. Make sure the path exists.',
      directoryPathCopied: 'Directory path copied:\n{path}',
      copyDirectoryPath: 'Copy the directory path:',
      savedDirectory: 'Saved directory',
      loadingSavedDirectory: 'Loading saved directory…',
      removeSavedDirectoryConfirm: 'Remove the saved directory “{label}”?',
      itemCount: '{count} items',
      noMediaInFolder: 'This folder contains no media files.',
      mediaUnavailable: 'Media files cannot be loaded in this version.',
      mediaLoadFailed: 'Unable to load media files.',
      searchTags: 'Search tags',
      confirm: 'Confirm',
      tagSort: 'Tag sorting',
      sortAlphabetically: 'Alphabetical',
      sortByCount: 'By count',
      loading: 'Loading…',
      loadingProgress: 'Loading {loaded} / {total}',
      loadingComplete: 'Loading complete',
      loadingFailed: 'Loading failed',
      video: 'Video',
      image: 'Image',
      rating: 'Rating: {rating}',
      unknownImageResult: 'Unknown image loading result',
      missingImageUrl: 'Missing image URL',
      imageLoadFailed: 'Image failed to load',
    },
    'zh-CN': {
      appTitle: '本地媒体浏览器', selectDirectory: '选择目录', selectDirectoryUnavailable: '选择目录（不可用）',
      savedDirectories: '已保存的目录', folders: '文件夹', noDirectorySelected: '尚未选择目录', tagFilters: '标签筛选',
      subfolders: '子文件夹', media: '媒体', openInExplorer: '在资源管理器中打开', closePreview: '关闭预览',
      previousImage: '上一张', nextImage: '下一张', openInPhotos: '在系统照片中打开',
      demoNotice: '演示模式仅展示虚拟目录元数据，不会读取或写入媒体文件。', noSavedDirectories: '尚未保存任何目录。',
      savedDirectoriesUnavailable: '无法获取已保存的目录。', removeItem: '移除 {label}',
      tagsAfterSelection: '选择目录后会自动生成标签。', noGeneratedTags: '未发现重复关键词，暂无生成标签。', all: '全部',
      noMatchingTags: '没有找到匹配的标签。', excludeTag: '排除标签 {label}', excludeTagTitle: '从标签列表中排除此标签',
      tagExclusions: '标签排除', collapse: '收起', expand: '展开', collapseTagExclusions: '收起标签排除设置',
      expandTagExclusions: '展开标签排除设置', excludedTagsHelp: '被排除的标签不会在筛选列表中显示，子文件夹也不会按照这些标签分组。',
      excludedTagInput: '输入要排除的标签', add: '添加', noExcludedTags: '尚未排除任何标签。', restore: '恢复',
      noFoldersForTag: '没有找到与标签“{label}”匹配的文件夹。', noFoldersForSelection: '没有找到匹配所选标签的文件夹。',
      noMediaInSelection: '所选目录中没有媒体文件。', selectDirectoryToStart: '请选择一个目录开始。',
      folderContextHint: '右键可在系统文件管理器中打开该目录', openNamedDirectory: '在资源管理器中打开 {path}',
      directoryOpenFailed: '无法打开目录', directoryOpenAlert: '无法在系统文件管理器中打开该目录，请确认路径是否存在。',
      directoryPathCopied: '已复制目录路径：\n{path}', copyDirectoryPath: '请复制目录路径：', savedDirectory: '已保存的目录',
      loadingSavedDirectory: '正在加载已保存的目录…', removeSavedDirectoryConfirm: '要移除已保存的目录“{label}”吗？',
      itemCount: '{count} 个项目', noMediaInFolder: '该文件夹中没有媒体文件。', mediaUnavailable: '当前版本无法加载媒体文件。',
      mediaLoadFailed: '无法加载媒体文件。', searchTags: '搜索标签', confirm: '确认', tagSort: '标签排序',
      sortAlphabetically: '按首字母', sortByCount: '按数量', loading: '正在加载…', loadingProgress: '加载中 {loaded} / {total}',
      loadingComplete: '加载完成', loadingFailed: '加载失败', video: '视频', image: '图片', rating: '评分：{rating}',
      unknownImageResult: '未知的图片加载结果', missingImageUrl: '缺少图片地址', imageLoadFailed: '图片加载失败',
    },
  };

  let currentLocale = 'en';

  function setLocale(locale) {
    currentLocale = Object.prototype.hasOwnProperty.call(translations, locale) ? locale : 'en';
    if (globalScope.document?.documentElement) globalScope.document.documentElement.lang = currentLocale;
    return currentLocale;
  }

  function t(key, values = {}) {
    const template = translations[currentLocale][key] ?? translations.en[key] ?? key;
    return template.replace(/\{(\w+)\}/gu, (_match, name) => String(values[name] ?? `{${name}}`));
  }

  function translateDocument(root = globalScope.document) {
    if (!root) return;
    root.querySelectorAll('[data-i18n]').forEach((node) => { node.textContent = t(node.dataset.i18n); });
    root.querySelectorAll('[data-i18n-aria-label]').forEach((node) => {
      node.setAttribute('aria-label', t(node.dataset.i18nAriaLabel));
    });
    if (root.documentElement) root.documentElement.lang = currentLocale;
  }

  const api = { t, setLocale, translateDocument, translations, getLocale: () => currentLocale };
  globalScope.ImageViewerI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
