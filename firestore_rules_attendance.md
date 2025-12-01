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

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function isStudent() {
      return getUserData().role == 'student';
    }

    // Check if the user is the appointed Class Teacher or Mentor for the workspace
    function isAuthorizedTeacher(workspaceId) {
       let workspace = get(/databases/$(database)/documents/workspaces/$(workspaceId)).data;
       return workspace.classTeacher == request.auth.token.email || workspace.mentor == request.auth.token.email;
    }

    // --- Collection Rules ---

    // Workspaces (Synced from Main DB for Security Rules):
    match /workspaces/{workspaceId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated(); // Allow Admin Dashboard to sync
    }

    // Attendance: Only Class Teacher or Mentor can manage
    match /attendance/{docId} { 
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isAuthorizedTeacher(request.resource.data.workspaceId);
      allow update, delete: if isAuthenticated() && isAuthorizedTeacher(resource.data.workspaceId);
    }

    // UNOM Reports: 
    // - Create: Only Class Teacher or Mentor
    // - Delete: Only Class Teacher or Mentor (Hard delete)
    // - Update: Class Teacher/Mentor OR Creator (for soft delete) OR Students (submitting marks)
    match /unom_reports/{docId} { 
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isAuthorizedTeacher(request.resource.data.workspaceId);
      allow delete: if isAuthenticated() && isAuthorizedTeacher(resource.data.workspaceId);
      allow update: if isAuthenticated() && (
        isAuthorizedTeacher(resource.data.workspaceId) || 
        resource.data.teacherEmail == request.auth.token.email ||
        isStudent()
      );
    }

    // Marks & Batches (General access for now, or refine later)
    match /mark_batches/{docId} { allow read, write: if isAuthenticated(); }
    match /marks/{docId} { allow read, write: if isAuthenticated(); }
    
    // Allow syncing users
    match /users/{userId} { allow read, write: if isAuthenticated(); }

    match /{document=**} { allow read, write: if false; }
  }
}
```
