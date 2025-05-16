<div align="center">

# ⚒️ MetaForge TFT

**Advanced Analytics for Teamfight Tactics**

![Version](https://img.shields.io/badge/version-0.1.0-green.svg)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg)
![Next.js](https://img.shields.io/badge/Next.js-15.3.2-000000.svg)

</div>

## 📋 Overview

MetaForge TFT is an analytics platform designed to provide detailed insights into Teamfight Tactics gameplay through statistical analysis and interactive tools. The application enables data-driven decision making for strategic development and optimization.

## 📌 Features

### 🧩 Team Builder
- Interactive champion positioning system with drag-and-drop functionality
- Real-time trait synergy calculation
- Item optimization recommendations
- Composition storage and sharing capabilities

### 📈 Performance Analytics
- Unit performance metrics across various team compositions
- Item efficiency analysis based on placement data
- Win rate and Top 4 placement statistics by rank tier
- Matchup analysis against meta compositions

### 🔍 Strategy Development
- Multi-conditionning metrics analysis
- Economic pattern identification
- Flexible transition options based on item components
- Counter-strategy recommendations

### 📊 Meta Analysis
- Patch-to-patch performance comparison
- Trend identification for emerging compositions
- System change impact assessment
- Adaptation strategy development

## 📁 Project Structure

```
/src
├── components/       # UI components
│   ├── ui/           # Base UI elements
│   ├── common/       # Shared components
│   ├── entity/       # TFT entity components
│   └── team-builder/ # Team builder feature
├── pages/            # Application routes
├── hooks/            # Custom React hooks
├── utils/            # Utility functions
├── mapping/          # Game data mapping
└── types/            # TypeScript definitions
```

## 📦 Dependencies

The application requires several key dependencies:

- **Core Framework**: React, Next.js
- **UI Components**: TailwindCSS, Framer Motion
- **Data Visualization**: Recharts
- **Data Management**: React Query, PostgreSQL
- **Interactive Elements**: React DnD, DnD Kit

## 🔗 Resource Integration

MetaForge incorporates assets from the [TFT-Assets](https://github.com/gaba-dev-1/tft-assets) repository, providing standardized game resources and data structures for the application's visualization and analysis systems.

<div align="center">

## 🌐 Links

[Website](https://metaforge.lol) • [Twitter](https://twitter.com/metaforgelol)

</div>
