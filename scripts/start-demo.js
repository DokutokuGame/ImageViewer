const { spawn } = require('child_process');
const electron = require('electron');

const child = spawn(electron, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, IMAGEVIEWER_DEMO: '1' },
});

child.on('error', (error) => {
  console.error(`Electron 启动失败：${error.message}。请检查桌面环境和系统依赖。`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Electron 被信号 ${signal} 终止。请检查桌面环境和系统日志。`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
