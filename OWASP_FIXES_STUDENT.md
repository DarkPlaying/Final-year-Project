# OWASP Security Fixes (Student Dashboard)

## 🚨 Issue
The strict security rules implemented earlier were slightly *too* strict for the Student Dashboard, causing:
1.  **Attendance Error:** `permission-denied` (Rules checked `studentId` but app queries by `studentEmail`).
2.  **Teacher List Error:** Students couldn't see the list of teachers (Blocked from reading `users` collection).
3.  **Exam Error:** Count queries failed because the query didn't strictly filter out `draft` exams (which students are not allowed to see).

## ✅ Fixes Applied
I have updated `firestore_rules.md` and `StudentDashboard.tsx` to align the code with the security model.

### 1. Teachers Visible
*   **Rule Change:** `users` collection now explicitly allows ANY authenticated user to read a profile **IF** that profile belongs to a 'teacher'.
*   *Result:* Dropdowns and teacher lists will now populate correctly for students.

### 2. Attendance Visible
*   **Rule Change:** `attendance` collection now checks `resource.data.studentEmail == getUserEmail()`.
*   *Result:* Students can now see their own attendance records.

### 3. Exams Visible
*   **Rule Change:** Strict check: Student must be in `students` array AND status must not be `draft`.
*   **Code Change:** Updated `StudentDashboard.tsx` to explicitly filter `where('status', '!=', 'draft')` in both the list and count queries.
*   *Result:* Exams count and list will load without permission errors.

## 🚀 Action Required
**You must re-deploy the Firestore Rules one last time.**

1.  Open `firestore_rules.md`.
2.  Copy all content.
3.  Go to **Firebase Console > Firestore Database > Rules**.
4.  Paste and Publish.
