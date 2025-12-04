rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to authenticated users (including anonymous)
    // This is required for the Admin Dashboard backup feature to work
    match /attendance/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /marks/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /unom_reports/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /users/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    match /workspaces/{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
