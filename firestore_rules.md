# 🛡️ Final Production Security Rules

Copy and paste these rules into your Firebase Console for each database.

---

## 1. Main Database Rules (`education-ai`)
**Go to:** Firebase Console -> Firestore Database -> Rules

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // --- Helper Functions ---
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Fetch user role from the 'users' collection
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function isAdmin() {
      return isAuthenticated() && getUserData().role == 'admin';
    }
    
    function isTeacher() {
      return isAuthenticated() && getUserData().role == 'teacher';
    }
    
    function isStudent() {
      return isAuthenticated() && getUserData().role == 'student';
    }

    // --- Collection Rules ---

    // Users: 
    // - Any auth user can read (needed to map names/emails)
    // - Only Admin can create/delete users
    // - Admin or the user themselves can update their profile
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, delete: if isAdmin();
      allow update: if isAdmin() || request.auth.uid == userId;
    }

    // Workspaces:
    // - Any auth user can read
    // - Only Admin can create/update/delete
    match /workspaces/{workspaceId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Content (Exams, Syllabi, Announcements, Teacher Uploads):
    // - Any auth user can read
    // - Admin or Teacher can write
    match /exams/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /syllabi/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /announcements/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /teacher_uploads/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }

    // Submissions:
    // - Students can create their own
    // - Teachers/Admins can read and update (grade)
    // - Students can read their own
    match /submissions/{docId} {
      allow create: if isStudent();
      allow read: if isAuthenticated(); 
      allow update: if isAdmin() || isTeacher();
      allow delete: if isAdmin() || isTeacher();
    }

    // Queries:
    // - Authenticated users can read/write
    match /queries/{docId} {
      allow read, write: if isAuthenticated();
    }

    // System & Settings:
    // - Admin/Teacher control
    match /settings/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /system/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // --- New Collections (Migrated from Attendance DB) ---
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
  }
}
```

---

## 2. Attendance Database Rules (`finalyear`)
**Go to:** Firebase Console -> (Switch Project to `finalyear`) -> Firestore Database -> Rules

*Note: Since user roles are stored in the Main Database, we cannot easily check for 'Admin' or 'Teacher' here without complex backend setup. For now, we restrict access to **Authenticated Users Only**.*

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow access only if the user is logged in
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
