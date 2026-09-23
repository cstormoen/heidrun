# Heidrun

**Heidrun** is a lightweight, blazingly fast Mead Brewing tracker and management application. Built for homebrewers and mead enthusiasts, Heidrun helps you track your batches, calculate ABV, and visualize your brewing timeline with a seamless, single-page application experience.


## Features
- **Batch Tracking**: Log and monitor your mead batches from must to bottling.
- **Timeline Visualization**: Chronological sorting and tracking of brewing events.
- **ABV Calculator**: Built-in math for accurate Alcohol By Volume calculations.
- **Interactive Charts**: Visual insights into your brewing data.

## Tech Stack
- **Runtime & Server**: [Bun](https://bun.sh) (`Bun.serve()`)
- **Database**: SQLite (`bun:sqlite`)
- **Frontend**: [HTMX](https://htmx.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) & [daisyUI v5](https://daisyui.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/)

## How to Run

### Prerequisites
Make sure you have [Bun](https://bun.sh) installed on your system.

### Installation
Clone the repository and install dependencies:
```bash
bun install
```

### Development Server
Start the development server. This runs the Bun server in watch mode and concurrently runs the Tailwind CSS v4 CLI watcher:
```bash
bun run dev
```
*The app will be available at http://localhost:3000.*

### Production Build
To build the Tailwind CSS output file for production deployment:
```bash
bun run build
```

### Linting & Formatting
The project uses Biome for fast formatting and linting:
```bash
# Check formatting and lint rules
bunx biome check .

# Apply formatting and safe fixes automatically
bunx biome check --apply .
```

### Testing
Run the built-in Bun test suite:
```bash
bun test
```

## Database
The application automatically generates a local SQLite database file at `mjod.sqlite` in the project root.
