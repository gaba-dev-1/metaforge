# TFT Analytics Production Deployment Guide

This guide outlines the steps to deploy the TFT Analytics platform to production using Vercel and Neon PostgreSQL.

## Prerequisites

1. A Vercel account
2. A Neon PostgreSQL database account
3. A Riot Games API key

## Deployment Steps

### 1. Set Up Neon Database

1. Create a new Neon database project at https://console.neon.tech/
2. Create a new database named `tft_analytics`
3. Run the `neon-setup.sql` script in the Neon SQL Editor
4. Copy your connection string from the dashboard which looks like:
   `postgres://username:password@ep-xxxx-xxxx.aws-region.neon.tech/neondb?sslmode=require`

### 2. Configure Environment Variables

1. Copy `.env.local.template` to `.env.local`
2. Fill in the required environment variables:
   - `RIOT_API_KEY`: Your Riot API key
   - `NEON_DATABASE_URL`: Your Neon database connection string
   - `CRON_SECRET`: A randomly generated string (use `openssl rand -hex 32`)

### 3. Test Locally (Optional)

Before deploying, you can test the setup locally:

1. Run `npm run dev` to start the development server
2. Visit `http://localhost:3000/api/debug/test-db` to check database connection
3. Visit `http://localhost:3000/api/debug/riot-api` to test Riot API connection
4. Visit `http://localhost:3000/api/setup-db` to initialize the database

### 4. Deploy to Vercel

#### Option 1: Deploy from GitHub

1. Create a private GitHub repository
2. Push your code to the GitHub repository
3. Connect your GitHub repo to Vercel
4. Configure environment variables in Vercel dashboard

#### Option 2: Deploy using Vercel CLI

1. Install Vercel CLI: `npm i -g vercel`
2. Login to Vercel: `vercel login`
3. Deploy the application: `vercel --prod`
4. Set up environment variables:
   ```
   vercel env add RIOT_API_KEY
   vercel env add NEON_DATABASE_URL
   vercel env add CRON_SECRET
   ```

### 5. Initialize the Database

After deployment, access the setup endpoint to initialize the database:
`https://your-vercel-deployment.vercel.app/api/setup-db`

### 6. Verify Deployment

1. Check your app at `https://your-vercel-deployment.vercel.app`
2. Check that the cron job is scheduled in your Vercel dashboard
3. Test APIs:
   - `/api/tft/compositions` - Should return composition data
   - `/api/tft/matches` - Should return match data
   - `/api/debug/test-db` - Should confirm database connection

## Security Notes

- Your `.env.local` file is never committed to Git
- Your Riot API key and database credentials are securely stored in Vercel environment variables
- The cron job is protected with a secret key
- The GitHub repository should be set to private

## Maintenance

- Update your Riot API key regularly (they expire)
- The system automatically cleans up old data (older than 7 days)
- Check Vercel function logs to monitor cron job execution
- If you need to reset the database, you can run the `neon-setup.sql` script again

## Troubleshooting

- **Database Connection Issues**: Check the connection string format
- **API Key Issues**: Make sure your Riot API key is valid and hasn't expired
- **Cron Job Failures**: Check the Vercel function logs
- **Empty Data**: Visit `/api/setup-db` to initialize the database with sample data
