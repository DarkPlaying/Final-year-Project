// Authentication utility functions
import { User, UserRole } from '@/types/auth';
import { v4 as uuidv4 } from 'uuid'; // Ensure 'uuid' package is installed: npm install uuid @types/uuid

// Default admin credentials
const DEFAULT_ADMIN = {
  username: 'sanjay',
  password: 'Dark',
  role: 'admin' as UserRole,
  name: 'Sanjay Kumar',
  email: 'admin@examportal.com',
};

// Mock user database (in a real app, this would be in a backend database)
const USERS_KEY = 'exam_portal_users';
const SESSION_KEY = 'exam_portal_session';

// Initialize default users
export const initializeUsers = () => {
  const users = localStorage.getItem(USERS_KEY);
  if (!users) {
    const defaultUsers = [
      {
        id: uuidv4(), // Ensure default admin also gets a UUID
        username: DEFAULT_ADMIN.username,
        password: DEFAULT_ADMIN.password, // Store password for default admin
        role: DEFAULT_ADMIN.role,
        name: DEFAULT_ADMIN.name,
        email: DEFAULT_ADMIN.email,
      },
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }
};

// Login function
export const login = (usernameOrEmail: string, passwordAttempt: string): User | null => {
  const usersData = localStorage.getItem(USERS_KEY);
  if (!usersData) return null;

  const users: (User & { password?: string })[] = JSON.parse(usersData); // Ensure password is present for comparison
  const user = users.find(
    (u: any) => (u.username === usernameOrEmail || u.email === usernameOrEmail) && u.password === passwordAttempt
  );

  if (user) {
    // Create session (excluding password for security)
    const { password: _, ...userWithoutPassword } = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(userWithoutPassword));
    return userWithoutPassword;
  }

  return null;
};

// Logout function
export const logout = () => {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem('userId');
  localStorage.removeItem('userRole');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('loginExpiresAt');
  localStorage.removeItem('sessionId');
  sessionStorage.removeItem('sessionId');
};

// Get current user session (always without password)
export const getCurrentUser = (): User | null => {
  // Check for Firebase session keys first (set by Login.tsx)
  const userId = localStorage.getItem('userId');
  const userRole = localStorage.getItem('userRole');
  const userEmail = localStorage.getItem('userEmail');

  if (userId && userRole && userEmail) {
    return {
      id: userId,
      role: userRole as UserRole,
      email: userEmail,
      username: userEmail,
      name: userEmail.split('@')[0], // Placeholder
    };
  }

  const session = localStorage.getItem(SESSION_KEY);
  if (session) {
    // Parse session as possibly including a password (defensive) so we can
    // safely destructure it away. The stored session should not include
    // the password, but casting here avoids TypeScript errors if it does.
    const user = JSON.parse(session) as User & { password?: string };
    // Ensure password is not returned even if somehow present in session storage
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword as User;
  }
  return null;
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return getCurrentUser() !== null;
};

// Get all users (for internal admin use, includes passwords for consistency with storage)
export const getAllUsers = (): (User & { password?: string })[] => { // Return with optional password
  const usersData = localStorage.getItem(USERS_KEY);
  if (!usersData) return [];

  return JSON.parse(usersData); // Return full user objects as stored
};

// Helper to save all users to localStorage
const saveAllUsers = (users: (User & { password?: string })[]) => { // Accepts users with optional password
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

// Add new user (admin only)
export const addUser = (userData: Omit<User, 'id'> & { password: string; department?: string }): boolean => {
  const users = getAllUsers(); // Get users with passwords for uniqueness check

  // Ensure username is unique
  const existingUserByUsername = users.find(u => u.username === userData.username);
  if (existingUserByUsername) {
    console.error('Username already exists:', userData.username);
    return false;
  }

  // Ensure email is unique
  const existingUserByEmail = users.find(u => u.email === userData.email);
  if (existingUserByEmail) {
    console.error('Email already exists:', userData.email);
    return false;
  }

  const newUser = {
    ...userData,
    id: uuidv4(), // Generate a unique ID for each user
  };

  users.push(newUser);
  saveAllUsers(users);
  return true;
};

// Remove user (admin only)
export const removeUser = (userId: string): boolean => {
  let users = getAllUsers();
  const initialLength = users.length;
  users = users.filter(user => user.id !== userId); // Filter by unique ID
  saveAllUsers(users);
  return users.length < initialLength; // Return true if a user was removed
};

// Parse CSV and add users in bulk
export const addUsersFromCSV = (csvContent: string): { success: number; failed: number } => {
  const lines = csvContent.trim().split('\n');
  let success = 0;
  let failed = 0;

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Assuming CSV format: Full Name,Email,Password,Role,Department
    const [name, email, password, role, department] = line.split(',').map(s => s.trim());

    if (name && email && password && role) {
      const username = name.toLowerCase().replace(/\s+/g, '.'); // Derive username
      const added = addUser({ username, role: role as UserRole, name, email, password, department });
      if (added) success++;
      else failed++;
    } else {
      failed++;
    }
  }

  return { success, failed };
};
