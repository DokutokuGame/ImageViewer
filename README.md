# ImageViewer

**English** | [简体中文](README.zh-CN.md)

[![Python validation](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/python.yml)
[![Node and Electron validation](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/node.yml)
[![Repository hygiene](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml/badge.svg)](https://github.com/DokutokuGame/ImageViewer/actions/workflows/repository.yml)

ImageViewer is an **early-stage** local desktop media browser. After you select an
image directory, it scans leaf directories, displays paginated thumbnails, and
provides an in-app full-size preview with previous and next navigation. Files are
read only from your local machine. A Windows x64 preview portable package is
available, but the project does not yet guarantee stability, compatibility, or
response times.

## Download

- [ImageViewer v0.1.1](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.1):
  a portable, installation-free package for Windows x64.
- After downloading the ZIP archive and its matching `.sha256` file, follow the
  [v0.1.1 release notes](docs/releases/v0.1.1.md) to verify the checksum.

The application is not code-signed, so Windows SmartScreen may display an
unknown-publisher warning. Downloads for macOS and other Windows architectures
are not currently available.

## License

The copyright owner has confirmed that the original code and documentation in
this repository are their personal contributions and are licensed under the
[MIT License](LICENSE). This license also covers the historical prototype in
`app/`. The prototype remains available as source code, but it is not the
currently supported application entry point. Third-party dependencies remain
subject to their respective licenses; see the
[license and code provenance analysis](docs/license-analysis.md) for details.

## Quick Start (Unified Entry Point)

### 1. Prerequisites

- Node.js 20.18.1 through 22.x (Node.js 20 LTS recommended) and npm 10 or later
- Python 3.10 through 3.13 (the test command also validates experimental Python
  components)
- A desktop environment that meets Electron's requirements; Linux additionally
  requires GTK/ATK and related runtime libraries

### 2. Install and Run

```bash
git clone <repository-url>
cd ImageViewer
npm ci
python -m pip install -e '.[dev]'
npm run check:env
npm run dev
```

Because `npm test` and `npm run build` run the Python tests, you must install the
Python development dependencies shown above after a fresh clone. Run all
commands from the repository root. Use `npm run dev` for development and the
first launch; `npm test` runs the Node.js and Python test suites; and
`npm run build` runs the environment check, static checks, tests, and
`npm pack --dry-run` in sequence. The build command validates package contents
without producing an installer. `npm start` is a compatibility alias for
`npm run dev`. The environment check reports the supported version range when
an installed version is unsupported.

To try the application without selecting real media, run `npm run demo`. Demo
mode provides virtual directory names and item counts in memory; it does not
contain, generate, or read media files. Application preferences are stored in
Electron's user data directory. If a selected directory is invalid, cannot be
read, or the preferences directory cannot be written, the interface or startup
dialog identifies the affected path and suggests corrective action. If Electron
does not start, first run `npm run check:env`, then confirm that the current
session has a graphical desktop and the system libraries required by Electron.

In the application window, select a local media directory, then:

1. Select one of the discovered leaf directories in the sidebar.
2. Browse the thumbnail grid; additional content loads page by page as you
   scroll.
3. Select an image to open the in-app preview, then navigate with the previous
   and next buttons or the keyboard arrow keys.
4. Use actions such as **Open Folder** to return to the system file manager.

Scanning a large directory may take some time. Start with a backed-up,
non-sensitive test directory. This project remains at an early stage and has not
completed cross-platform end-to-end validation.

## Current Implementation and Repository Layout

| Path | Status | Purpose |
| --- | --- | --- |
| `src/main/`, `renderer/` | **Primary implementation** | Electron main process, directory scanning, preference storage, and renderer UI |
| `src/image_viewer/` | Experimental component | Python/SQLite indexer and Chinese menu model; not yet integrated into the primary UI |
| `app/` | Historical prototype | Standalone Electron prototype; not the currently supported entry point |
| `tests/` | Partial coverage | Currently covers only the Python components; Electron has no automated UI tests yet |

You can validate the experimental Python components separately:

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[dev]'
pytest
```

## Platform Validation Status

| Platform | Status | Evidence |
| --- | --- | --- |
| Ubuntu 24.04 x64 | **Validated** | On August 3, 2026, `npm ci` and `npm run build` succeeded from a clean checkout without dependencies or local data; CI also uses this platform |
| Windows x64 | **Preview released** | Windows Server 2025 CI builds and verifies a freshly extracted package; a five-second startup smoke test was also completed locally on Windows x64 |
| macOS | **Not validated** | No clean-environment startup record is currently available, so support is not implied |

“Validated” refers only to the source-based workflows described above. Launching
the graphical window also requires a real desktop session. Headless CI validates
only the Electron entry point, syntax, and package contents.

See the [v0.1.1 release notes](docs/releases/v0.1.1.md) for the Windows portable
package's pinned environment, commands, validation scope, and checksum
instructions. The `Windows release package` workflow generates both the portable
package and its checksum file. Automated verification and a five-second startup
smoke test are not equivalent to a signed release or complete UI acceptance
testing.

## Continuous Integration

GitHub Actions uses Python 3.12.8 and Node.js 20.18.1, and reproduces dependency
installation, tests, static checks, and Electron package-content validation from
the repository root. The Node.js workflow uses the same `npm run check`,
`npm test`, and `npm run build` entry points as local development. The repository
hygiene workflow also checks JSON, Markdown, tracked files larger than 5 MiB, and
common secret patterns. Workflows emit logs only; they do not upload user
directories, databases, media files, or other artifacts.

The root `package-lock.json` belongs only to the current primary application. The
historical `app/` prototype does not have its own lockfile, so CI neither installs
dependencies in that directory nor searches upward and accidentally reuses the
root lockfile. Until ownership of the prototype is confirmed and a separate
lockfile is generated, CI performs syntax checks only on its own JavaScript.
Each workflow step names its actual command and working directory so failures can
be traced directly to the corresponding validation.

## Feedback and Contributions

- For a reproducible problem, use the
  [bug report template](.github/ISSUE_TEMPLATE/bug_report.yml).
- For a feature idea, use the
  [feature request template](.github/ISSUE_TEMPLATE/feature_request.yml).
- If you suspect a security issue, **do not open a public issue**. Report it
  privately according to the [security policy](SECURITY.md).
- Before submitting changes, read the [contribution guide](CONTRIBUTING.md),
  [code of conduct](CODE_OF_CONDUCT.md), and [roadmap](ROADMAP.md), then review
  the [pull request template](.github/pull_request_template.md).

Maintainers will make a reasonable effort to respond, but do not guarantee
response times, compatibility, or a release cadence before the project reaches a
stable stage.

## Project Status

- Maturity: exploratory/prototype stage (`0.x`); APIs, data formats, and product
  direction may change.
- Release: a
  [v0.1.1 Windows x64 preview portable package](https://github.com/DokutokuGame/ImageViewer/releases/tag/v0.1.1)
  is available.
- Testing: Python unit tests are available; Electron validation primarily relies
  on syntax checks and manual testing.
- Plans: see [ROADMAP.md](ROADMAP.md).
- Changes: see [CHANGELOG.md](CHANGELOG.md).
- License: original code and documentation use the [MIT License](LICENSE);
  third-party components remain subject to their respective licenses.

See the [maintenance and release evidence log](docs/maintenance-evidence.md) for
release status, public-data reporting conventions, manual review
responsibilities, and weekly reporting rules after a formal release. That log
distinguishes candidate builds from formal releases and explicitly marks data
that cannot be verified from GitHub or the Releases page as unavailable.

## v0.1.1 Post-release Validation Boundaries

v0.1.1 has been released as an early preview. Current evidence covers only a
reproducible Windows x64 build, checksum verification, fresh extraction, and a
five-second startup smoke test. Full workflows with real media, longer-term
stability, code signing, and other platforms still require validation. Future
releases must not describe the current preview evidence as stable support.
