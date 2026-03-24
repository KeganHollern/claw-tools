# Contributing to OpenClaw Tools

First off, thank you for considering contributing to OpenClaw Tools! Your help is highly appreciated.

## Getting Started

This repository contains a collection of independent OpenClaw plugins. Each plugin lives in its own subdirectory.

### Prerequisites

To work on these plugins, you generally need:
- Node.js (Latest LTS is recommended)
- `npm`

### Local Development

1. Fork and clone the repository.
2. Navigate into the specific plugin you want to work on (e.g., `cd GrokImagine`).
3. Run `npm install` to install dependencies.
4. Make your changes in the TypeScript files.
5. You can ensure everything compiles correctly by running `npx tsc --noEmit` or `npm run build` (if available in the package's `package.json`).

## Creating a Pull Request

When submitting a PR:
1. Ensure your code compiles locally without TypeScript errors.
2. If you are adding a completely new plugin, please include a `README.md` inside its folder describing the plugin, how to install it, and the tools it exposes.
3. Keep PRs focused on one change or related set of changes at a time.
4. Fill out the Pull Request template provided.

## Code of Conduct

Please note that this project is released with a [Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## Questions?
Feel free to open an issue or reach out via the communication channels listed in the `SECURITY.md`.
