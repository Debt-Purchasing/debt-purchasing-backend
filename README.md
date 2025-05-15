# Debt Purchasing Backend

Backend services for the debt purchasing platform, including API server and automation bot.

## Overview

The backend serves two main functions:

1. **API Server**: Provides data to the frontend application
2. **Automation Bot**: Monitors blockchain conditions and executes debt sales when criteria are met

## Architecture

- `/src`: Core API server code
- `/db`: Database schemas and connections
- `/bot`: Automation bot services

## Setup

### Prerequisites

- Node.js (v16+)
- MongoDB
- Ethereum node access (Infura, Alchemy, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/debt-purchasing-backend.git
cd debt-purchasing-backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your specific configuration
```

### Running

```bash
# Start the API server
npm start

# Run in development mode with hot reloading
npm run dev

# Run the automation bot
npm run bot
```

### Testing

```bash
# Run tests
npm test
```

## API Endpoints

- `GET /api/debt/offers`: Get all available debt offers
- `GET /api/debt/offers/:id`: Get a specific debt offer
- `GET /api/user/:address/positions`: Get debt positions owned by a user

## Automation Bot

The bot continuously monitors:

- Debt sale offers that have met their execution criteria
- Price conditions for conditional debt sales
- User account health factors

When conditions are met, it triggers transactions to execute sales or take other automated actions.

## License

This project is licensed under the MIT License.
