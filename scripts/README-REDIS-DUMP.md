# Redis Record Dumper - Complete Documentation

## Overview

The `dump-redis-record.js` script allows you to dump complete records from the Canny Carrot Redis database for any business or customer account, including all related data (rewards, campaigns, customers, etc.).

## Purpose

This script is designed for:
- **Debugging**: Inspect complete account data when troubleshooting issues
- **Data Export**: Export account records for backup or analysis
- **Support**: Help customers by viewing their complete account state
- **Testing**: Verify data integrity and completeness

## Requirements

- **Node.js 18+** installed
- Access to the Redis database (via API or direct connection)
- **API_URL** environment variable set to the API endpoint (defaults to `https://api.cannycarrot.com`)
- For direct Redis access: **REDIS_URL** environment variable (optional)

## Installation

No installation needed - the script uses Node.js built-in modules only.

```bash
# Make script executable (Unix/Mac)
chmod +x canny-carrot-api/scripts/dump-redis-record.js

# Or run with node directly
node canny-carrot-api/scripts/dump-redis-record.js [options]
```

## Usage

### Basic Syntax

```bash
node scripts/dump-redis-record.js --type <business|customer> [search-options]
```

### Search Options

You must provide ONE of these search methods:

1. **By Email** (for businesses):
   ```bash
   node scripts/dump-redis-record.js --type business --email laverickclare@hotmail.com
   ```

2. **By ID**:
   ```bash
   node scripts/dump-redis-record.js --type business --id business-abc-123
   node scripts/dump-redis-record.js --type customer --id customer-xyz-789
   ```

3. **By Search Term** (businesses only):
   ```bash
   node scripts/dump-redis-record.js --type business --search "The Stables"
   ```

### Output Options

- **Print to Console** (default):
  ```bash
  node scripts/dump-redis-record.js --type business --email example@email.com
  ```

- **Save to File**:
  ```bash
  node scripts/dump-redis-record.js --type business --email example@email.com --output stables-dump.json
  ```

### Command Line Flags

| Flag | Short | Description | Required |
|------|-------|-------------|----------|
| `--type` | `-t` | Record type: `business` or `customer` | ✅ Yes |
| `--email` | `-e` | Business email address | ⚠️ One required |
| `--id` | `-i` | Business or customer ID | ⚠️ One required |
| `--search` | `-s` | Search term (businesses only) | ⚠️ One required |
| `--output` | `-o` | Output file path (optional) | ❌ No |

## Examples

### Example 1: Dump The Stables Business Record

```bash
node scripts/dump-redis-record.js \
  --type business \
  --email laverickclare@hotmail.com \
  --output the-stables-complete-dump.json
```

### Example 2: Dump Business by ID

```bash
node scripts/dump-redis-record.js \
  --type business \
  --id 550e8400-e29b-41d4-a716-446655440000
```

### Example 3: Quick Console View

```bash
node scripts/dump-redis-record.js \
  --type business \
  --email laverickclare@hotmail.com
```

### Example 4: Customer Record

```bash
node scripts/dump-redis-record.js \
  --type customer \
  --id member-abc-123-xyz
```

## Output Format

The script outputs a JSON object with the following structure:

### Business Record

```json
{
  "businessId": "business-id-here",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "business": {
    "id": "business-id",
    "name": "The Stables",
    "email": "laverickclare@hotmail.com",
    "phone": "+44 20 1234 5678",
    "address": { ... },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "stats": { ... },
    "settings": { ... }
  },
  "auth": {
    "email": "laverickclare@hotmail.com",
    "businessId": "business-id",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "rewards": [
    {
      "id": "reward-id",
      "name": "Buy 10 Get 1 Free",
      "stampsRequired": 10,
      "isActive": true,
      ...
    }
  ],
  "campaigns": [
    {
      "id": "campaign-id",
      "name": "Christmas Special",
      "status": "active",
      ...
    }
  ],
  "customers": [
    {
      "id": "member-id",
      "name": "John Doe",
      "email": "john@example.com",
      ...
    }
  ]
}
```

### Customer Record

```json
{
  "customerId": "customer-id-here",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "customer": {
    "id": "member-id",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+44 20 9876 5432",
    ...
  },
  "stamps": {},
  "redemptions": []
}
```

## What Data is Included

### Business Dumps Include:

1. **Business Profile**: Complete business information
   - Name, email, phone, address
   - Settings and preferences
   - Statistics and metrics
   - Creation and update timestamps

2. **Authentication Data**: Login credentials metadata
   - Email and business ID mapping
   - Account creation timestamp

3. **Rewards**: All rewards created by the business
   - Reward details (name, description, requirements)
   - Active/inactive status
   - QR codes and PIN codes
   - Creation and modification timestamps

4. **Campaigns**: All marketing campaigns
   - Campaign details and status
   - Start/end dates
   - Participation statistics

5. **Customers/Members**: All customers who have interacted with the business
   - Customer profiles (up to 100)
   - Contact information
   - Interaction history

### Customer Dumps Include:

1. **Customer Profile**: Complete customer information
2. **Stamps**: Stamp card progress (if available)
3. **Redemptions**: Reward redemption history (if available)

## Troubleshooting

### Error: "No business found with email"

- **Cause**: Email doesn't exist in Redis
- **Solution**: Verify the email is correct and the account exists
- **Alternative**: Try searching by business ID instead

### Error: "API error: 404"

- **Cause**: API endpoint not found or incorrect
- **Solution**: Check `API_URL` environment variable or use `--api-url` flag
- **Verify**: API is accessible at the configured URL

### Error: "Redis connection timeout"

- **Cause**: Redis server not accessible
- **Solution**: 
  - Check network connectivity
  - Verify Redis URL in environment variables
  - Check if API server is running

### Error: "Command 'xxx' is not allowed"

- **Cause**: Trying to use unsafe Redis command
- **Solution**: The script only uses safe read-only commands via API

## Environment Variables

```bash
# API endpoint (default: https://api.cannycarrot.com)
export API_URL=https://api.cannycarrot.com

# Direct Redis connection (optional, not recommended)
export REDIS_URL=redis://user:password@host:port
export USE_DIRECT_REDIS=true
```

## Redis Key Structure

The script queries these Redis keys:

### Business Keys:
- `business:{id}` - Business profile
- `business:auth:{email}` - Authentication data
- `business:{id}:rewards` - Set of reward IDs
- `business:{id}:campaigns` - Set of campaign IDs
- `business:{id}:members` - Set of member/customer IDs

### Reward Keys:
- `reward:{id}` - Individual reward data

### Campaign Keys:
- `campaign:{id}` - Individual campaign data

### Customer Keys:
- `member:{id}` - Customer profile data

## Security Notes

- ⚠️ **This script reads sensitive data** - Handle output files carefully
- ⚠️ **Never commit dumps to version control** - Contains PII and business data
- ⚠️ **Password hashes are included** - Store securely if saving
- ✅ **Read-only operations** - Script only reads data, never modifies

## Future Enhancements

Potential improvements:
- [ ] Direct Redis connection option (currently via API only)
- [ ] Filter options (date ranges, active/inactive)
- [ ] CSV export format
- [ ] Incremental dumps (only changes since last dump)
- [ ] Multi-account batch dumps

## Support

For issues or questions:
1. Check this documentation
2. Review error messages (they're descriptive)
3. Verify API connectivity
4. Check Redis key structure matches expectations

## Quick Reference

```bash
# The Stables business dump
node scripts/dump-redis-record.js -t business -e laverickclare@hotmail.com -o stables.json

# Any business by email
node scripts/dump-redis-record.js -t business -e business@example.com

# Business by ID
node scripts/dump-redis-record.js -t business -i business-uuid-here

# Customer by ID
node scripts/dump-redis-record.js -t customer -i customer-uuid-here
```



