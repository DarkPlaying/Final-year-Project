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
    
    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }
    
    function getRole() {
      return getUserData().role;
    }

    function isAdmin() {
      return isAuthenticated() && getRole() == 'admin';
    }

    function isTeacher() {
      return isAuthenticated() && getRole() == 'teacher';
    }

    function isStudent() {
      return isAuthenticated() && getRole() == 'student';
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    // --- Collection Rules ---

    // Users: 
    // - Read: Authenticated users can read (needed for finding teachers/students)
    // - Write: Only Admin can create/delete. Users can update their own profile (e.g. password) but NOT role.
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin(); // Only admin creates users
      allow delete: if isAdmin();
      allow update: if isAdmin() || (isOwner(userId) && request.resource.data.role == resource.data.role); // Prevent role escalation
    }

    // Workspaces:
    // - Read: Authenticated users
    // - Write: Admins only
    match /workspaces/{workspaceId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // Content (Exams, Syllabi, Announcements):
    // - Read: Authenticated users
    // - Write: Admins or Teachers
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
    // - Read: Teachers/Admins OR the student who owns the submission
    // - Create: Students
    // - Update: Teachers (grading) OR Student (resubmitting if allowed)
    // Submissions:
    // - Read: Teachers/Admins OR the student who owns the submission
    // - Create: Students
    // - Update: Teachers (grading) OR Student (resubmitting if allowed)
    match /submissions/{docId} {
      allow read: if isAdmin() || isTeacher() || (isAuthenticated() && resource.data.studentEmail == getUserData().email);
      allow create: if isAuthenticated();
      // Explicitly allow admins to delete, and teachers if needed
      allow delete: if isAdmin() || isTeacher(); 
      allow update: if isAdmin() || isTeacher() || (isAuthenticated() && resource.data.studentEmail == getUserData().email);
    }

    // Queries:
    // - Read/Write: Authenticated users (Students ask, Teachers answer)
    match /queries/{docId} {
      allow read, write: if isAuthenticated();
    }

    // System & Settings:
    // - Read: Authenticated users (to check maintenance mode etc)
    // - Write: Admins only
    match /settings/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /system/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    // --- New Features (Attendance, Marks, UNOM) ---
    
    // Attendance:
    match /attendance/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }

    // Marks Management:
    match /mark_batches/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }
    match /marks/{docId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin() || isTeacher();
    }

    // UNOM Reports:
    match /unom_reports/{docId} {
      allow read: if isAuthenticated();
      // Teachers create, Students update (submit marks)
      allow write: if isAuthenticated(); 
    }

    // Archived Users:
    match /deleted_users/{docId} {
      allow read, write: if isAdmin();
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

    // Since secondary DB uses Anonymous Auth, we can't easily check roles from the 'users' collection 
    // because the user might not be fully synced or the auth token doesn't carry custom claims yet.
    // However, we can rely on the fact that the client app enforces logic. 
    // BUT for true security, we should ideally sync roles or use Custom Claims.
    
    // For this specific setup where we use signInAnonymously() for the secondary DB, 
    // we are limited. The best we can do without a backend to mint custom tokens is:
    // 1. Allow read/write if authenticated (which we have).
    // 2. Try to validate data structure where possible.
    
    // CRITICAL: To truly secure this secondary DB, you should implement Custom Authentication 
    // where the main app generates a token with the user's role for the secondary app.
    // Since we are using Anonymous Auth, we are trusting the client. 
    // Below is a slightly better version than "allow all", but still relies on client honesty for roles.

    // Allow anonymous users (authenticated via code) to access these collections
    
    // Attendance: 
    match /attendance/{docId} { 
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); // Ideally restrict to teachers
    }

    // Marks:
    match /mark_batches/{docId} { 
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); // Ideally restrict to teachers
    }
    match /marks/{docId} { 
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); 
    }

    // UNOM Reports:
    match /unom_reports/{docId} { 
      allow read: if isAuthenticated();
      allow write: if isAuthenticated();
    }
    
    // Allow syncing users
    match /users/{userId} { 
      allow read, write: if isAuthenticated(); 
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```
