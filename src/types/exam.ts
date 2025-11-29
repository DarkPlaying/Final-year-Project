/**
 * Exam and Assignment Type Definitions
 * Handles Google Drive/Form integration for exams, syllabi, and assignments
 */

export interface Exam {
  id: string;
  title: string;
  description: string;
  googleFormLink: string;
  duration: string;
  createdBy: string;
  createdAt: string;
  isActive: boolean;
}

export interface Syllabus {
  id: string;
  name: string;
  googleDriveLink: string;
  uploadedBy: string;
  uploadedAt: string;
  subject: string;
}

export interface Assignment {
  id: string;
  studentName: string;
  studentId: string;
  assignmentTitle: string;
  googleDriveLink: string;
  submittedAt: string;
  status: 'Pending' | 'Reviewed';
  grade?: string;
  feedback?: string;
}
