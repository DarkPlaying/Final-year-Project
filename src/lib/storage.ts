/**
 * LocalStorage Management for Exams, Syllabi, and Assignments
 * Provides CRUD operations with Google Drive/Form integration
 */

import { Exam, Syllabus, Assignment } from '@/types/exam';

const STORAGE_KEYS = {
  EXAMS: 'eduportal_exams',
  SYLLABI: 'eduportal_syllabi',
  ASSIGNMENTS: 'eduportal_assignments',
};

// Exam Management
export const getAllExams = (): Exam[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
  return data ? JSON.parse(data) : [];
};

export const addExam = (exam: Omit<Exam, 'id' | 'createdAt'>): Exam => {
  const exams = getAllExams();
  const newExam: Exam = {
    ...exam,
    id: `exam_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  exams.push(newExam);
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
  return newExam;
};

export const deleteExam = (id: string): boolean => {
  const exams = getAllExams();
  const filtered = exams.filter(e => e.id !== id);
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(filtered));
  return filtered.length < exams.length;
};

export const updateExam = (id: string, updates: Partial<Exam>): boolean => {
  const exams = getAllExams();
  const index = exams.findIndex(e => e.id === id);
  if (index === -1) return false;
  exams[index] = { ...exams[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
  return true;
};

export const getActiveExams = (): Exam[] => {
  return getAllExams().filter(e => e.isActive);
};

// Syllabus Management
export const getAllSyllabi = (): Syllabus[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SYLLABI);
  return data ? JSON.parse(data) : [];
};

export const addSyllabus = (syllabus: Omit<Syllabus, 'id' | 'uploadedAt'>): Syllabus => {
  const syllabi = getAllSyllabi();
  const newSyllabus: Syllabus = {
    ...syllabus,
    id: `syllabus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    uploadedAt: new Date().toISOString(),
  };
  syllabi.push(newSyllabus);
  localStorage.setItem(STORAGE_KEYS.SYLLABI, JSON.stringify(syllabi));
  return newSyllabus;
};

export const deleteSyllabus = (id: string): boolean => {
  const syllabi = getAllSyllabi();
  const filtered = syllabi.filter(s => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SYLLABI, JSON.stringify(filtered));
  return filtered.length < syllabi.length;
};

export const updateSyllabus = (id: string, updates: Partial<Syllabus>): boolean => {
  const syllabi = getAllSyllabi();
  const index = syllabi.findIndex(s => s.id === id);
  if (index === -1) return false;
  syllabi[index] = { ...syllabi[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.SYLLABI, JSON.stringify(syllabi));
  return true;
};

// Assignment Management
export const getAllAssignments = (): Assignment[] => {
  const data = localStorage.getItem(STORAGE_KEYS.ASSIGNMENTS);
  return data ? JSON.parse(data) : [];
};

export const addAssignment = (assignment: Omit<Assignment, 'id' | 'submittedAt' | 'status'>): Assignment => {
  const assignments = getAllAssignments();
  const newAssignment: Assignment = {
    ...assignment,
    id: `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    submittedAt: new Date().toISOString(),
    status: 'Pending',
  };
  assignments.push(newAssignment);
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  return newAssignment;
};

export const updateAssignment = (id: string, updates: Partial<Assignment>): boolean => {
  const assignments = getAllAssignments();
  const index = assignments.findIndex(a => a.id === id);
  if (index === -1) return false;
  assignments[index] = { ...assignments[index], ...updates };
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(assignments));
  return true;
};

export const deleteAssignment = (id: string): boolean => {
  const assignments = getAllAssignments();
  const filtered = assignments.filter(a => a.id !== id);
  localStorage.setItem(STORAGE_KEYS.ASSIGNMENTS, JSON.stringify(filtered));
  return filtered.length < assignments.length;
};

export const getAssignmentsByStudent = (studentId: string): Assignment[] => {
  return getAllAssignments().filter(a => a.studentId === studentId);
};

export const getPendingAssignments = (): Assignment[] => {
  return getAllAssignments().filter(a => a.status === 'Pending');
};
