# 🛡️ Attendance Database Rules (finalyear-b56e7)

**Go to:** Firebase Console -> Project: `finalyear-b56e7` -> Firestore Database -> Rules

Since you do **not** have a `users` collection in this database, we cannot check for "Teacher" or "Admin" roles here.
These rules allow **any logged-in user** to access the attendance data.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Helper Functions ---
    function isAuthenticated() {
      return request.auth != null;
    }

    // --- Attendance & Marks Rules ---
    // Allow any authenticated user to read/write because we cannot verify roles in this DB.

    match /attendance/{docId} {
      allow read, write: if isAuthenticated();
    }

    match /mark_batches/{docId} {
      allow read, write: if isAuthenticated();
    }

    match /marks/{docId} {
      allow read, write: if isAuthenticated();
    }

    match /unom_reports/{docId} {
      allow read, write: if isAuthenticated();
    }
    
    // Default deny for everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## ⚠️ Still getting "Access Denied"?

If you still get errors after publishing these rules, it means your app is **not sending authentication credentials** to this specific database. This happens if your app is logged into Project A but trying to access Project B.

**Temporary "Fix-All" (Insecure):**
Change `if isAuthenticated()` to `if true`.

```firestore
    match /attendance/{docId} {
      allow read, write: if true;
    }
```
