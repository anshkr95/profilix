# Contributing to Profilix

Thank you for your interest in contributing to Profilix! We welcome pull requests, bug reports, and suggestions to make this profile analyzer even better.

Please review the guidelines below to ensure a smooth contribution process.

---

## Code of Conduct
By participating in this project, you agree to abide by the terms of our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [profilixsupport@gmail.com](mailto:profilixsupport@gmail.com).

## How Can I Contribute?

### 1. Reporting Bugs
* Search the existing Issues list to make sure the bug hasn't already been reported.
* If it's a new bug, create a new issue detailing:
  - The expected behavior vs. actual behavior.
  - Steps to reproduce.
  - Browser details or console error logs.

### 2. Suggesting Enhancements
* Open an issue explaining the feature request, its use case, and potential implementation ideas.

### 3. Pull Requests
* Fork the repository and create a new branch from `main` (e.g. `feature/your-feature-name` or `bugfix/issue-id`).
* Implement your changes, keeping coding styles consistent with the rest of the codebase.
* Test your changes locally to ensure both frontend features and backend proxy routes work seamlessly.
* Submit a Pull Request (PR) describing the changes and linking to any relevant issue numbers.

---

## Local Development Workflow

1. **Fork & Clone:**
   ```bash
   git clone https://github.com/yourusername/profilix.git
   cd profilix
   ```
2. **Install Dependencies:**
   ```bash
   npm install
   ```
3. **Run Dev Server:**
   ```bash
   npm run dev
   ```
   The application will be served at `http://localhost:3000`.

4. **Verify Endpoints:**
   Ensure the Arctic Shift and Reddit proxy routes in `server.js` function correctly using a client tool like `curl` or by performing a lookup in the web UI.
