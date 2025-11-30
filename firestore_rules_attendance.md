# 🛡️ Attendance Database Rules (finalyear-b56e7)

**Go to:** Firebase Console -> Project: `finalyear-b56e7` -> Firestore Database -> Rules

Since your app authentication might be linked to a different project than this database, the safest way to ensure access is to **allow public read/write access** to these specific collections.

**Copy and paste these rules:**

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Attendance & Marks Rules ---
    // ⚠️ ALLOW ALL: This bypasses authentication checks to fix "Access Denied" errors
    // caused by cross-project authentication issues.

    match /attendance/{docId} {
      allow read, write: if true;
    }

    match /mark_batches/{docId} {
      allow read, write: if true;
    }

    match /marks/{docId} {
      allow read, write: if true;
    }

    match /unom_reports/{docId} {
      allow read, write: if true;
    }
    
    // Default deny for everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## ❓ Why was I getting "Access Denied"?

You are likely logged in via your **Main Project** (e.g., `education-ai`), but trying to access the **Secondary Project** (`finalyear-b56e7`).
Firestore treats this as an unauthenticated request because the user doesn't exist in the Secondary Project's Auth system.
Using `allow read, write: if true;` solves this by not checking for a user account.
