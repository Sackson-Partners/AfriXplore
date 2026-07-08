#!/bin/bash

# AIN Platform - Development Environment Setup Script
# Run this script to set up your local development environment

set -e  # Exit on error

echo "🚀 AIN Platform - Development Setup"
echo "===================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20 or higher (current: $(node -v))"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm is not installed. Installing pnpm..."
    npm install -g pnpm@9
fi
echo "✅ pnpm $(pnpm -v)"

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo "✅ Docker $(docker -v | cut -d',' -f1 | cut -d' ' -f3)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi
echo "✅ Docker Compose"

echo ""
echo "📦 Installing dependencies..."
pnpm install

echo ""
echo "🔧 Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
    echo "⚠️  Please edit .env and add your Azure credentials"
else
    echo "⚠️  .env file already exists, skipping..."
fi

echo ""
echo "🐳 Starting PostgreSQL with Docker Compose..."
docker-compose up -d postgres

echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Wait for PostgreSQL to accept connections
MAX_TRIES=30
TRIES=0
until docker-compose exec -T postgres pg_isready -U ainuser -d ain &> /dev/null || [ $TRIES -eq $MAX_TRIES ]; do
    echo "   Waiting for PostgreSQL... ($TRIES/$MAX_TRIES)"
    sleep 2
    TRIES=$((TRIES+1))
done

if [ $TRIES -eq $MAX_TRIES ]; then
    echo "❌ PostgreSQL failed to start. Check 'docker-compose logs postgres'"
    exit 1
fi

echo "✅ PostgreSQL is ready"

echo ""
echo "🗄️  Running database migrations..."
pnpm db:migrate

echo ""
echo "🌱 Seeding database with initial data..."
pnpm db:seed

echo ""
echo "🔨 Building shared packages..."
pnpm --filter "./packages/*" build

echo ""
echo "✅ Setup complete!"
echo ""
echo "🎉 You're ready to start developing!"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Azure credentials (if not done already)"
echo "  2. Start development servers:"
echo ""
echo "     pnpm dev                            # Start all services"
echo ""
echo "  Or start individual services:"
echo "     pnpm --filter @ain/msim-api dev     # Backend API (port 3002)"
echo "     pnpm --filter @ain/platform-web dev # Main platform (port 3000)"
echo "     pnpm --filter @ain/admin-web dev    # Admin dashboard (port 3001)"
echo ""
echo "  3. Open your browser:"
echo "     - Platform: http://localhost:3000"
echo "     - Admin: http://localhost:3001"
echo "     - API: http://localhost:3002/health/ready"
echo ""
echo "📚 For more information, see README.md"
echo ""
