# Repository Copy Service

## Overview

The Repository Copy Service automatically saves copies of repository data to local files whenever clients upload data to Redis. Files are organized by business title for easy comparison with Redis entries.

## Purpose

This service provides:

1. **Backup**: Local copies of repository data for comparison and debugging
2. **Comparison**: Ability to compare client-uploaded data with Redis entries
3. **Debugging**: Historical snapshots of repository state when data is uploaded
4. **Analysis**: Timestamped copies showing the evolution of repository data over time

## Directory Structure

Repository copies are saved in:

```
repo-copies/
  └── {business-title-sanitized}/
      ├── repository-{timestamp}.json          # Complete repository snapshot (timestamped)
      ├── repository-latest.json               # Latest complete repository snapshot
      └── entities/
          ├── business-{timestamp}.json        # Business profile snapshot
          ├── business-latest.json             # Latest business profile
          ├── rewards-{timestamp}.json         # Rewards snapshot
          ├── rewards-latest.json              # Latest rewards
          ├── campaigns-{timestamp}.json       # Campaigns snapshot
          ├── campaigns-latest.json            # Latest campaigns
          ├── members-{timestamp}.json         # Members (customers) snapshot
          └── members-latest.json              # Latest members
```

## When Copies Are Saved

Repository copies are automatically saved when:

1. **Rewards**: POST/PUT `/api/v1/rewards` - When rewards are created or updated
2. **Business Profile**: PUT `/api/v1/businesses/:id` - When business profile is updated
3. **Campaigns**: POST/PUT `/api/v1/campaigns` - When campaigns are created or updated

**Note**: When any entity is updated, the service saves a complete repository snapshot, including all related entities (rewards, campaigns, members, business profile).

## Business Name Sanitization

Business names are sanitized for use as directory names:

- Converted to lowercase
- Special characters replaced with hyphens
- Trailing/leading hyphens removed
- Length limited to 50 characters

Example: `"The Stables Public House"` → `"the-stables-public-house"`

## Repository Copy Format

Each repository copy (`repository-{timestamp}.json`) contains:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "businessId": "business-uuid",
  "businessName": "The Stables",
  "business": { ... },
  "rewards": [ ... ],
  "campaigns": [ ... ],
  "members": [ ... ],
  "metadata": {
    "rewardsCount": 5,
    "campaignsCount": 2,
    "membersCount": 120,
    "businessUpdatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

## Usage

The service is automatically initialized when the API server starts. No manual configuration is required.

### Accessing Repository Copies

Repository copies are stored in the `repo-copies/` directory in the API server's working directory.

**Local Development:**
```bash
cd canny-carrot-api
ls -la repo-copies/
```

**Production:**
- On Vercel: Repository copies are saved to the serverless function's `/tmp` directory (ephemeral)
- On traditional server: Repository copies are saved to the `repo-copies/` directory in the project root

### Comparing with Redis

To compare repository copies with Redis entries:

1. **View latest repository copy:**
   ```bash
   cat repo-copies/the-stables/repository-latest.json
   ```

2. **View Redis data:**
   Use the Redis dump script:
   ```bash
   node scripts/dump-redis-record.js -t business -e business@email.com -o redis-dump.json
   ```

3. **Compare:**
   Use `diff`, `jq`, or other tools to compare the files

### Finding Business Directory

To find the directory for a specific business:

1. **By business name:** Look for sanitized business name
   ```bash
   ls -d repo-copies/*stables*
   ```

2. **Search all copies:**
   ```bash
   find repo-copies -name "repository-latest.json" -exec grep -l "The Stables" {} \;
   ```

## Configuration

The service requires no configuration. The directory structure is created automatically on first use.

## Error Handling

Repository copy operations are **non-blocking**. If saving a copy fails:

- The error is logged to the console
- The API request still completes successfully
- No error is returned to the client

This ensures that repository copy failures don't impact the primary API functionality.

## Cleanup

Repository copies are **not automatically cleaned up**. You should periodically:

1. **Archive old copies:**
   ```bash
   # Move old timestamped copies to archive
   mkdir -p repo-copies-archive
   find repo-copies -name "repository-*.json" ! -name "*-latest.json" -mtime +30 -exec mv {} repo-copies-archive/ \;
   ```

2. **Keep only latest:**
   ```bash
   # Remove all timestamped copies, keep only latest
   find repo-copies -name "repository-*.json" ! -name "*-latest.json" -delete
   ```

3. **Manual cleanup:**
   ```bash
   # Remove entire directory for a business
   rm -rf repo-copies/business-name
   ```

## Git Ignore

The `repo-copies/` directory is automatically ignored by Git (see `.gitignore`). This is because:

- Repository copies contain business data
- Files can be large and change frequently
- Copies are regenerated on upload, so no need to version control

## Notes

- **Serverless Environments (Vercel)**: Repository copies are saved to `/tmp`, which is ephemeral. Copies are lost when the serverless function container is recycled.
- **Production Servers**: Repository copies persist in the `repo-copies/` directory.
- **Storage**: Each repository copy includes all entities, so files can be large. Consider cleanup strategies for production.



