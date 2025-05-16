# 🔮 MetaForge TFT

<p align="center">
  <img src="public/assets/logo.png" alt="MetaForge Logo" width="200" height="200" style="border-radius: 20px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
</p>

<p align="center">
  <b>Master the Convergence with Data-Driven Tactics</b>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#usage">Usage</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## 🌟 Overview

MetaForge is a comprehensive analytics platform for TeamFight Tactics players, providing real-time insights, performance tracking, and strategic guidance. Leverage patterns discovered from thousands of matches to refine your gameplay and climb the ranks.

> "Experiment with bold strategies tailored to your playstyle while leveraging patterns discovered from thousands of matches."

---

## ✨ Features

### 🧠 Strategic Tools

- **📊 Meta Report** — Analyze current top-performing compositions with detailed win rates and placement statistics
- **🔍 Stats Explorer** — Deep dive into unit, item, and trait performance metrics across different ranks
- **🧩 Team Builder** — Interactive drag-and-drop interface for crafting and analyzing team compositions with real-time synergy feedback

### 📚 Resources

- **📝 Strategy Guides** — Learn from top players with curated guides covering all aspects of the game
- **📰 Latest News** — Stay updated with patch notes, balance changes, and TFT community developments
- **👤 Player Profiles** — Track personal performance, match history, and improvement over time

### 🧮 Data Analysis

- **🏆 Trait Synergy Optimization** — Understand which trait combinations perform best in the current meta
- **📈 Item Efficiency Calculator** — Discover optimal item combinations for different units
- **📉 Performance Tracking** — Monitor your progress with detailed statistical analysis

### 🖥️ Cross-Platform

- **📱 Mobile App** — Access your stats on the go
- **🖥️ Desktop Overlay** — Get real-time insights while you play

---

## 🛠️ Tech Stack

### Frontend
- **[React](https://reactjs.org/)** — UI component library
- **[Next.js](https://nextjs.org/)** — React framework with SSR capabilities
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety and better developer experience
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first CSS framework
- **[Framer Motion](https://www.framer.com/motion/)** — Fluid animations and transitions

### Data & State Management
- **[React Query](https://tanstack.com/query/latest)** — Data fetching and caching
- **[React DnD](https://react-dnd.github.io/react-dnd/)** — Drag and drop functionality for team builder
- **[Recharts](https://recharts.org/)** — Responsive chart components

### Backend Integration
- **[Riot Games API](https://developer.riotgames.com/)** — TFT match data and statistics
- **[PostgreSQL](https://www.postgresql.org/)** — Database for user data and analytics

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- npm or yarn
- PostgreSQL (optional for full functionality)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/metaforge-tft.git
   cd metaforge-tft
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Create an `.env.local` file with required variables:
   ```
   # API Keys
   RIOT_API_KEY=your_riot_api_key
   
   # Database (optional)
   DATABASE_URL=your_postgres_connection_string
   
   # Authentication (if using)
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your_nextauth_secret
   ```

4. Run the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

---

## 📋 Usage

### Meta Report

View current top-performing team compositions, with detailed statistics on win rates, placement averages, and usage rates. Filter by patch version, rank, and region to refine your analysis.

### Team Builder

1. Drag units onto the board to create your team composition
2. View real-time trait synergy activation
3. Check synergies and predicted performance
4. Save your favorite compositions for future reference

### Stats Explorer

Explore granular statistics for all units, items, and traits. Sort and filter by various metrics to identify strong picks and counter-strategies for the current meta.

---

## 📂 Project Structure

```
/
├── components/      # React components
│   ├── auth/        # Authentication components
│   ├── common/      # Shared UI elements
│   ├── entity/      # Unit, item, trait detail components
│   ├── team-builder/ # Team composition builder
│   ├── ui/          # Base UI components
│   └── leaderboard/ # Ranking displays
├── hooks/           # Custom React hooks
├── pages/           # Next.js pages
│   ├── api/         # API routes
│   ├── auth/        # Authentication pages
│   ├── entity/      # Entity detail pages
│   ├── meta-report/ # Meta analysis
│   ├── stats-explorer/ # Statistics explorer
│   └── team-builder/ # Team builder tool
├── public/          # Static assets
│   ├── assets/      # Images and icons
│   └── mapping/     # Game data mapping files
├── styles/          # Global styles
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
│   ├── api/         # API utilities
│   ├── auth/        # Authentication helpers
│   ├── data/        # Data processing
│   └── db/          # Database utilities
└── config/          # Configuration files
```

---

## 📸 Screenshots

<div align="center">
  <img src="public/assets/screenshots/meta-report.png" alt="Meta Report" width="45%">
  <img src="public/assets/screenshots/team-builder.png" alt="Team Builder" width="45%">
</div>

<div align="center">
  <img src="public/assets/screenshots/stats-explorer.png" alt="Stats Explorer" width="45%">
  <img src="public/assets/screenshots/profile.png" alt="Profile" width="45%">
</div>

---

## 🤝 Contributing

Contributions are welcome! Feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure to update tests as appropriate and adhere to the existing coding style.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by the MetaForge Team
</p>

<p align="center">
  <a href="https://discord.gg/metaforge">Discord</a> •
  <a href="https://twitter.com/metaforge">Twitter</a> •
  <a href="https://www.metaforge.gg">Website</a>
</p>
