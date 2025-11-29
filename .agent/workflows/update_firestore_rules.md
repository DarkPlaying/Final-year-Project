---
description: Update Firestore Security Rules to enable Attendance features
---

# Update Firestore Security Rules

The Attendance, Marks, and UNOM features have been migrated to the main database to resolve permission issues. You must update your Firestore Security Rules in the Firebase Console to allow access to these new collections.

## Steps

1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Select your project (**education-ai** or your main project).
3.  Navigate to **Firestore Database** > **Rules**.
4.  Copy the following rules and append them inside the `match /databases/{database}/documents { ... }` block (e.g., before the closing brace `}` of the match block).

```firestore
    // --- Attendance & Marks Rules ---
    match /attendance/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /mark_batches/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /marks/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /unom_reports/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
```

5.  Click **Publish**.

## Verification

After publishing the rules:
1.  Refresh the Teacher Dashboard.
2.  Go to the **Attendance** section.
3.  The "Failed to fetch" error should disappear.
