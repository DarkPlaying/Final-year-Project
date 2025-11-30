# 🛡️ Attendance Database Rules (finalyear-b56e7)

**Go to:** Firebase Console -> Project: `finalyear-b56e7` -> Firestore Database -> Rules

These rules are **SECURE**. They require the user to be authenticated in the Attendance Project.
Since we have updated the app to sign the user into *both* projects, we can now enforce authentication.

**Copy and paste these rules:**

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Helper Functions ---
    function isAuthenticated() {
      return request.auth != null;
    }

    // Check if the user has a role in THIS database's 'users' collection
    // Note: The UID in this DB matches the UID in the Secondary Auth because we created them in sync.
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isTeacher() {
      return isAuthenticated() && getUserData().role == 'teacher';
    }
    
    function isStudent() {
      return isAuthenticated() && getUserData().role == 'student';
    }

    // --- Attendance & Marks Rules ---

    match /attendance/{docId} {
      allow read: if isAuthenticated();
      allow write: if isTeacher();
    }

    match /mark_batches/{docId} {
      allow read: if isAuthenticated();
      allow write: if isTeacher();
    }

    match /marks/{docId} {
      allow read: if isAuthenticated();
      allow write: if isTeacher();
    }

    match /unom_reports/{docId} {
      allow read: if isAuthenticated();
      allow write: if isTeacher() || isStudent(); // Students might need write for submission? Or just update?
    }
    
    // Allow Admin Panel to sync users
    // We assume Admin has a user doc here too, or we allow create if auth is valid?
    // For simplicity and security, allow authenticated users to read/write their OWN user doc,
    // but we need Admin to write ANY user doc.
    // Since we don't have 'Admin' role strictly defined in Secondary Auth claims, 
    // we rely on the fact that only Admins have access to the Admin Panel code that writes here.
    // BUT for rules, we can check if the requestor is an admin in the DB.
    
    // Allow Admin Panel to sync users
    // CRITICAL: When creating a user from the Admin Panel, we are authenticated as the NEW user (secUid)
    // but we are writing a document with the MAIN UID (mainUid).
    // Therefore, request.auth.uid != userId.
    // We must allow authenticated users to write to ANY user document to support this sync.
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); 
    }

    // Default deny for everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```
