<div align="center">

![Profilix Banner](./banner.png)

# Profilix

**A modern dashboard for public Reddit profile analytics and data aggregation.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express.js-4.x-lightgrey.svg)](https://expressjs.com/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)
[![Vibe Coded](https://img.shields.io/badge/Vibe_Coded-%E2%9C%A8-ff69b4.svg)](#)

</div>

## Overview

Profilix is a web application designed to help you aggregate and analyze public Reddit activity. It retrieves data from Reddit's official public API endpoints as well as third-party historical archives to present a comprehensive, organized timeline of a user's digital footprint.

Whether you are looking to review your own post history, gather structured analytics, or export public data to a CSV for research, Profilix provides a seamless, privacy-first interface.

## Features

- **Profile Aggregation:** View a target user's public posts and comments in one unified feed.
- **Historical Archives:** Integrates with third-party archival APIs to retrieve historical public data.
- **Interactive Analytics:** Generates dynamic charts summarizing subreddit activity patterns.
- **Data Export:** Download structured timeline data directly as a CSV file.
- **Responsive Design:** A polished dark-mode interface built for both desktop and mobile screens.
- **Privacy First:** All requests are handled locally or via server proxies. No login is required.

## Tech Stack

- **Frontend:** HTML5, Vanilla CSS, Vanilla JavaScript
- **Backend:** Node.js, Express.js (for secure cross-origin requests)
- **Visualization:** Chart.js

## Getting Started

### Prerequisites

You need [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/profilix.git
   cd profilix
   ```
2. Install the necessary dependencies:
   ```bash
   npm install
   ```
3. Start the application server:
   ```bash
   npm start
   ```
4. Open your browser and navigate to `http://localhost:3000`.

## Deployment

Profilix is designed to be easily hosted on platforms like Render, Railway, or Heroku. 

1. Create a **Web Service** on your preferred platform.
2. Connect your GitHub repository.
3. Set the Environment to `Node`.
4. Build Command: `npm install`
5. Start Command: `npm start`

## Legal and Compliance

Profilix acts strictly as an aggregator of publicly accessible data. 

- **Compliance:** We do not violate the terms of service of Reddit or any archival platforms. The tool does not bypass authentication, scrape private data, or access unauthorized endpoints.
- **Liability:** The data presented is sourced from public APIs and third-party archives. Profilix provides this information "as is" and assumes no responsibility for its absolute accuracy.

For more details, please review the included `TERMS.md` and `PRIVACY.md` files.

## License

This project is licensed under the [MIT License](LICENSE).
