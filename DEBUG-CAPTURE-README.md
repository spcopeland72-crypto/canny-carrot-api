# Debug Capture Service

## Overview

The Debug Capture Service automatically saves client uploads and server downloads to `/tmp/canny-carrot-debug` for debugging purposes. This allows you to compare what the client app sends vs what Redis returns.

## Directory Structure

```
/tmp/canny-carrot-debug/
├── client-uploads/     # Data sent FROM app TO Redis (POST/PUT)
└── server-downloads/   # Data sent FROM Redis TO app (GET)
```

## File Naming

### Client Uploads
```
client-upload-{entityType}-{businessId}-{timestamp}.json
```

Example: `client-upload-reward-business_123-2026-01-15T23-45-00.json`

### Server Downloads
```
server-download-{entityType}-{businessId}-{timestamp}.json
```

Example: `server-download-rewards-business_123-2026-01-15T23-45-00.json`

## Captured Operations

### Client Uploads (POST/PUT)
- **Rewards**: POST/PUT `/api/v1/rewards` - captures reward data sent from app
- **Campaigns**: POST/PUT `/api/v1/campaigns` - captures campaign data sent from app
- **Business**: PUT `/api/v1/businesses/:id` - captures business profile updates from app

### Server Downloads (GET)
- **Rewards**: GET `/api/v1/rewards?businessId=...` - captures rewards returned from Redis
- **Campaigns**: GET `/api/v1/campaigns?businessId=...` - captures campaigns returned from Redis
- **Business**: GET `/api/v1/businesses/:id` - captures business profile returned from Redis

## File Format

### Client Upload Example
```json
{
  "timestamp": "2026-01-15T23:45:00.123Z",
  "direction": "client-to-redis",
  "entityType": "reward",
  "businessId": "business_123",
  "data": {
    "id": "reward_456",
    "name": "Free Coffee",
    "stampsRequired": 5,
    ...
  }
}
```

### Server Download Example
```json
{
  "timestamp": "2026-01-15T23:45:05.789Z",
  "direction": "redis-to-client",
  "entityType": "rewards",
  "businessId": "business_123",
  "data": [
    {
      "id": "reward_456",
      "name": "Free Coffee",
      "stampsRequired": 5,
      ...
    }
  ]
}
```

## Usage

### View All Captures for a Business

```bash
# View client uploads
ls -lt /tmp/canny-carrot-debug/client-uploads/ | grep business_123

# View server downloads
ls -lt /tmp/canny-carrot-debug/server-downloads/ | grep business_123
```

### Compare Client vs Server

```bash
# Find matching timestamps (within a few seconds)
# Client upload
cat /tmp/canny-carrot-debug/client-uploads/client-upload-reward-business_123-2026-01-15T23-45-00.json | jq '.data'

# Server download (should match what was uploaded)
cat /tmp/canny-carrot-debug/server-downloads/server-download-rewards-business_123-2026-01-15T23-45-05.json | jq '.data'
```

### Find Latest Capture

```bash
# Latest client upload
ls -t /tmp/canny-carrot-debug/client-uploads/ | head -1

# Latest server download
ls -t /tmp/canny-carrot-debug/server-downloads/ | head -1
```

## Debugging Workflow

1. **Make a change in the app** (create/update reward/campaign/business)
2. **Check client upload** - verify what the app sent
   ```bash
   cat /tmp/canny-carrot-debug/client-uploads/client-upload-reward-*.json | tail -1 | jq '.'
   ```
3. **Check server download** - verify what Redis returned
   ```bash
   cat /tmp/canny-carrot-debug/server-downloads/server-download-rewards-*.json | tail -1 | jq '.'
   ```
4. **Compare** - see if data matches or identify discrepancies

## Notes

- Files are saved automatically on every upload/download
- Capture is non-blocking - errors in capture don't affect API functionality
- Files persist in `/tmp` until server restart or manual cleanup
- Timestamps are ISO format with colons replaced by hyphens for filesystem compatibility

## Cleanup

```bash
# Remove all debug captures
rm -rf /tmp/canny-carrot-debug/

# Remove captures older than 7 days
find /tmp/canny-carrot-debug -type f -mtime +7 -delete
```

