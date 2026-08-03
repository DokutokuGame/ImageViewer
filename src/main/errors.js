function actionableFileError(error, target, action = '读取') {
  const code = error?.code;
  if (code === 'ENOENT' || code === 'ENOTDIR') {
    return `目录不存在或已被移动：${target}。请重新选择一个有效目录。`;
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return `没有权限${action}：${target}。请在系统设置中授予访问权限，或选择其他目录。`;
  }
  if (code === 'EROFS') {
    return `存储位置为只读，无法${action}：${target}。请改用可写位置。`;
  }
  return `${action}失败：${target}（${error?.message || String(error)}）。请检查路径后重试。`;
}

module.exports = { actionableFileError };
