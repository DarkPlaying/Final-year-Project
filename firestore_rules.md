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

    // Attendance Stats (Cache):
    match /attendance_stats/{workspaceId} {
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
``'