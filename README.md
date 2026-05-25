<div align="center">

# ✨ Profilix

**A premium, privacy-first dashboard for real-time Reddit profile auditing, timeline aggregation, and subreddit analytics.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg)](https://expressjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Aesthetics](https://img.shields.io/badge/Design-Premium-ff2e93.svg)](#)

---

[Key Features](#key-features) • [System Architecture](#system-architecture) • [Getting Started](#getting-started) • [Reddit TOS Compliance](#reddit-tos-compliance) • [Contributing](#contributing)

</div>

---

## 🔍 Overview

**Profilix** is a self-contained, open-source user analysis engine designed for privacy audits and OSINT research. It helps you aggregate and organize any public Reddit account's digital footprint. 

Unlike standard tools, Profilix employs a **dual-pipeline fetch architecture**: it retrieves live data directly from Reddit while querying the third-party **Arctic Shift archive** in parallel to index deleted posts, removed comments, and historical footprints. 

All user data remains strictly in local memory and is visualised via interactive Chart.js widgets. Scans are 100% anonymous, safe, and require no account registration.

---

## ⚡ Key Features

* 📇 **Dual-Fetch Pipeline:** Queries live Reddit JSON feeds and Arctic Shift historical search indices concurrently.
* 👻 **Unmask Deleted/Hidden Items:** Auto-tags and highlights posts and comments that exist in the archives but are removed from the live Reddit profile.
* 📊 **Subreddit Frequency Chart:** Dynamic doughnut visualization displaying user activity distribution across subreddits.
* 🖱️ **Header Filter & Sorting:** Quick text-matching queries and sorting filters (Newest, Oldest, Top Voted) running entirely client-side.
* 📤 **Structured CSV Exports:** Download full timeline datasets with a single click.
* 🎨 **Rich Aesthetics:** Dark/light mode theme toggling, modern Outfit typography, glassmorphism card panels, interactive 3D perspective tilts, and smooth scroll triggers.
* ✉️ **Secure Mail Support:** Integrates Web3Forms for secure, clientless contact form submissions straight to support mail.

---

## 🏗️ System Architecture

Profilix separates its presentation logic from API ingestion using an unauthenticated Node.js CORS proxy:

```mermaid
graph TD
    Client[Browser Frontend (app.js)] -->|Scan/Audits| Proxy[Local Express Proxy (server.js)]
    Proxy -->|1. Public JSON API / User-Agent curl| RedditAPI[Reddit Public Endpoints]
    Proxy -->|2. Search API / User-Agent curl| ArcticShift[Arctic Shift Archive API]
    Client -->|Contact Form Submission| Web3Forms[Web3Forms API]
    Web3Forms -->|Forward Submission| Gmail[profilixsupport@gmail.com]
    
    style Client fill:#ff2e93,stroke:#fff,stroke-width:2px,color:#fff
    style Proxy fill:#8c30f5,stroke:#fff,stroke-width:2px,color:#fff
    style RedditAPI fill:#120a22,stroke:#ff4d6a,stroke-width:1px,color:#f0f0f5
    style ArcticShift fill:#120a22,stroke:#00e5ff,stroke-width:1px,color:#f0f0f5
    style Web3Forms fill:#160e2a,stroke:#6b1ac4,stroke-width:1px,color:#f0f0f5
    style Gmail fill:#000,stroke:#fff,stroke-width:1px,color:#fff
```

---

## 🚀 Getting Started

### Prerequisites
You must have [Node.js](https://nodejs.org/) installed (v18.x or higher is recommended).

### Installation & Run

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/anshkr95/profilix.git
   cd profilix
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Start the Application:**
   ```bash
   npm start
   ```
4. **Open in Browser:**
   Navigate to `http://localhost:3000` to start scanning.

---

## ⚖️ Reddit TOS Compliance

Profilix is fully committed to ethical, non-invasive data auditing. The codebase adheres strictly to Reddit's developer rules and terms of service:
* **No Authentication Bypassing:** We do not bypass login checkpoints, CAPTCHAs, or authentication firewalls. We do not access direct messages or private/moderator subreddits.
* **Strictly Public Feeds:** We only query public unauthenticated endpoints (e.g., standard `.json` profiles) exposed to standard search engine crawlers.
* **No Local Database Storage:** We do not index, crawl, or store user information in persistent data stores. Data is kept in-memory client-side and deleted instantly when the browser tab is closed.
* **Third-Party Archives:** Deleted posts/comments are requested from the community-driven **Arctic Shift** project, keeping the archival pipeline separate from Reddit's live infrastructure.

---

## 🤝 Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. 

1. Review the [Code of Conduct](CODE_OF_CONDUCT.md).
2. Follow the guidelines in our [Contributing Guide](CONTRIBUTING.md).
3. Open a Pull Request with your feature enhancements!

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
