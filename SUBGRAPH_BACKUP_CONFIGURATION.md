# Subgraph Backup Configuration

The SubgraphService now supports backup endpoints to handle query limits and provide failover functionality.

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Primary subgraph endpoint (required)
SUBGRAPH_API_URL=https://api.studio.thegraph.com/query/103077/debt-purchasing/version/latest
SUBGRAPH_API_KEY=your_api_key_here

# Backup endpoints (optional)
SUBGRAPH_BACKUP_URL_1=https://api.studio.thegraph.com/query/103077/debt-purchasing-backup/version/latest
SUBGRAPH_BACKUP_URL_2=https://api.studio.thegraph.com/query/103077/debt-purchasing-backup-2/version/latest
```

## How It Works

1. **Primary Endpoint**: The service starts with the primary URL (`SUBGRAPH_API_URL`)
2. **Automatic Fallback**: If the primary endpoint fails, it automatically switches to the first backup URL
3. **Cycling Logic**: If backup URLs also fail, it cycles through all available endpoints
4. **Return to Primary**: After all endpoints fail, it returns to the primary endpoint for the next request
5. **Smart Indexing**: The service remembers which endpoint was successful and starts from there next time

## Example Usage

```typescript
// The service automatically handles fallback
const debtPositions = await subgraphService.fetchDebtPositions();

// If primary fails, it will try:
// 1. SUBGRAPH_BACKUP_URL_1
// 2. SUBGRAPH_BACKUP_URL_2
// 3. Back to SUBGRAPH_API_URL
```

## Logging

The service provides detailed logging to track which endpoints are being used:

```
🔧 SubgraphService initialized with 3 endpoints: [...]
🔄 Trying endpoint 1/3: https://api.studio.thegraph.com/query/103077/debt-purchasing/version/latest
❌ Failed to execute query on endpoint 1: Rate limit exceeded
🔄 Trying next endpoint...
🔄 Trying endpoint 2/3: https://api.studio.thegraph.com/query/103077/debt-purchasing-backup/version/latest
✅ Successfully used endpoint 2: https://api.studio.thegraph.com/query/103077/debt-purchasing-backup/version/latest
```

## Configuration Examples

### Minimal Configuration (No Backup)

```env
SUBGRAPH_API_URL=https://api.studio.thegraph.com/query/103077/debt-purchasing/version/latest
SUBGRAPH_API_KEY=your_api_key_here
```

### Full Configuration (With Backups)

```env
SUBGRAPH_API_URL=https://api.studio.thegraph.com/query/103077/debt-purchasing/version/latest
SUBGRAPH_API_KEY=your_api_key_key
SUBGRAPH_BACKUP_URL_1=https://api.studio.thegraph.com/query/103077/debt-purchasing-backup/version/latest
SUBGRAPH_BACKUP_URL_2=https://api.studio.thegraph.com/query/103077/debt-purchasing-backup-2/version/latest
```

## Benefits

- **High Availability**: Automatic failover when primary endpoint is down
- **Rate Limit Handling**: Seamless switching when hitting query limits
- **No Code Changes**: Existing code continues to work without modifications
- **Smart Recovery**: Automatically returns to working endpoints
- **Detailed Logging**: Easy monitoring of endpoint health and usage
