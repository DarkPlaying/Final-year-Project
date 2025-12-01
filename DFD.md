# Data Flow Diagrams (DFD) - Edu Online

This document outlines the Data Flow Diagrams for the Edu Online project, covering Level 0 (Context), Level 1 (System Decomposition), and Level 2 (Detailed Process).

## Level 0 DFD: Context Diagram

The Context Diagram represents the entire **Edu Online System** as a single process, interacting with external entities (Admin, Teacher, Student).

```mermaid
graph TD
    %% Entities
    Admin[Admin]
    Teacher[Teacher]
    Student[Student]
    
    %% Main System
    System((Edu Online System))

    %% Relationships
    Admin -->|User Management, Workspace Config| System
    System -->|System Logs, Analytics| Admin

    Teacher -->|Syllabi, Announcements, Exams| System
    System -->|Student Submissions, Attendance Data| Teacher

    Student -->|Exam Submissions, UNOM Marks| System
    System -->|Grades, Course Content, Feedback| Student
```

## Level 1 DFD: System Decomposition

This level breaks down the main system into its primary functional processes.

```mermaid
graph TD
    %% Entities
    Admin[Admin]
    Teacher[Teacher]
    Student[Student]

    %% Processes
    P1(1.0 User Management)
    P2(2.0 Workspace Management)
    P3(3.0 Course Content Mgmt)
    P4(4.0 Assessment System)
    P5(5.0 Attendance & Reporting)

    %% Data Stores
    D1[(Users DB)]
    D2[(Workspaces DB)]
    D3[(Content DB)]
    D4[(Submissions DB)]
    D5[(Secondary DB: Attendance/Marks)]

    %% Flows - User Management
    Admin -->|Create/Edit Users| P1
    P1 -->|Read/Write User Data| D1
    D1 -.->|Auth Details| P1

    %% Flows - Workspace Management
    Admin -->|Create Workspaces| P2
    Teacher -->|Assign Classes| P2
    P2 -->|Workspace Config| D2

    %% Flows - Content Management
    Teacher -->|Upload Syllabi/Announcements| P3
    P3 -->|Store Content| D3
    D3 -.->|Retrieve Content| Student

    %% Flows - Assessment System
    Teacher -->|Create Exams/Assignments| P4
    Student -->|Submit Answers| P4
    P4 -->|Store Submissions| D4
    P4 -->|Grading Interface| Teacher
    D4 -.->|Results & Feedback| Student

    %% Flows - Attendance & Reporting
    Student -->|Submit UNOM Marks| P5
    Teacher -->|Monitor Attendance| P5
    P5 -->|Store Records| D5
    D5 -.->|Reports| Admin
```

## Level 2 DFD: User Management (Process 1.0)

Detailed breakdown of how users are created, managed, and authenticated.

```mermaid
graph TD
    %% Entities
    Admin[Admin]
    
    %% Sub-processes
    P1_1(1.1 Create User)
    P1_2(1.2 Update User)
    P1_3(1.3 Delete User)
    P1_4(1.4 Sync Secondary DB)

    %% Data Stores
    D_Auth[(Firebase Auth)]
    D_Users[(Users Collection)]
    D_Logs[(System Logs)]
    D_SecUsers[(Secondary Users DB)]

    %% Flows
    Admin -->|Input User Details| P1_1
    P1_1 -->|Create Auth Account| D_Auth
    P1_1 -->|Save Profile| D_Users
    P1_1 -->|Sync Profile| P1_4
    P1_4 -->|Write to Secondary| D_SecUsers
    
    Admin -->|Edit Details| P1_2
    P1_2 -->|Update Profile| D_Users
    P1_2 -->|Update Secondary| P1_4

    Admin -->|Request Delete| P1_3
    P1_3 -->|Disable/Delete Auth| D_Auth
    P1_3 -->|Mark Deleted| D_Users
    P1_3 -->|Log Action| D_Logs
```

## Level 2 DFD: Workspace Management (Process 2.0)

Breakdown of how workspaces (classes/departments) are managed.

```mermaid
graph TD
    %% Entities
    Admin[Admin]
    Teacher[Teacher]

    %% Sub-processes
    P2_1(2.1 Create Workspace)
    P2_2(2.2 Assign Teachers)
    P2_3(2.3 Manage Students)

    %% Data Stores
    D_Workspaces[(Workspaces Collection)]
    D_Users[(Users Collection)]

    %% Flows
    Admin -->|Define Workspace| P2_1
    P2_1 -->|Save Workspace| D_Workspaces
    
    Admin -->|Select Teachers| P2_2
    P2_2 -->|Update Workspace| D_Workspaces
    P2_2 -.->|Notify| Teacher

    Teacher -->|Add/Remove Students| P2_3
    D_Users -.->|Fetch Student List| P2_3
    P2_3 -->|Update Enrollment| D_Workspaces
```

## Level 2 DFD: Course Content Management (Process 3.0)

Details on how educational content is handled.

```mermaid
graph TD
    %% Entities
    Teacher[Teacher]
    Student[Student]

    %% Sub-processes
    P3_1(3.1 Upload Syllabus)
    P3_2(3.2 Post Announcement)
    P3_3(3.3 View Content)

    %% Data Stores
    D_Storage[(Firebase Storage)]
    D_Syllabi[(Syllabi Collection)]
    D_Announce[(Announcements Collection)]

    %% Flows
    Teacher -->|Upload File| P3_1
    P3_1 -->|Save File| D_Storage
    P3_1 -->|Save Metadata| D_Syllabi

    Teacher -->|Draft Message| P3_2
    P3_2 -->|Save Announcement| D_Announce

    Student -->|Request Content| P3_3
    D_Syllabi -.->|Fetch Metadata| P3_3
    D_Storage -.->|Download File| P3_3
    D_Announce -.->|Fetch Messages| P3_3
```

## Level 2 DFD: Assessment System (Process 4.0)

A detailed breakdown of the **Assessment System**, highlighting the interaction between manual creation, AI generation, and grading.

```mermaid
graph TD
    %% Entities
    Teacher[Teacher]
    Student[Student]

    %% Sub-processes
    P4_1(4.1 Create Exam)
    P4_2(4.2 AI Question Generator)
    P4_3(4.3 Take Exam)
    P4_4(4.4 Grading & Feedback)

    %% Data Stores
    D_Exams[(Exams Collection)]
    D_Subs[(Submissions Collection)]

    %% Flows
    Teacher -->|Define Exam Parameters| P4_1
    P4_1 -->|Request Questions| P4_2
    P4_2 -->|Generated Questions| P4_1
    P4_1 -->|Save Exam| D_Exams

    Student -->|Select Exam| P4_3
    D_Exams -.->|Load Questions| P4_3
    P4_3 -->|Submit Answers| D_Subs

    Teacher -->|Review Submissions| P4_4
    D_Subs -.->|Student Answers| P4_4
    P4_4 -->|Update Grade| D_Subs
    D_Subs -.->|View Grade| Student
```

## Level 2 DFD: Attendance & Reporting (Process 5.0)

Breakdown of the UNOM marks submission and attendance tracking.

```mermaid
graph TD
    %% Entities
    Student[Student]
    Teacher[Teacher]
    Admin[Admin]

    %% Sub-processes
    P5_1(5.1 Submit UNOM Marks)
    P5_2(5.2 Calculate Analytics)
    P5_3(5.3 Generate Reports)

    %% Data Stores
    D_UNOM[(UNOM Reports DB)]
    D_Attend[(Attendance DB)]

    %% Flows
    Student -->|Enter Marks| P5_1
    P5_1 -->|Validate & Save| D_UNOM
    
    P5_1 -->|Trigger Calc| P5_2
    P5_2 -->|Update Ranks/Stats| D_UNOM

    Teacher -->|Request Class Stats| P5_3
    Admin -->|Request System Stats| P5_3
    D_UNOM -.->|Fetch Data| P5_3
    D_Attend -.->|Fetch Data| P5_3
    P5_3 -->|Display Dashboard| Teacher
    P5_3 -->|Display Analytics| Admin
```
