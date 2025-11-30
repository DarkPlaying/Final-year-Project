# PROJECT REPORT: Edu Online
> **NOTE TO STUDENT:** This document is a draft content for your Final Year Project Report based on the University of Madras syllabus. You must copy this content into Microsoft Word or a similar processor to apply the specific font and formatting rules required (Times New Roman 12pt, Arial 16pt for Headers, etc.).

---

## CERTIFICATE

Certified that this report titled **"EDU ONLINE - SMART EDUCATION MANAGEMENT SYSTEM"** is a bonafide record of the project work done by **Sanjay M (Reg. No: 222308608)** under our supervision and guidance, towards partial fulfillment of the requirement for award of the Degree of **B.Sc Computer Science** of **Vel Tech Ranga Sanku Arts College** for the academic year **2024-2025**.

<br>
<br>

_________________________                                      _________________________
**Internal Guide**                                             **Mrs. Chammudeshwari**
                                                               **Head of the Department**

<br>
<br>

_________________________
**External Guide**

Submitted for the Viva-Voce Examination held on: _________________________

---

## ACKNOWLEDGEMENT

[Insert your acknowledgement here thanking your guide, parents, and college.]

---

## TABLE OF CONTENTS

1. **INTRODUCTION**
    1.1 Organizational Overview
    1.2 Description of Present System
    1.3 Limitations of Present System
    1.4 The Proposed System
2. **SYSTEM ANALYSIS AND DESIGN**
    2.1 Context Diagram
    2.2 Data Flow Diagrams (DFD)
    2.3 Database Design (Files/Tables)
3. **IMPLEMENTATION**
    3.1 Tools and Technologies
    3.2 Program List (Sample Code)
    3.3 Program - File Table
4. **OUTPUTS**
    4.1 Screen Layouts
    4.2 Report Formats
5. **CONCLUSION AND FUTURE ENHANCEMENT**
6. **REFERENCES**

---

# CHAPTER 1: INTRODUCTION

## 1.1 Organizational Overview
The project **"Edu Online"** is developed for educational institutions aiming to modernize their academic management. In the current digital era, institutions require robust systems to manage student data, attendance, and examinations efficiently. This project serves as a centralized platform for Administrators, Teachers, and Students to collaborate and manage academic activities seamlessly.

## 1.2 Description of the Present System
Currently, many institutions rely on manual methods or fragmented software solutions:
- **Attendance:** Recorded in physical registers or isolated Excel sheets.
- **Examinations:** Paper-based tests or simple Google Forms without proctoring or AI capabilities.
- **Mark Submission:** Manual entry of marks into university portals (UNOM), which is error-prone and time-consuming.
- **Communication:** Notices are sent via physical circulars or messaging apps, leading to information gaps.

## 1.3 Limitations of the Present System
1.  **Data Redundancy:** Same data is repeated across multiple records.
2.  **Lack of Security:** Physical records can be lost or damaged; unsecure digital files are vulnerable.
3.  **Time-Consuming:** Manual calculation of grades and attendance takes significant faculty time.
4.  **No Real-time Access:** Parents and students cannot view progress in real-time.
5.  **Scalability Issues:** Hard to manage as the institution grows.

## 1.4 The Proposed System - Advantages and Features
**Edu Online** is a cloud-based web application designed to overcome these limitations.

**Advantages:**
- **Centralized Data:** Single source of truth for all student and staff data.
- **Role-Based Access Control (RBAC):** Secure access for Admins, Teachers, and Students.
- **Automation:** AI-powered test generation and automated grading.
- **Accessibility:** Available 24/7 from any device with internet access.

**Key Features:**
1.  **Secure Authentication:** Firebase Authentication with email/password and role verification.
2.  **Dashboard:** Personalized dashboards for different user roles.
3.  **Workspace Management:** Dedicated digital spaces for classes and subjects.
4.  **AI Assessment:** Integration with AI to generate questions and evaluate answers.
5.  **UNOM Mark Submission:** Streamlined interface for submitting university marks.
6.  **Real-time Attendance:** Digital tracking of student attendance.

---

# CHAPTER 2: SYSTEM ANALYSIS AND DESIGN

## 2.1 Context Diagram of the Proposed System
*(Note: Draw a circle representing "Edu Online" in the center. Arrows coming in from "Admin", "Teacher", "Student" with data like "Login Details", "Marks". Arrows going out with "Reports", "Dashboards".)*

## 2.2 Top Level DFD (Data Flow Diagram)
*(Note: Create a Level 0 DFD showing the flow of data between User, Authentication System, Database, and Reporting Module.)*

## 2.3 Files or Tables List (Database Schema)
The system uses **Google Cloud Firestore** (NoSQL Database). Below are the primary collections (tables):

### Table 1: `users`
| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `uid` | String (PK) | Unique User ID from Auth |
| `email` | String | User email address |
| `role` | String | 'admin', 'teacher', or 'student' |
| `displayName`| String | Full name of the user |
| `createdAt` | Timestamp | Account creation date |

### Table 2: `workspaces`
| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Unique Workspace ID |
| `name` | String | Name of the class/subject |
| `teacherId` | String | UID of the teacher |
| `students` | Array | List of student UIDs |

### Table 3: `unom_reports`
| Field Name | Data Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Unique Report ID |
| `studentId` | String | UID of the student |
| `subject` | String | Subject Code/Name |
| `marks` | Number | Marks obtained |
| `status` | String | 'submitted', 'pending' |

---

# CHAPTER 3: IMPLEMENTATION

## 3.1 Tools and Technologies
- **Front-End Framework:** React.js, TypeScript
- **UI Components:** 
    - **Shadcn UI** (Base components)
    - **21st.dev Community Components** (Advanced UI elements)
- **Styling:** Tailwind CSS
- **Dashboard Design Reference:** Analytic HTML Fixed Footer (DashboardPack)
- **Back-End / Database:** Firebase (Firestore, Authentication)
- **Build Tool:** Vite
- **Version Control:** Git & GitHub

## 3.2 Program List (Sample Code)

**Sample 1: User Authentication (Login.tsx)**
```typescript
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    if (userDoc.exists()) {
      const role = userDoc.data().role;
      navigate(`/dashboard/${role}`);
    }
  } catch (error) {
    toast.error("Login Failed");
  }
};
```

**Sample 2: Creating a Workspace (AdminDashboard.tsx)**
```typescript
const createWorkspace = async (name: string) => {
  await addDoc(collection(db, 'workspaces'), {
    name: name,
    createdAt: serverTimestamp(),
    status: 'active'
  });
};
```

## 3.3 Program - File Table
| Program Module | Files/Collections Accessed | Operation |
| :--- | :--- | :--- |
| `Login.tsx` | `users` | Read (Verify Role) |
| `AdminDashboard.tsx` | `users`, `workspaces` | Create, Read, Update, Delete |
| `TeacherDashboard.tsx` | `workspaces`, `attendance` | Read, Update |
| `StudentDashboard.tsx` | `unom_reports`, `workspaces` | Read |

---

# CHAPTER 4: OUTPUTS

## 4.1 Screen Layouts
*(Note: Take screenshots of your actual running application and paste them here in the Word document.)*
1.  **Login Page:** Shows email/password fields with professional tech logos.
2.  **Admin Dashboard:** Shows user management and system stats.
3.  **Student Dashboard:** Shows "Submit UNOM" and subject lists.

## 4.2 Report Formats
**UNOM Mark Sheet Report:**
- **Header:** University of Madras / College Name
- **Content:** Student Name, Register Number, Subject Wise Marks, Total, Result.
- **Footer:** Generated by Edu Online.

---

# REFERENCES
1.  React Documentation - https://react.dev/
2.  Firebase Documentation - https://firebase.google.com/docs
3.  **UI Components:** https://21st.dev/community/components
4.  **Dashboard Design Inspiration:** https://demo.dashboardpack.com/analytic-html/fixed_footer.html
5.  University of Madras Syllabus Guidelines 2023-2024.
