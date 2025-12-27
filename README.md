# Evencio Marketing Tools

> Source-available marketing tool for event organizers - create social media images, posters, and promotional materials.

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

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## Ecosystem

Connector strategy and ecosystem notes live in [docs/connector-ecosystem.md](docs/connector-ecosystem.md).

## Contact

Yan Malinovskiy — yanmalinovskiy@evenc.io

## License

This project is **source-available (Fair Source)** under **FSL-1.1-MIT**. See [`LICENSE.md`](./LICENSE.md).

Third-party dependencies and their licenses are listed in [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). Regenerate with `bun run third-party-notices`.

### TL;DR (plain-language summary)

**Allowed (Permitted Purpose):**
- Use, modify, and run locally / self-host for **internal use and evaluation**
- Use for **non-commercial education** and **non-commercial research**
- Use as an **agency / consultant** to deliver professional services for a client who is using the Software under these terms

**Not allowed (Competing Use) without a commercial license:**
- **Offering** this editor/SDK/template system **to third parties** as part of a **commercial product or service**
- Shipping a hosted/SaaS editor, “asset builder”, or similar functionality that makes the Software available to your users/customers
- Embedding it into commercial **platforms/marketplaces/resellers** where customers can access the functionality as part of the platform’s offering

If you’re unsure whether your use is “Competing Use”, see [`COMMERCIAL.md`](./COMMERCIAL.md).

### 2-year rolling conversion to MIT (per commit/version)

FSL applies per **version** of the software that is made available. In a git repository, treat each pushed commit as a version made available at the time it was first published.  
**Two years after a given commit was first made available, that commit is additionally available under the MIT License.** Newer commits remain under FSL until they reach the 2-year mark.

### Trademarks / branding

The license does **not** grant rights to Evencio trademarks or logos beyond attribution/origin. Public forks must rebrand before publishing. See [`TRADEMARKS.md`](./TRADEMARKS.md).
