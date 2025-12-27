# Contributing to Evencio Marketing Tools

Thank you for your interest in contributing to Evencio Marketing Tools! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions. We're building something together.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/evencio-marketing-tools.git`
3. Install dependencies: `bun install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development

```bash
# Start development server
bun run dev

# Run linting
bun run lint

# Fix lint issues
bun run lint:fix

# Format code
bun run format

# Run tests
bun run test
```

## Code Style

- We use [Biome](https://biomejs.dev/) for linting and formatting
- Run `bun run lint:fix` before committing
- Use TypeScript for all new code
- Follow existing patterns in the codebase

## Commit Messages

Use conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

Example: `feat: add instagram story template`

## Pull Requests

1. Update your branch with main: `git rebase main`
2. Ensure all tests pass: `bun run test`
3. Ensure linting passes: `bun run lint`
4. Push your branch and create a PR
5. Fill out the PR template
6. Wait for review

## Adding New Templates

Templates are defined in `src/lib/templates/`. To add a new template:

1. Create a new template definition file
2. Add template assets to `public/templates/`
3. Register the template in the template registry
4. Add tests for the template

## Adding New Content Types

Content types (social images, posters, etc.) are modular. To add a new type:

1. Create a new route in `src/routes/create/`
2. Add editor components if needed
3. Update the template system to support the new type
4. Add export functionality in `src/lib/export/`

## Questions?

Open an issue or reach out to the maintainers. Contact: Yan Malinovskiy — yanmalinovskiy@evenc.io.

## License

By submitting a contribution (issue, PR, patch, etc.), you agree that your contribution is licensed under the same license as this repository (**FSL-1.1-MIT**, see `LICENSE.md`).

## Trademark Use

Evencio name and logos are trademarks of Evencio and are not licensed for use without permission. See `TRADEMARKS.md` for details.
