# Firebase Index Setup Required

## Current Status

✅ **Temporary Fix Applied**: The application now includes fallback queries that work without the composite index, so the app will function normally while you create the required indexes.

## Current Error (Now Handled Gracefully)

The application was showing Firebase index errors for the `goals` collection query. This has been temporarily resolved with fallback queries, but you should still create the proper indexes for optimal performance.

```
Error getting user goals: FirebaseError: The query requires an index. You can create it here: https://console.firebase.google.com/v1/r/project/piggybank-620cb/firestore/...
```

## Solution

You need to create composite indexes in Firebase Console for optimal performance:

### Required Indexes

**Collection:** `goals`
**Fields to index:**

1. `isActive` (Ascending)
2. `userId` (Ascending)
3. `createdAt` (Descending)

**Collection:** `transactions`
**Fields to index:**

1. `goalId` (Ascending)
2. `createdAt` (Descending)

**Collection:** `transactions`
**Fields to index:**

1. `userId` (Ascending)
2. `createdAt` (Descending)

## How to Fix

1. Click on the provided Firebase Console link in the error message (if still appearing)
2. The link will automatically configure the required index
3. Click "Create Index"
4. Wait for the index to be built (usually takes a few minutes)
5. Repeat for each required index

## Alternative Manual Setup

If the automatic link doesn't work:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project `piggybank-620cb`
3. Navigate to Firestore Database → Indexes
4. Click "Create Index"
5. Create each index with the exact field configuration above

## Current Behavior

- ✅ App works normally with fallback queries
- ⚠️ Performance may be slightly slower without proper indexes
- 📝 Console shows warning messages about missing indexes (this is normal)
- 🚀 Once indexes are created, queries will be optimized automatically

The fallback solution ensures your app remains functional while you set up the proper database indexes for optimal performance.
