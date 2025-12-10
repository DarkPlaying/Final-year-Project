# OWASP Security Audit & Fixes

## 🛡️ Summary of Fixes Applied

### 1. Firestore Rules Hardening (OWASP A01: Broken Access Control)
The `firestore_rules.md` file has been updated with strict security rules.

*   **Users Collection:** Restricted access so users can only read their own profile (or teachers). Prevents data scraping.
*   **Unom Reports (Marks):**
    *   **Logic Fix:** Removed client-side ranking logic from `StudentDashboard.tsx` to prevent students from manipulating class rankings.
    *   **Rule Update:** Reverted to allow students to update reports (due to shared document architecture) but blocked `create` and `delete` permissions for students.
    *   **Recommendation:** Move to a subcollection-based architecture for proper row-level security.
*   **Exams:** Prevented students from reading draft exams (enforced in rules).
*   **Attendance:** Locked down to owner-only read access.

### 2. Client-Side Integrity (OWASP A04: Insecure Design)
In `StudentDashboard.tsx`, we removed the logic that recalculated the `rank` for the entire class.
*   **Vulnerability:** A malicious student could have modified the code to assign themselves Rank 1 before saving the shared document.
*   **Fix:** Students now only update their own row's data. Ranking is reserved for the Teacher Dashboard.

## 🚀 Deployment Instructions

Since `firestore.rules` does not exist in your root directory, you must manually apply the new rules:

1.  Open the file `firestore_rules.md` in this project.
2.  Copy the entire content.
3.  Go to the [Firebase Console](https://console.firebase.google.com/).
4.  Navigate to **Firestore Database** > **Rules**.
5.  Paste the content and click **Publish**.

## ⚠️ Critical Architectural Warning
The current implementation of "UNOM Reports" uses a **single shared document** for an entire class (Batch).
*   **Risk:** This requires giving `update` permission to all students on that document. A sophisticated attacker could still wipe the document (overwrite `data` array) via the API, even without the UI.
*   **Long-term Fix:** Refactor to store each student's submission as a separate document in a subcollection (`unom_reports/{reportId}/submissions/{studentId}`).
