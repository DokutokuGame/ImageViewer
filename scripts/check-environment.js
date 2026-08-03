const { execFileSync } = require('child_process');

const MIN_NODE = [20, 18, 1];
const MAX_NODE_MAJOR = 23;
const MIN_PYTHON = [3, 10];
const MAX_PYTHON = [3, 14];

function parts(version) {
  return version.replace(/^v/u, '').split('.').map(Number);
}

function compare(left, right) {
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function validateVersions(nodeVersion, pythonVersion) {
  const errors = [];
  const node = parts(nodeVersion);
  const python = parts(pythonVersion);
  if (compare(node, MIN_NODE) < 0 || node[0] >= MAX_NODE_MAJOR) {
    errors.push(`Node.js ${nodeVersion} 不受支持；请安装 20.18.1 至 22.x（建议使用 Node.js 20 LTS）。`);
  }
  if (compare(python, MIN_PYTHON) < 0 || compare(python, MAX_PYTHON) >= 0) {
    errors.push(`Python ${pythonVersion} 不受支持；请安装 Python 3.10 至 3.13。`);
  }
  return errors;
}

function main() {
  let pythonVersion;
  try {
    pythonVersion = execFileSync(process.env.PYTHON || 'python', ['--version'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim().replace(/^Python\s+/u, '');
  } catch (_error) {
    console.error('未找到 Python。请安装 Python 3.10 至 3.13，并确保 `python` 在 PATH 中。');
    process.exitCode = 1;
    return;
  }
  const errors = validateVersions(process.version, pythonVersion);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log(`环境检查通过：Node.js ${process.version}，Python ${pythonVersion}`);
}

if (require.main === module) main();

module.exports = { validateVersions };
