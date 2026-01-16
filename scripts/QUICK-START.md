# Quick Start Guide - Redis Record Dumper

## First Time Using This Script?

**You are:** A developer/support person who needs to inspect account data in Redis  
**You need:** A complete dump of a business or customer record  
**You have:** Node.js installed and access to the API

## 5-Second Quick Start

```bash
# Dump The Stables business
cd canny-carrot-api
node scripts/dump-redis-record.js -t business -e laverickclare@hotmail.com
```

That's it! The output will show on your screen.

## Common Tasks

### Task 1: Check what rewards a business has

```bash
node scripts/dump-redis-record.js -t business -e business@email.com
# Look for the "rewards" array in the output
```

### Task 2: Export business data to file

```bash
node scripts/dump-redis-record.js -t business -e business@email.com -o export.json
# Opens export.json with all data
```

### Task 3: Find a business by ID (if you have it)

```bash
node scripts/dump-redis-record.js -t business -i business_abc123_xyz
```

### Task 4: Check a customer record

```bash
node scripts/dump-redis-record.js -t customer -i customer-id-here
```

## Understanding the Output

The script prints:
1. ✅/❌ symbols for success/failure
2. A summary at the end with counts
3. Full JSON data (save to file with `-o filename.json`)

## Troubleshooting in 30 Seconds

**Problem:** "No business found with email"  
**Solution:** Check the email spelling, or try searching by ID instead

**Problem:** "API error: 404"  
**Solution:** Check if API is running: `curl https://api.cannycarrot.com/api/v1/redis/health`

**Problem:** Script hangs  
**Solution:** Press Ctrl+C, check network connection

## Need More Details?

Read the full documentation: `README-REDIS-DUMP.md`

## Remember

- ✅ Script is **read-only** - safe to run
- ⚠️ Output contains **sensitive data** - don't share publicly
- 💾 Use `-o filename.json` to save for later analysis




