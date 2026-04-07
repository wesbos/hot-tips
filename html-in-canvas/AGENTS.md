<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, but it invokes Vite through `vp dev` and `vp build`.

## Vite+ Workflow

`vp` is a global binary that handles the full development lifecycle. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

### Start

- create - Create a new project from a template
- migrate - Migrate an existing project to Vite+
- config - Configure hooks and agent integration
- staged - Run linters on staged files
- install (`i`) - Install dependencies
- env - Manage Node.js versions

### Develop

- dev - Run the development server
- check - Run format, lint, and TypeScript type checks
- lint - Lint code
- fmt - Format code
- test - Run tests

### Execute

- run - Run monorepo tasks
- exec - Execute a command from local `node_modules/.bin`
- dlx - Execute a package binary without installing it as a dependency
- cache - Manage the task cache

### Build

- build - Build for production
- pack - Build libraries
- preview - Preview production build

### Manage Dependencies

Vite+ automatically detects and wraps the underlying package manager such as pnpm, npm, or Yarn through the `packageManager` field in `package.json` or package manager-specific lockfiles.

- add - Add packages to dependencies
- remove (`rm`, `un`, `uninstall`) - Remove packages from dependencies
- update (`up`) - Update packages to latest versions
- dedupe - Deduplicate dependencies
- outdated - Check for outdated packages
- list (`ls`) - List installed packages
- why (`explain`) - Show why a package is installed
- info (`view`, `show`) - View package information from the registry
- link (`ln`) / unlink - Manage local package links
- pm - Forward a command to the package manager

### Maintain

- upgrade - Update `vp` itself to the latest version

These commands map to their corresponding tools. For example, `vp dev --port 3000` runs Vite's dev server and works the same as Vite. `vp test` runs JavaScript tests through the bundled Vitest. The version of all tools can be checked using `vp --version`. This is useful when researching documentation, features, and bugs.

## Common Pitfalls

- **Using the package manager directly:** Do not use pnpm, npm, or Yarn directly. Vite+ can handle all package manager operations.
- **Always use Vite commands to run tools:** Don't attempt to run `vp vitest` or `vp oxlint`. They do not exist. Use `vp test` and `vp lint` instead.
- **Running scripts:** Vite+ commands take precedence over `package.json` scripts. If there is a `test` script defined in `scripts` that conflicts with the built-in `vp test` command, run it using `vp run test`.
- **Do not install Vitest, Oxlint, Oxfmt, or tsdown directly:** Vite+ wraps these tools. They must not be installed directly. You cannot upgrade these tools by installing their latest versions. Always use Vite+ commands.
- **Use Vite+ wrappers for one-off binaries:** Use `vp dlx` instead of package-manager-specific `dlx`/`npx` commands.
- **Import JavaScript modules from `vite-plus`:** Instead of importing from `vite` or `vitest`, all modules should be imported from the project's `vite-plus` dependency. For example, `import { defineConfig } from 'vite-plus';` or `import { expect, test, vi } from 'vite-plus/test';`. You must not install `vitest` to import test utilities.
- **Type-Aware Linting:** There is no need to install `oxlint-tsgolint`, `vp lint --type-aware` works out of the box.

## Review Checklist for Agents

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to validate changes.
<!--VITE PLUS END-->

## HTML-in-Canvas API Notes

This project demonstrates the experimental HTML-in-Canvas APIs described in the WICG explainer:
[https://github.com/WICG/html-in-canvas](https://github.com/WICG/html-in-canvas).

These APIs are currently behind the Chromium flag `chrome://flags/#canvas-draw-element`.

### Core primitives

- `layoutsubtree` on `<canvas>` opts children into layout/hit testing while keeping them non-visible until explicitly drawn into the canvas.
- `paint` event on `<canvas>` fires when child rendering changes. Draw operations during this event affect the current frame.
- `requestPaint()` triggers a one-shot `paint` event, similar to `requestAnimationFrame()` for continuous rendering patterns.
- `drawElementImage()` (2D), `texElementImage2D()` (WebGL), and `copyElementImageToTexture()` (WebGPU) draw canvas children (or `ElementImage`) into the canvas/texture.
- `captureElementImage()` supports `OffscreenCanvas` workflows by creating transferable snapshots.

### Behavioral constraints to remember

- `layoutsubtree` must be present on the canvas in the latest rendering update.
- The source element must be a direct child of the canvas and must generate boxes (not `display: none`).
- CSS transforms on source elements are ignored for drawing. Synchronize DOM location by applying the returned/derived transform to `element.style.transform`.
- Overflow is clipped to the element border box when drawn.
- If no destination size is provided, draw sizing defaults to preserve on-screen size/proportions in canvas coordinates.
- Calling element-draw APIs before the first snapshot is available can throw.

### Frame-timing model

- The browser snapshots canvas descendants before `paint`.
- Draw calls inside `paint` use current-frame snapshots.
- DOM changes inside `paint` are reflected in later frames, not the current one.

### Privacy and security model (high-level)

The proposal excludes security-sensitive details (for example cross-origin embedded content details and visited-link state) from paint output/invalidation to avoid information leaks through pixel readback or timing.
