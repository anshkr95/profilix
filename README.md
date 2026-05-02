# Profilix 🚀
**Next-Gen Reddit Profile Analyzer**

Profilix is a multi-layered intelligence dashboard for inspecting public Reddit footprints. It aggregates live data, archival snapshots, and dynamic analytics into a premium, responsive interface.

## 🌟 Features
- **Ultra-Fast Scan**: Retrieve an entire user's public post and comment history in milliseconds.
- **Deep-Layer Aggregation (Hidden Content)**: Utilizing historical archives (like PullPush) to uncover content that may have been deleted or removed from the live site.
- **Visual Analytics**: Interactive charts to visualize a user's subreddit activity and posting behavior.
- **Export to CSV**: Download organized data directly to your machine.
- **Privacy First**: Fully anonymous scanning. No login required. 

## 🛠️ Tech Stack
- **Frontend**: HTML5, CSS3 (Custom Glassmorphism & Animations), Vanilla JavaScript.
- **Backend**: Node.js, Express.js.
- **Data Sources**: Reddit JSON APIs, PullPush Archival APIs, TrackTheirProfile API proxy.
- **Visualization**: Chart.js.

## 🚀 How to Run Locally

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your system.

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd profilix
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open `http://localhost:3000` in your browser.

## ☁️ How to Host for Free

Since this project uses a Node.js backend to securely proxy requests, it requires a Node.js hosting environment. **Render** is an excellent free option.

1. Create a free account on [Render.com](https://render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your `profilix` repository.
4. Use the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Click **Create Web Service**. Your app will be live within a few minutes!

## ⚖️ Legal & Compliance
**Profilix does not violate Reddit's Terms of Service.** 
We do not bypass authentication, scrape private data, or access unauthorized endpoints. All data retrieved by Profilix is either publicly available via standard endpoints or legally archived by third-party historical databases. 

For more details, please refer to the `TERMS.md` and `PRIVACY.md` files.
