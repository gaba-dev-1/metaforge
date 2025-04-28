#!/bin/bash
set -e

echo "Preparing for deployment..."

# 1. Make sure environment variables are set
if [ ! -f .env.local ]; then
  echo "Error: .env.local file is missing!"
  echo "Creating .env.local template - YOU MUST EDIT THIS FILE!"
  cp .env.local.template .env.local
  exit 1
fi

# 2. Test environment variables
if ! grep -q "NEON_DATABASE_URL=" .env.local || grep -q "NEON_DATABASE_URL=postgres://username:password" .env.local; then
  echo "Error: You need to set your NEON_DATABASE_URL in .env.local"
  exit 1
fi

if ! grep -q "RIOT_API_KEY=" .env.local || grep -q "RIOT_API_KEY=RGAPI-XXXXXXXX" .env.local; then
  echo "Error: You need to set your RIOT_API_KEY in .env.local"
  exit 1
fi

if ! grep -q "CRON_SECRET=" .env.local || grep -q "CRON_SECRET=your-super-secure" .env.local; then
  echo "Error: You need to set your CRON_SECRET in .env.local"
  exit 1
fi

# 3. Test database connection
echo "Testing database connection..."
node -e "
const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  try {
    console.log('Connecting to database...');
    const pool = new Pool({
      connectionString: process.env.NEON_DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    
    const result = await pool.query('SELECT NOW() as time');
    console.log('Database connection successful!');
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
" || { echo "Database connection failed. Please check your NEON_DATABASE_URL"; exit 1; }

# 4. Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# 5. Run type check
echo "Running type check..."
npx tsc --noEmit

# 6. Build the application
echo "Building the application..."
npm run build

# 7. Login to Vercel if not already
if ! npx vercel whoami > /dev/null 2>&1; then
  echo "Not logged in to Vercel. Please login:"
  npx vercel login
fi

# 8. Deploy to Vercel
echo "Deploying to Vercel..."
npx vercel --prod

echo "Deployment completed successfully!"
echo ""
echo "IMPORTANT: Don't forget to set these environment variables in Vercel:"
echo "- RIOT_API_KEY"
echo "- NEON_DATABASE_URL"
echo "- CRON_SECRET"
echo ""
echo "After deployment, initialize the database by visiting: https://your-app.vercel.app/api/setup-db"
