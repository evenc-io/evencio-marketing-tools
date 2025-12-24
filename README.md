# Evencio Marketing Tools

> Open-source marketing tool for event organizers - create social media images, posters, and promotional materials.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-black)](https://bun.sh)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-blue)](https://tanstack.com/start)

## Features

- **Social Media Images** - Create Instagram posts, Facebook covers, Twitter/X banners
- **Event Posters** - Design printable promotional materials
- **Template Library** - Pre-built templates for quick customization
- **Export Options** - Download as PNG, JPEG, or PDF
- **Optional Evencio Integration** - Connect your Evencio account to auto-populate event data

## Tech Stack

- **Framework**: [TanStack Start](https://tanstack.com/start) (React)
- **Runtime**: [Bun](https://bun.sh)
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com)
- **Canvas**: [Fabric.js](http://fabricjs.com)
- **State**: [Zustand](https://zustand-demo.pmnd.rs) + [TanStack Query](https://tanstack.com/query)
- **Export**: html-to-image + jsPDF

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) v1.0+

### Installation

```bash
# Clone the repository
git clone https://github.com/evenc-io/evencio-marketing-tools.git
cd evencio-marketing-tools

# Install dependencies
bun install

# Start development server
bun run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
# Build for production
bun run build

# Start production server
bun run start
```

## Project Structure

```
src/
├── routes/              # TanStack Router file-based routes
│   ├── __root.tsx       # Root layout
│   ├── index.tsx        # Landing page
│   └── create/          # Creator routes
│       ├── social-image.tsx
│       └── poster.tsx
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── editor/          # Canvas editor components
│   └── templates/       # Template preview components
├── lib/
│   ├── canvas/          # Canvas rendering logic
│   ├── export/          # Image/PDF export utilities
│   ├── templates/       # Template definitions
│   └── evencio/         # Optional Evencio API integration
├── hooks/               # Custom React hooks
├── stores/              # Zustand stores
└── types/               # TypeScript types
```

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run Biome linter |
| `bun run lint:fix` | Fix lint issues |
| `bun run format` | Format code with Biome |
| `bun run test` | Run tests |

## Snippet Rendering Fonts

Server-side snippet PNG rendering embeds font data to keep exports deterministic. To refresh the embedded fonts:

```bash
node scripts/generate-snippet-fonts.mjs
```

This script updates `server/lib/snippet-fonts.ts` and caches downloaded woff2 files in `server/assets/fonts`.

## Contributing

We welcome contributions! Please see our [Contributing Guide](.github/CONTRIBUTING.md) for details.

## Trademark

Evencio name and logos are trademarks of Evencio and are **not** licensed for use without permission. See [TRADEMARKS.md](TRADEMARKS.md).

## Ecosystem

Connector strategy and ecosystem notes live in [docs/connector-ecosystem.md](docs/connector-ecosystem.md).

## Contact

Yan Malinovskiy — yanmalinovskiy@evenc.io

## License

[MIT](LICENSE) - Yan Malinovskiy 2025
