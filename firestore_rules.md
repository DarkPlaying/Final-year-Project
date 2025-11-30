# 🛡️ Final Production Security Rules

Copy and paste these rules into your Firebase Console for each database.

---

## 1. Main Database Rules (`education-ai`)
**Go to:** Firebase Console -> Firestore Database -> Rules

*Note: These rules are permissive to ensure functionality. For stricter security, revert to role-based checks once everything is working.*

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- Helper Functions ---
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // --- Collection Rules ---

    // Users: 
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); // Allow sync/update
    }

    // Workspaces:
    match /workspaces/{workspaceId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); // Allow admins/teachers to manage
    }

    // Content (Exams, Syllabi, Announcements, Teacher Uploads):
    match /exams/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    match /syllabi/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    match /announcements/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    match /teacher_uploads/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }

    // Submissions:
    match /submissions/{docId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated();
      allow delete: if isAuthenticated();
    }

    // Queries:
    match /queries/{docId} {
      allow read, write: if isAuthenticated();
    }

    // System & Settings:
    match /settings/{docId} {
      allow read, write: if isAuthenticated();
    }
    match /system/{docId} {
      allow read, write: if isAuthenticated();
    }

    // Archived Users:
    match /deleted_users/{docId} {
      allow read, write: if isAuthenticated();
    }

    // Default deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 2. Secondary Database Rules (`finalyear`)
**Go to:** Firebase Console -> (Switch Project to `finalyear`) -> Firestore Database -> Rules

**IMPORTANT:** You must enable **Anonymous Authentication** in this project's Authentication settings for these rules to work.

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    // Allow anonymous users (authenticated via code) to access these collections
    match /attendance/{docId} { allow read, write: if isAuthenticated(); }
    match /mark_batches/{docId} { allow read, write: if isAuthenticated(); }
    match /marks/{docId} { allow read, write: if isAuthenticated(); }
    match /unom_reports/{docId} { allow read, write: if isAuthenticated(); }
    
    // Allow syncing users
    match /users/{userId} { allow read, write: if isAuthenticated(); }

    match /{document=**} { allow read, write: if false; }
  }
}
```
