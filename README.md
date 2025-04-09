# MetaForge - Tactician's Toolkit

## Key Features

- **Meta Report**: View tier lists of units, traits, items, and compositions
- **Stats Explorer**: Detailed statistics and filtering for all in-game entities
- **Team Builder**: Interactive drag-and-drop team building tool
- **Entity Pages**: Detailed information about units, traits, items, and compositions

## Project Structure

```
src/
├── components/         # All reusable components
│   ├── common/         # Shared components like banners, carousels
│   ├── entity/         # Entity detail components (units, traits, items)
│   ├── team-builder/   # Team builder specific components
│   └── ui/             # Base UI components (card, button, etc.)
├── mapping/            # Data mapping files
├── pages/              # Page components (Next.js routing)
│   ├── api/            # API routes
│   ├── entity/         # Entity detail pages
│   ├── meta-report/    # Meta report pages
│   ├── stats-explorer/ # Stats explorer pages
│   └── team-builder/   # Team builder pages
├── styles/             # Global styles
├── types/              # TypeScript type definitions
└── utils/              # Utility functions and hooks
    ├── api.ts          # API utility functions
    ├── dataProcessing.ts # Data transformation utilities
    ├── paths.ts        # Path utilities
    └── useTftData.ts   # Data fetching and processing hook
```

## Dependencies

- Next.js
- React
- TanStack Query (React Query)
- React DnD
- Tailwind CSS
- Lucide React (for icons)
- Recharts (for charts)
- Axios
- Lodash
