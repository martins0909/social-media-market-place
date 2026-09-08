# Social Media Marketplace

A modern digital marketplace built with React, TypeScript, Express, MongoDB, and payment integrations.

## Features

- User authentication and admin panel
- Product catalog and shopping cart
- Secure payments with Ercaspay
- Responsive design with Tailwind CSS and shadcn/ui
- Real-time notifications

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Express.js, TypeScript, MongoDB, JWT
- **Payments**: Ercaspay
- **Deployment**: Ready for Vercel (frontend) and Render (backend)

## Getting Started

### Prerequisites

- Node.js >= 18
- MongoDB (local or Atlas)
- Ercaspay account for payments

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   cd client && npm install
   cd ../server && npm install
   ```
3. Set up environment variables (see `.env.example` in each folder)
4. Run the seed script to create admin user:
   ```bash
   cd server
   npx ts-node src/seed.ts
   ```
5. Start development servers:
   ```bash
   cd ..
   npm run dev:full
   ```

## Admin Access

Run the server seed script to provision the admin account from your local environment. Do not commit admin credentials to the repository. The admin panel is available at `/admin`.

## Project Structure

- `client/` - React frontend
- `server/` - Express backend
- `prisma/` - Database schema (if applicable)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/87937907-5f52-4ca3-9a79-930f289cb8e4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/87937907-5f52-4ca3-9a79-930f289cb8e4) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## Monorepo & Deployment (client/server)

This repository has been arranged into a monorepo layout with:

- `client/` — Vite + React frontend
- `server/` — Express + TypeScript backend

Quick local run (from repo root):

```powershell
npm run dev:full
```

Environment variables you will need to set in production:

- Server (`server`): `MONGODB_URL`, `JWT_SECRET`, `PAYSTACK_SECRET` (optional), `FRONTEND_URL`
- Server CORS: set `FRONTEND_URL` to the deployed client URL, or use comma-separated `FRONTEND_URLS` for multiple client URLs.
- Frontend (Vite): `VITE_API_URL` (set to your backend HTTPS URL)

### Deploy on Render

This repository includes `render.yaml` for the two-service deployment:

1. In Render, choose **New > Blueprint** and connect `martins0909/social-media-market-place`.
2. Review the two services: `social-media-marketplace-api` and `social-media-marketplace-client`.
3. Enter the secret values marked `sync: false`, including `MONGODB_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and payment credentials.
4. Deploy the blueprint.
5. Copy the API service URL into the client service as `VITE_API_URL`.
6. Copy the client service URL into the API service as `FRONTEND_URL`, then redeploy both services.

If configuring the client manually as a Render web service, use `client` as the root directory and `npm install && npm run build` as the build command. For the repository root, use `npm install && npm run build`; the root build script installs the client dependencies before running Vite.

The API health check is available at `/api/health`. Render static sites publish the Vite build from `client/dist`.

If you want me to also replace any other hard-coded API URLs or add CI/deployment files, tell me and I will apply those changes.
