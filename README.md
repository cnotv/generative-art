# WebGameKit & Generative Art

A monorepo containing **WebGameKit** - a framework-agnostic toolkit for creating 3D games, environments, and animations - along with a personal playground for generative art and Three.js experiments.

## 🎮 Live Demo

**Main App**: [https://cnotv.github.io/generative-art/](https://cnotv.github.io/generative-art/)

**Documentation**: [https://cnotv.github.io/generative-art/docs/](https://cnotv.github.io/generative-art/docs/)

## 📦 Packages

| Package | Description |
|---------|-------------|
| [@webgamekit/threejs](./packages/threejs) | Three.js + Rapier physics integration |
| [@webgamekit/controls](./packages/controls) | Multi-input controller (keyboard, gamepad, touch) |
| [@webgamekit/animation](./packages/animation) | Timeline-based animation system |
| [@webgamekit/game](./packages/game) | Reactive game state management |
| [@webgamekit/audio](./packages/audio) | Audio playback utilities |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/cnotv/generative-art.git
cd generative-art

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Run tests
pnpm test:unit

# Build for production
pnpm build
```

## 📖 Documentation

Documentation is built with Docusaurus and hosted on GitHub Pages.

```bash
# Start documentation locally
pnpm docs:dev

# Build documentation
pnpm docs:build
```

## 🛠️ Development

### Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server |
| `pnpm host` | Start dev server accessible on network |
| `pnpm build` | Build for production |
| `pnpm test:unit` | Run unit tests |
| `pnpm lint` | Lint and fix code |
| `pnpm docs:dev` | Start documentation server |
| `pnpm docs:build` | Build documentation |

### Project Structure

```
generative-art/
├── packages/              # Reusable @webgamekit packages
│   ├── threejs/          # Three.js + Rapier core
│   ├── controls/         # Input controllers
│   ├── animation/        # Animation system
│   ├── game/             # Game state
│   └── audio/            # Audio utilities
├── src/                  # Main Vue.js application
│   └── views/            # Route-based 3D scenes
├── documentation/        # Docusaurus documentation site
└── scripts/              # Build and utility scripts
```

## 🐳 Docker

```bash
docker-compose up
```

## 📄 License

MIT
