import { useState, useRef, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Users,
  UserPlus,
  Upload,
  Trash2,
  LayoutDashboard,
  Settings,
  Briefcase,
  MessageSquare,
  Bot,
  AlertTriangle,
  RefreshCw,
  Undo2,
  Calendar as CalendarIcon,
  X,
  Download,
  FileSpreadsheet,
  GraduationCap,
  School,
  LineChart as LineChartIcon,
  CloudSun,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';
import { UserRole } from '@/types/auth';
import { db } from '@/lib/firebase';
import { secondaryDb } from '@/lib/firebaseSecondary';
import { hashPassword } from '@/lib/security';
import {
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  writeBatch,
  limit,
  onSnapshot,
  setDoc
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, signInWithEmailAndPassword } from 'firebase/auth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  department?: string;
  createdAt?: any;
}

interface Workspace {
  id: string;
  name: string;
  category: string;
  teachers: string[];
  students: string[];
  createdAt: any;
}

interface QueryItem {
  id: string;
  query: string;
  userEmail: string;
  status: 'pending' | 'replied' | 'solved' | 'withdrawn';
  createdAt: any;
  reply?: string;
  adminReply?: string;
}

const AdminDashboard = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [users, setUsers] = useState<Profile[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [stats, setStats] = useState({ users: 0, students: 0, teachers: 0, workspaces: 0 });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [sessionTimeLeft, setSessionTimeLeft] = useState<string>('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [recentOperations, setRecentOperations] = useState<any[]>([
    { action: 'System Startup', time: new Date().toLocaleTimeString(), type: 'info' },
    { action: 'Dashboard Loaded', time: new Date().toLocaleTimeString(), type: 'success' }
  ]);

  const logOperation = (action: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const newOp = { action, time: new Date().toLocaleTimeString(), type };
    setRecentOperations(prev => [newOp, ...prev].slice(0, 10));
  };

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCsvDialog, setShowCsvDialog] = useState(false);
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);

  // CSV Preview State
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);

  // Form states
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'student' as UserRole,
    department: '',
  });
  const [newWorkspace, setNewWorkspace] = useState({ name: '', category: '' });

  // Workspace Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>(null);
  const [navSearchQuery, setNavSearchQuery] = useState('');
  const [showNavSuggestions, setShowNavSuggestions] = useState(false);

  // Pagination State
  const [userPage, setUserPage] = useState(1);
  const [workspacePage, setWorkspacePage] = useState(1);
  const [workspaceStudentPages, setWorkspaceStudentPages] = useState<Record<string, number>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = () => {
    localStorage.clear();
    window.location.replace('/');
  };

  const onMaintenanceModeChange = () => {
    const unsub = onSnapshot(doc(db, 'system', 'maintenance'), (doc) => {
      if (doc.exists()) {
        setMaintenanceMode(doc.data().enabled);
      }
    });
    return unsub;
  };

  useEffect(() => {
    loadDashboardData();
    loadUploadHistory();
    fetchWeather();

    // Maintenance mode listener
    const unsubscribe = onMaintenanceModeChange();

    // Session timer
    const timer = setInterval(() => {
      const expiresAt = localStorage.getItem('loginExpiresAt');
      if (expiresAt) {
        const diff = parseInt(expiresAt) - Date.now();
        if (diff <= 0) {
          setSessionTimeLeft('Expired');
        } else {
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setSessionTimeLeft(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      }
    }, 1000);

    // Session Concurrency Listener
    const uid = localStorage.getItem('userId');
    const unsubSession = onSnapshot(doc(db, 'users', uid || 'dummy'), (docSnap) => {
      if (!docSnap.exists()) {
        toast.error('Your account no longer exists.');
        handleLogout();
        return;
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentSessionId = localStorage.getItem('sessionId');
        if (data.activeSessionId && data.activeSessionId !== currentSessionId) {
          toast.error('You have been logged out because your account was logged in from another device.');
          handleLogout();
        }
      }
    });

    return () => {
      unsubscribe();
      unsubSession();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setUserPage(1);
      loadUsers(userSearchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [userSearchQuery]);





  useEffect(() => {
    const timer = setTimeout(() => {
      setWorkspacePage(1);
      loadWorkspaces(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const loadDashboardData = async () => {
    await Promise.all([
      loadUsers(),
      loadWorkspaces(),
      loadQueries(),
      loadStats()
    ]);
  };

  const loadStats = async () => {
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const workspacesSnap = await getDocs(collection(db, 'workspaces'));

      let studentCount = 0;
      let teacherCount = 0;
      const growth: any = {};

      usersSnap.forEach(doc => {
        const data = doc.data();
        if (data.role === 'student') studentCount++;
        if (data.role === 'teacher') teacherCount++;

        // Process growth data
        if (data.createdAt) {
          const date = data.createdAt.toDate().toISOString().split('T')[0];
          growth[date] = (growth[date] || 0) + 1;
        }
      });

      setStats({
        users: usersSnap.size,
        students: studentCount,
        teachers: teacherCount,
        workspaces: workspacesSnap.size
      });

      // Format growth data for chart
      const chartData = Object.keys(growth).sort().slice(-30).map(date => ({
        date,
        users: growth[date]
      }));
      setUserGrowthData(chartData);

    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadUsers = async (search = '') => {
    try {
      const usersRef = collection(db, 'users');
      let loadedUsers: Profile[] = [];

      if (!search.trim()) {
        const q = query(usersRef, orderBy('createdAt', 'desc'), limit(10));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          const data = doc.data() as any;
          if (data.role !== 'admin') {
            loadedUsers.push({
              id: doc.id,
              full_name: data.name || data.full_name || 'Unknown',
              email: data.email,
              role: data.role,
              department: data.department || '-',
              createdAt: data.createdAt
            });
          }
        });
      } else {
        const term = search.toLowerCase();
        const qEmail = query(
          usersRef,
          where('email_lower', '>=', term),
          where('email_lower', '<=', term + '\uf8ff'),
          limit(20)
        );

        const qName = query(
          usersRef,
          where('name', '>=', search),
          where('name', '<=', search + '\uf8ff'),
          limit(20)
        );

        const [emailSnap, nameSnap] = await Promise.all([getDocs(qEmail), getDocs(qName)]);
        const usersMap = new Map();

        const processDoc = (doc: any) => {
          const data = doc.data();
          if (data.role !== 'admin') {
            usersMap.set(doc.id, {
              id: doc.id,
              full_name: data.name || data.full_name || 'Unknown',
              email: data.email,
              role: data.role,
              department: data.department || '-',
              createdAt: data.createdAt
            });
          }
        };

        emailSnap.forEach(processDoc);
        nameSnap.forEach(processDoc);
        loadedUsers = Array.from(usersMap.values());
      }

      setUsers(loadedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    }
  };

  const loadWorkspaces = async (search = '') => {
    try {
      const workspacesRef = collection(db, 'workspaces');
      let q;

      if (!search.trim()) {
        q = query(workspacesRef, orderBy('createdAt', 'desc'), limit(2));
      } else {
        const term = search; // Case sensitive for now as we don't have lower case field
        q = query(
          workspacesRef,
          where('name', '>=', term),
          where('name', '<=', term + '\uf8ff'),
          limit(10)
        );
      }

      const snapshot = await getDocs(q);
      const loadedWorkspaces: Workspace[] = [];
      snapshot.forEach(doc => {
        const data = doc.data() as any;
        loadedWorkspaces.push({
          id: doc.id,
          name: data.name,
          category: data.category || 'General',
          teachers: data.teachers || [],
          students: data.students || [],
          createdAt: data.createdAt
        });
      });
      setWorkspaces(loadedWorkspaces);
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  };

  const loadQueries = async () => {
    try {
      const q = query(collection(db, 'queries'), orderBy('createdAt', 'desc'), limit(50));
      const snapshot = await getDocs(q);
      const loadedQueries: QueryItem[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        loadedQueries.push({
          id: doc.id,
          query: data.query || data.question,
          userEmail: data.userEmail,
          status: data.status || 'pending',
          createdAt: data.createdAt,
          reply: data.reply,
          adminReply: data.adminReply
        });
      });
      setQueries(loadedQueries);
    } catch (error) {
      console.error('Error loading queries:', error);
    }
  };

  const loadUploadHistory = () => {
    const history = localStorage.getItem('uploadHistory');
    if (history) {
      setUploadHistory(JSON.parse(history));
    }
  };

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.password || !newUser.full_name) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // 1. Check if user exists in Main DB
      const q = query(collection(db, 'users'), where('email_lower', '==', newUser.email.toLowerCase()));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        toast.error('User already exists');
        return;
      }

      const hashedPassword = await hashPassword(newUser.password);

      // 2. Create in Main Auth
      let mainUid = '';
      try {
        // We need a temporary secondary app for Main Auth creation to avoid logging out the admin
        // BUT 'createUserWithEmailAndPassword' signs in automatically.
        // Strategy: Use a temporary app instance for Main Auth creation too, or just use the Admin SDK (not available here).
        // Client-side workaround: Create a second instance of the Main App just for creation.
        const tempMainApp = initializeApp({
          apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID
        }, "TempMainApp");
        const tempMainAuth = getAuth(tempMainApp);

        const mainCred = await createUserWithEmailAndPassword(tempMainAuth, newUser.email, newUser.password);
        mainUid = mainCred.user.uid;
        await deleteApp(tempMainApp);
      } catch (e: any) {
        toast.error(`Main Auth Error: ${e.message}`);
        return;
      }

      // 3. Create in Secondary Auth
      let secUid = '';
      const secondaryApp = initializeApp({
        apiKey: import.meta.env.VITE_ATTENDANCE_API_KEY,
        authDomain: import.meta.env.VITE_ATTENDANCE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_ATTENDANCE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_ATTENDANCE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_ATTENDANCE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_ATTENDANCE_APP_ID
      }, "TempSecondaryApp");
      const secondaryAuth = getAuth(secondaryApp);

      try {
        const secCred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
        secUid = secCred.user.uid;
        await deleteApp(secondaryApp);
      } catch (e: any) {
        toast.error(`Secondary Auth Error: ${e.message}`);
        // Cleanup Main Auth user if possible? Complex. Proceeding.
      }

      // 4. Save to Main DB (using mainUid)
      await setDoc(doc(db, 'users', mainUid), {
        name: newUser.full_name,
        email: newUser.email,
        email_lower: newUser.email.toLowerCase(),
        password: hashedPassword,
        role: newUser.role,
        department: newUser.department || '-',
        assignedWorkspaces: [],
        createdAt: serverTimestamp()
      });

      // 5. Save to Secondary DB (using secUid)
      if (secUid) {
        try {
          await setDoc(doc(secondaryDb, 'users', secUid), {
            name: newUser.full_name,
            email: newUser.email,
            role: newUser.role,
            createdAt: serverTimestamp()
          });
        } catch (secError) {
          console.error("Failed to sync to secondary DB:", secError);
        }
      }

      toast.success('User added successfully to both systems');
      logOperation(`Added user: ${newUser.email}`, 'success');
      setShowAddDialog(false);
      setNewUser({ email: '', password: '', full_name: '', role: 'student', department: '' });
      loadUsers();
      loadStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to add user');
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to delete ${userEmail}?`)) return;

    try {
      // Remove from workspaces first
      const workspacesSnap = await getDocs(collection(db, 'workspaces'));
      const batch = writeBatch(db);

      workspacesSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.teachers?.includes(userEmail) || data.students?.includes(userEmail)) {
          const wsRef = doc.ref;
          batch.update(wsRef, {
            teachers: arrayRemove(userEmail),
            students: arrayRemove(userEmail)
          });
        }
      });

      await batch.commit();
      await deleteDoc(doc(db, 'users', userId));

      // Sync delete to Secondary DB
      try {
        await deleteDoc(doc(secondaryDb, 'users', userId));
      } catch (secError) {
        console.error("Failed to delete from secondary DB:", secError);
      }

      toast.success('User deleted successfully');
      logOperation(`Deleted user: ${userEmail}`, 'warning');
      loadUsers();
      loadStats();
    } catch (error: any) {
      toast.error('Failed to delete user');
      console.error(error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvContent = event.target?.result as string;
      const lines = csvContent.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

        const allData = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim());
          const obj: any = {};
          headers.forEach((h, i) => obj[h] = values[i]);
          return obj;
        });

        setCsvData(allData);
        setCsvPreview(allData.slice(0, 5));
      }
    };
    reader.readAsText(file);
  };



  const handleCSVUpload = async () => {
    if (!csvFile || csvData.length === 0) return;

    // Initialize secondary app for Auth creation
    const secondaryApp = initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    }, "SecondaryApp_CSV");
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const batch = writeBatch(db);
      const secondaryBatch = writeBatch(secondaryDb);
      let successCount = 0;
      let errorCount = 0;
      const uploadedUserIds: any[] = [];

      toast.loading(`Processing ${csvData.length} users...`);

      for (const user of csvData) {
        // Basic validation
        if (!user.name || !user.email || !user.password || !user.role) {
          errorCount++;
          continue;
        }

        const emailLower = user.email.toLowerCase();
        let userId = '';
        let isNewUser = false;

        // Check if user exists in Firestore
        const q = query(collection(db, 'users'), where('email_lower', '==', emailLower));
        const snap = await getDocs(q);

        if (!snap.empty) {
          // User exists in Firestore
          userId = snap.docs[0].id;
        } else {
          // Create new user in Firebase Auth
          let mainUid = '';
          let secUid = '';

          // 1. Create in Main Auth
          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, user.email, user.password);
            mainUid = userCredential.user.uid;
            isNewUser = true;
          } catch (authError: any) {
            console.error(`Failed to create Main Auth for ${user.email}:`, authError);
            if (authError.code === 'auth/email-already-in-use') {
              // User exists in Auth but not Firestore (e.g. deleted workspace).
              // Attempt to RECOVER by signing in to get UID.
              try {
                const recoveredCred = await signInWithEmailAndPassword(secondaryAuth, user.email, user.password);
                mainUid = recoveredCred.user.uid;
                isNewUser = false; // Not technically new auth, but new profile
                // We must sign out immediately to not switch the admin's session
                // BUT secondaryAuth is a separate instance, so it shouldn't affect main auth?
                // Actually 'secondaryAuth' here is initialized as 'SecondaryApp_CSV', so it's isolated.
                // We are good.
              } catch (loginError) {
                console.error(`Failed to recover user ${user.email} via login:`, loginError);
                errorCount++;
                continue;
              }
            } else {
              errorCount++;
              continue;
            }
          }

          // 2. Create in Secondary Auth (Attendance DB)
          // We need a temp app for this
          const tempSecApp = initializeApp({
            apiKey: import.meta.env.VITE_ATTENDANCE_API_KEY,
            authDomain: import.meta.env.VITE_ATTENDANCE_AUTH_DOMAIN,
            projectId: import.meta.env.VITE_ATTENDANCE_PROJECT_ID,
            storageBucket: import.meta.env.VITE_ATTENDANCE_STORAGE_BUCKET,
            messagingSenderId: import.meta.env.VITE_ATTENDANCE_MESSAGING_SENDER_ID,
            appId: import.meta.env.VITE_ATTENDANCE_APP_ID
          }, `TempSecApp_${Date.now()}_${Math.random()}`);
          const tempSecAuth = getAuth(tempSecApp);

          try {
            const secCred = await createUserWithEmailAndPassword(tempSecAuth, user.email, user.password);
            secUid = secCred.user.uid;
            await deleteApp(tempSecApp);
          } catch (secAuthError: any) {
            console.error(`Failed to create Secondary Auth for ${user.email}:`, secAuthError);
            if (secAuthError.code === 'auth/email-already-in-use') {
              // Recover Secondary UID
              try {
                const recoveredSecCred = await signInWithEmailAndPassword(tempSecAuth, user.email, user.password);
                secUid = recoveredSecCred.user.uid;
              } catch (secLoginErr) {
                console.error("Failed to recover secondary auth:", secLoginErr);
              }
            }
            await deleteApp(tempSecApp);
          }

          userId = mainUid; // We use Main UID for Main DB

          // Create new user document in Firestore with Auth UID
          const newUserRef = doc(db, 'users', userId);
          batch.set(newUserRef, {
            full_name: user.name,
            email: user.email,
            email_lower: emailLower,
            password: await hashPassword(user.password), // Hash for backup/reference
            role: user.role.toLowerCase(),
            department: user.department || '-',
            assignedWorkspaces: activeWorkspaceId ? [activeWorkspaceId] : [],
            createdAt: serverTimestamp(),
            uploadedViaCSV: true
          });

          // Sync to Secondary DB (using Secondary UID if available, else Main UID - wait, rules check request.auth.uid)
          // If we created a secondary auth user, we MUST use THAT uid for the secondary DB doc.
          if (secUid) {
            const secUserRef = doc(secondaryDb, 'users', secUid);
            secondaryBatch.set(secUserRef, {
              name: user.name,
              email: user.email,
              role: user.role.toLowerCase(),
              createdAt: serverTimestamp(),
              uploadedViaCSV: true
            });
          }
        }

        // If uploading to a specific workspace
        if (activeWorkspaceId) {
          const wsRef = doc(db, 'workspaces', activeWorkspaceId);
          const field = user.role.toLowerCase() === 'teacher' ? 'teachers' : 'students';

          // Add user email to workspace's teachers/students list
          batch.update(wsRef, {
            [field]: arrayUnion(emailLower)
          });

          // If user already existed (wasn't new), update their assignedWorkspaces
          if (!isNewUser) {
            batch.update(doc(db, 'users', userId), {
              assignedWorkspaces: arrayUnion(activeWorkspaceId)
            });
          }
        }

        uploadedUserIds.push({ id: userId, email: user.email, role: user.role });
        successCount++;
      }

      await batch.commit();
      try {
        await secondaryBatch.commit();
      } catch (secError) {
        console.error("Failed to commit to secondary DB:", secError);
        toast.warning("Users uploaded, but failed to sync to Attendance DB");
      }

      // Update history
      const newHistory = [{
        timestamp: new Date().toISOString(),
        count: successCount,
        users: uploadedUserIds,
        workspaceId: activeWorkspaceId
      }, ...uploadHistory].slice(0, 5);

      setUploadHistory(newHistory);
      localStorage.setItem('uploadHistory', JSON.stringify(newHistory));

      toast.dismiss();
      toast.success(`Successfully processed ${successCount} users`);
      if (errorCount > 0) toast.warning(`${errorCount} users failed (duplicates or invalid data)`);

      setShowCsvDialog(false);
      setCsvFile(null);
      setCsvData([]);
      setCsvPreview([]);
      setActiveWorkspaceId(null);
      setActiveWorkspaceName(null);
      loadUsers();
      loadWorkspaces();
      loadStats();
      logOperation(`CSV Upload: ${successCount} users`, 'success');

    } catch (error) {
      console.error(error);
      toast.error('Failed to upload CSV');
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const handleOpenCsvUpload = (workspaceId?: string, workspaceName?: string) => {
    setActiveWorkspaceId(workspaceId || null);
    setActiveWorkspaceName(workspaceName || null);
    setShowCsvDialog(true);
  };

  const handleUndoUpload = async () => {
    if (uploadHistory.length === 0) return;
    const lastUpload = uploadHistory[0];

    let confirmMessage = `Undo last upload of ${lastUpload.count} users`;
    if (lastUpload.workspaceId) {
      confirmMessage += ` from workspace "${lastUpload.workspaceId}"`; // Note: workspaceId is ID, not name here
    }
    confirmMessage += '?';

    if (!confirm(confirmMessage)) return;

    try {
      let deleted = 0;
      for (const user of lastUpload.users) {
        // Only delete if still marked as CSV upload and no workspaces
        const userRef = doc(db, 'users', user.id);
        await deleteDoc(userRef);
        // Sync delete to Secondary DB
        try {
          await deleteDoc(doc(secondaryDb, 'users', user.id));
        } catch (e) {
          console.error("Failed to undo in secondary DB", e);
        }
        deleted++;
      }

      const newHistory = uploadHistory.slice(1);
      setUploadHistory(newHistory);
      localStorage.setItem('uploadHistory', JSON.stringify(newHistory));

      toast.success(`Undid upload of ${deleted} users`);
      logOperation(`Undo Upload: ${deleted} users`, 'warning');
      loadUsers();
      loadStats();
    } catch (error) {
      toast.error('Failed to undo upload');
    }
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspace.name.trim();
    const category = newWorkspace.category.trim();

    if (!name || !category) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      await addDoc(collection(db, 'workspaces'), {
        name: name,
        category: category,
        adminId: localStorage.getItem('userEmail'),
        teachers: [],
        students: [],
        createdAt: serverTimestamp()
      });

      toast.success('Workspace created');
      logOperation(`Created workspace: ${name}`, 'success');
      setShowWorkspaceDialog(false);
      setNewWorkspace({ name: '', category: '' });
      loadWorkspaces();
      loadStats();
    } catch (error) {
      toast.error('Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (id: string, name: string) => {
    if (!confirm(`Delete workspace "${name}" and all associated data? This cannot be undone.`)) return;

    const deleteInBatches = async (docs: any[], dbInstance = db) => {
      const chunks = [];
      for (let i = 0; i < docs.length; i += 400) {
        chunks.push(docs.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = writeBatch(dbInstance);
        chunk.forEach((d: any) => batch.delete(d.ref));
        await batch.commit();
      }
    };

    try {
      toast.loading('Deleting workspace data...');
      console.log(`Starting delete for workspace: ${id} (${name})`);

      // 1. Get workspace data to find users
      const wsDoc = await getDoc(doc(db, 'workspaces', id));
      if (!wsDoc.exists()) {
        toast.dismiss();
        toast.error('Workspace not found');
        return;
      }
      const wsData = wsDoc.data();
      // Deduplicate emails
      const userEmails = Array.from(new Set([...(wsData.teachers || []), ...(wsData.students || [])]));

      // 2. Find Users and their related data (Queries, Submissions)
      const userDocsToDelete: any[] = [];
      const queryDocsToDelete: any[] = [];
      const submissionDocsToDelete: any[] = [];
      const workspaceDocsToDelete: any[] = [];

      try {
        const seenUserIds = new Set();
        const seenQueryIds = new Set();
        const seenSubmissionIds = new Set();

        // Find users by email
        if (userEmails.length > 0) {
          const emailChunks = [];
          for (let i = 0; i < userEmails.length; i += 10) {
            emailChunks.push(userEmails.slice(i, i + 10));
          }

          for (const chunk of emailChunks) {
            const userQ = query(collection(db, 'users'), where('email', 'in', chunk));
            const userSnap = await getDocs(userQ);
            userSnap.forEach(d => {
              if (!seenUserIds.has(d.id)) {
                seenUserIds.add(d.id);
                userDocsToDelete.push(d);
              }
            });

            const queryQ = query(collection(db, 'queries'), where('userEmail', 'in', chunk));
            const querySnap = await getDocs(queryQ);
            querySnap.forEach(d => {
              if (!seenQueryIds.has(d.id)) {
                seenQueryIds.add(d.id);
                queryDocsToDelete.push(d);
              }
            });
          }
        }

        // Find submissions by Student ID
        const studentIds = userDocsToDelete
          .filter(d => d.data().role === 'student')
          .map(d => d.id);

        if (studentIds.length > 0) {
          const idChunks = [];
          for (let i = 0; i < studentIds.length; i += 10) {
            idChunks.push(studentIds.slice(i, i + 10));
          }

          for (const chunk of idChunks) {
            const subQ1 = query(collection(db, 'submissions'), where('studentId', 'in', chunk));
            const subSnap1 = await getDocs(subQ1);
            subSnap1.forEach(d => {
              if (!seenSubmissionIds.has(d.id)) {
                seenSubmissionIds.add(d.id);
                submissionDocsToDelete.push(d);
              }
            });

            const subQ2 = query(collection(db, 'submissions'), where('student_id', 'in', chunk));
            const subSnap2 = await getDocs(subQ2);
            subSnap2.forEach(d => {
              if (!seenSubmissionIds.has(d.id)) {
                seenSubmissionIds.add(d.id);
                submissionDocsToDelete.push(d);
              }
            });
          }
        }

        // Also try finding submissions by workspaceId directly
        const subQWs = query(collection(db, 'submissions'), where('workspaceId', '==', id));
        const subSnapWs = await getDocs(subQWs);
        subSnapWs.forEach(d => {
          if (!seenSubmissionIds.has(d.id)) {
            seenSubmissionIds.add(d.id);
            submissionDocsToDelete.push(d);
          }
        });

        // 3. Find Workspace-related collections
        const collectionsToCheck = [
          'announcements',
          'exams',
          'settings',
          'syllabi',
          'system',
          'teacher_uploads'
        ];

        for (const colName of collectionsToCheck) {
          const q = query(collection(db, colName), where('workspaceId', '==', id));
          const snap = await getDocs(q);
          snap.forEach(d => workspaceDocsToDelete.push(d));
        }

      } catch (fetchError) {
        console.warn('Error fetching related data:', fetchError);
        toast.warning('Could not find all related data, but deleting workspace...');
      }

      // 4. Execute Deletions in Batches
      try {
        if (submissionDocsToDelete.length > 0) await deleteInBatches(submissionDocsToDelete);
        if (queryDocsToDelete.length > 0) await deleteInBatches(queryDocsToDelete);
        if (workspaceDocsToDelete.length > 0) await deleteInBatches(workspaceDocsToDelete);

        if (userDocsToDelete.length > 0) {
          await deleteInBatches(userDocsToDelete);

          // Sync delete to Secondary DB for these users
          try {
            const batchSec = writeBatch(secondaryDb);
            let count = 0;
            for (const userDoc of userDocsToDelete) {
              batchSec.delete(doc(secondaryDb, 'users', userDoc.id));
              count++;
              if (count >= 400) {
                await batchSec.commit();
                count = 0;
              }
            }
            if (count > 0) await batchSec.commit();
          } catch (secErr) {
            console.error("Failed to sync delete users in secondary DB:", secErr);
          }
        }
      } catch (e) {
        console.warn('Error deleting some related data:', e);
        toast.warning('Some related data could not be deleted');
      }

      // 5. Delete Attendance (Separate DB)
      try {
        const attendanceQ = query(collection(db, 'attendance'), where('workspaceId', '==', id));
        const attendanceSnap = await getDocs(attendanceQ);
        await deleteInBatches(attendanceSnap.docs, db);
      } catch (e) {
        console.warn('Error deleting attendance data (check permissions):', e);
        // Do not fail the whole operation if attendance DB is inaccessible
      }

      // 6. Delete Workspace
      await deleteDoc(doc(db, 'workspaces', id));

      toast.dismiss();
      toast.success('Workspace deleted');
      logOperation(`Deleted workspace: ${name}`, 'warning');
      loadWorkspaces();
      loadStats();
    } catch (error) {
      console.error('Delete workspace error:', error);
      toast.dismiss();
      toast.error('Failed to delete workspace. Check console for details.');
    }
  };

  const handleAddMember = async (workspaceId: string, role: 'teacher' | 'student', emailInput: string) => {
    const email = emailInput.trim();
    if (!email) return;

    try {
      // 1. Try finding by email_lower first (best practice if data is consistent)
      let q = query(collection(db, 'users'), where('email_lower', '==', email.toLowerCase()), where('role', '==', role));
      let snap = await getDocs(q);

      // 2. Fallback: Try finding by email (case-sensitive or if email_lower missing)
      if (snap.empty) {
        q = query(collection(db, 'users'), where('email', '==', email), where('role', '==', role));
        snap = await getDocs(q);
      }

      if (snap.empty) {
        toast.error(`${role} with email ${email} not found`);
        return;
      }

      const userId = snap.docs[0].id;
      const wsRef = doc(db, 'workspaces', workspaceId);
      const userRef = doc(db, 'users', userId);

      const field = role === 'teacher' ? 'teachers' : 'students';

      await updateDoc(wsRef, {
        [field]: arrayUnion(email.toLowerCase())
      });

      await updateDoc(userRef, {
        assignedWorkspaces: arrayUnion(workspaceId)
      });

      toast.success('Member added');
      loadWorkspaces();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add member');
    }
  };

  const handleRemoveMember = async (workspaceId: string, role: 'teacher' | 'student', email: string) => {
    if (!confirm(`Remove ${email}?`)) return;

    try {
      const wsRef = doc(db, 'workspaces', workspaceId);
      const field = role === 'teacher' ? 'teachers' : 'students';

      await updateDoc(wsRef, {
        [field]: arrayRemove(email)
      });

      // Try to update user, but don't fail if not found
      const q = query(collection(db, 'users'), where('email_lower', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        await updateDoc(doc(db, 'users', snap.docs[0].id), {
          assignedWorkspaces: arrayRemove(workspaceId)
        });
      }

      toast.success('Member removed');
      loadWorkspaces();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const toggleMaintenanceMode = async () => {
    const newState = !maintenanceMode;
    if (newState && !confirm('Enable maintenance mode? This will block user logins.')) return;

    try {
      await updateDoc(doc(db, 'system', 'maintenance'), {
        enabled: newState,
        updatedAt: serverTimestamp()
      }).catch(async () => {
        // Create if doesn't exist
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'system', 'maintenance'), {
          enabled: newState,
          updatedAt: serverTimestamp()
        });
      });

      setMaintenanceMode(newState);
      toast.success(`Maintenance mode ${newState ? 'enabled' : 'disabled'}`);
      logOperation(`Maintenance mode ${newState ? 'enabled' : 'disabled'}`, 'warning');
    } catch (error) {
      toast.error('Failed to toggle maintenance mode');
    }
  };

  const fetchWeather = async () => {
    try {
      // Default to New Delhi if geolocation fails or permission denied
      let lat = 28.6139;
      let lon = 77.2090;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          lat = pos.coords.latitude;
          lon = pos.coords.longitude;
        } catch (e) {
          // Ignore error, use default
        }
      }

      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      const data = await res.json();

      // Map weather code
      const code = data.current_weather.weathercode;
      let condition = 'Clear';
      if (code > 0 && code <= 3) condition = 'Cloudy';
      else if (code >= 45 && code <= 48) condition = 'Foggy';
      else if (code >= 51 && code <= 67) condition = 'Rainy';
      else if (code >= 71) condition = 'Snowy';

      setWeather({ ...data.current_weather, condition });
    } catch (e) {
      console.error('Weather error', e);
    }
  };



  const downloadSampleCSV = () => {
    const headers = "name,email,password,role,department";
    const rows = [
      "John Doe,john@example.com,pass123,teacher,Mathematics",
      "Jane Smith,jane@example.com,pass456,student,Science"
    ];
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_users.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadWorkspaceCSV = (ws: Workspace) => {
    const headers = ['Role', 'Email'];
    const rows = [
      ...ws.teachers.map(t => ['Teacher', t]),
      ...ws.students.map(s => ['Student', s])
    ];

    if (rows.length === 0) {
      toast.info('Downloading template (no members found)');
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${ws.name.replace(/\s+/g, '_')}_members.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter workspaces logic
  const filteredWorkspaces = workspaces.filter(ws => {
    const matchesCategory = selectedCategory === 'all' || ws.category === selectedCategory;
    return matchesCategory;
  });



  const categories = ['all', ...Array.from(new Set(workspaces.map(ws => ws.category)))];

  const handleReset = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  const sidebarItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Overview', onClick: () => setActiveSection('overview'), active: activeSection === 'overview' },
    { icon: <Users size={20} />, label: 'Manage Users', onClick: () => setActiveSection('users'), active: activeSection === 'users' },
    { icon: <Briefcase size={20} />, label: 'Workspaces', onClick: () => setActiveSection('workspaces'), active: activeSection === 'workspaces' },
    { icon: <MessageSquare size={20} />, label: 'View Queries', onClick: () => setActiveSection('queries'), active: activeSection === 'queries' },
    { icon: <Bot size={20} />, label: 'AI CSV Generator', onClick: () => setActiveSection('aiCsv'), active: activeSection === 'aiCsv' },
    { icon: <Settings size={20} />, label: 'Settings', onClick: () => setActiveSection('settings'), active: activeSection === 'settings' },
  ];

  const headerContent = (
    <div className="flex items-center gap-2 md:gap-4 mr-4">
      {/* Search Bar */}
      <div className="relative hidden md:block w-64 mr-2">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search sections..."
          className="pl-8 bg-slate-900 border-slate-700 h-9 text-sm"
          value={navSearchQuery}
          onChange={(e) => {
            setNavSearchQuery(e.target.value);
            setShowNavSuggestions(true);
          }}
          onFocus={() => setShowNavSuggestions(true)}
          onBlur={() => setTimeout(() => setShowNavSuggestions(false), 200)}
        />
        {showNavSuggestions && navSearchQuery && (
          <div className="absolute top-full left-0 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-lg z-50 overflow-hidden">
            {sidebarItems.filter(item => item.label.toLowerCase().includes(navSearchQuery.toLowerCase())).length > 0 ? (
              sidebarItems
                .filter(item => item.label.toLowerCase().includes(navSearchQuery.toLowerCase()))
                .map((item, index) => (
                  <button
                    key={index}
                    className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      item.onClick();
                      setNavSearchQuery('');
                      setShowNavSuggestions(false);
                      window.scrollTo(0, 0);
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))
            ) : (
              <div className="px-4 py-2 text-sm text-slate-500">No results found</div>
            )}
          </div>
        )}
      </div>

      <span className="text-sm text-muted-foreground bg-muted/50 px-3 py-1 rounded-full whitespace-nowrap">
        <span className="hidden lg:inline">Session expires in </span>{sessionTimeLeft}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        className="h-8"
      >
        <RefreshCw className="h-3.5 w-3.5 lg:mr-2" />
        <span className="hidden lg:inline">Refresh</span>
      </Button>
      <Button
        variant={maintenanceMode ? "destructive" : "outline"}
        size="sm"
        onClick={toggleMaintenanceMode}
        className={`h-8 border ${maintenanceMode ? 'border-red-600' : 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'}`}
      >
        <AlertTriangle className={`h-3.5 w-3.5 lg:mr-2 ${maintenanceMode ? 'text-white' : 'text-yellow-500'}`} />
        <span className="hidden lg:inline">Maintenance: {maintenanceMode ? 'ON' : 'OFF'}</span>
      </Button>
    </div>
  );

  return (
    <DashboardLayout sidebarItems={sidebarItems} title="Admin Dashboard" headerContent={headerContent}>
      {/* OVERVIEW SECTION */}
      {activeSection === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Total Users',
                value: stats.users,
                icon: Users,
                color: 'text-blue-400',
                bg: 'bg-blue-500/20',
                gradient: 'bg-gradient-to-br from-blue-900 to-slate-900',
                textColor: 'text-blue-200'
              },
              {
                title: 'Students',
                value: stats.students,
                icon: GraduationCap,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/20',
                gradient: 'bg-gradient-to-br from-emerald-900 to-slate-900',
                textColor: 'text-emerald-200'
              },
              {
                title: 'Teachers',
                value: stats.teachers,
                icon: School,
                color: 'text-violet-400',
                bg: 'bg-violet-500/20',
                gradient: 'bg-gradient-to-br from-violet-900 to-slate-900',
                textColor: 'text-violet-200'
              },
              {
                title: 'Workspaces',
                value: stats.workspaces,
                icon: Briefcase,
                color: 'text-amber-400',
                bg: 'bg-amber-500/20',
                gradient: 'bg-gradient-to-br from-amber-900/80 to-slate-900',
                textColor: 'text-amber-200'
              },
            ].map((stat, index) => (
              <Card key={index} className={`border-slate-700 ${stat.gradient} text-white shadow-lg hover:shadow-xl transition-all duration-200`}>
                <CardContent className="p-6 flex items-center justify-between">
                  <div>
                    <p className={`${stat.textColor} text-sm font-medium`}>{stat.title}</p>
                    <h3 className="text-4xl font-bold mt-2">{stat.value}</h3>
                    <p className="text-xs text-slate-400 mt-1">+2.5% from last month</p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.bg}`}>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Charts & Main Content (Spans 2 columns) */}
            <div className="lg:col-span-2 space-y-6">
              {/* User Growth Chart */}
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChartIcon className="h-5 w-5 text-blue-500" />
                    User Growth
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={userGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                        itemStyle={{ color: '#f8fafc' }}
                        cursor={{ stroke: '#334155', strokeWidth: 2 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="users"
                        stroke="#3b82f6"
                        strokeWidth={3}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4, stroke: '#1e293b' }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Recent Operations */}
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <RefreshCw className="h-5 w-5 text-green-400" /> Recent Operations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentOperations.map((op, i) => (
                      <div key={i} className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${op.type === 'success' ? 'bg-green-500' : op.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                          <span className="text-sm font-medium text-slate-200">{op.action}</span>
                        </div>
                        <span className="text-xs text-slate-500">{op.time}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: Widgets (Spans 1 column) */}
            <div className="space-y-6">
              {/* Recently Used Card */}
              <Card className="border-slate-800 bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg font-medium text-blue-400">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                    onClick={() => setActiveSection('users')}
                  >
                    <Users className="mr-2 h-4 w-4 text-blue-500" /> Manage Users
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                    onClick={() => setShowAddDialog(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4 text-emerald-500" /> Add New User
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 hover:bg-slate-800 text-slate-300"
                    onClick={() => setActiveSection('workspaces')}
                  >
                    <Briefcase className="mr-2 h-4 w-4 text-amber-500" /> Workspaces
                  </Button>
                </CardContent>
              </Card>

              {/* Calendar Card */}
              <Card className="border-slate-800 bg-slate-900/50 flex flex-col items-center">
                <CardHeader className="w-full pb-2 border-b border-slate-800/50">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-slate-200">
                    <CalendarIcon className="h-4 w-4 text-blue-500" /> Calendar
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 w-full flex justify-center">
                  <style>{`
                    .rdp { --rdp-cell-size: 32px; --rdp-accent-color: #3b82f6; margin: 0; }
                    .rdp-day_selected:not([disabled]) { background-color: var(--rdp-accent-color); color: white; }
                    .rdp-button:hover:not([disabled]):not(.rdp-day_selected) { background-color: #1e293b; }
                    .rdp-day { color: #cbd5e1; font-size: 0.875rem; }
                    .rdp-caption_label { color: #f8fafc; font-weight: 600; font-size: 0.9rem; }
                    .rdp-nav_button { color: #94a3b8; }
                    .rdp-head_cell { color: #64748b; font-size: 0.75rem; font-weight: 500; }
                  `}</style>
                  <DayPicker
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="bg-transparent"
                    showOutsideDays
                  />
                </CardContent>
              </Card>

              {/* Weather Card */}
              <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
                <CardHeader className="pb-2 flex flex-row items-center justify-between border-b border-white/5">
                  <CardTitle className="text-sm font-medium text-slate-200 flex items-center gap-2">
                    <CloudSun className="h-4 w-4 text-amber-500" /> Weather
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white" onClick={fetchWeather}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </CardHeader>
                <CardContent className="pt-4">
                  {weather ? (
                    <div className="flex flex-col items-center text-center">
                      <div className="text-4xl font-bold text-white mb-1">{Math.round(weather.temperature)}°C</div>
                      <div className="text-sm text-blue-400 font-medium mb-4">{weather.condition}</div>

                      <div className="grid grid-cols-2 gap-4 w-full text-xs border-t border-white/10 pt-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500">Wind</span>
                          <span className="text-slate-300 font-medium">{weather.windspeed} km/h</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-slate-500">Location</span>
                          <span className="text-slate-300 font-medium">New Delhi</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* USERS SECTION */}
      {activeSection === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button onClick={() => setShowAddDialog(true)}>
                <UserPlus className="mr-2 h-4 w-4" /> Add User
              </Button>
              <Button variant="outline" onClick={() => handleOpenCsvUpload()}>
                <Upload className="mr-2 h-4 w-4" /> Upload CSV
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search users..."
                  className="pl-8 bg-slate-900 border-slate-700 h-9 text-sm"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
              {uploadHistory.length > 0 && (
                <Button variant="secondary" onClick={handleUndoUpload}>
                  <Undo2 className="mr-2 h-4 w-4" /> Undo Last Upload
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.slice((userPage - 1) * 10, userPage * 10).map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.full_name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell><span className={`capitalize px-2 py-1 rounded-full text-xs ${user.role === 'teacher' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{user.role}</span></TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteUser(user.id, user.email)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-end space-x-2 p-4 border-t border-slate-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage(p => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="text-sm text-slate-400">
                  Page {userPage} of {Math.ceil(users.length / 10)}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUserPage(p => Math.min(Math.ceil(users.length / 10), p + 1))}
                  disabled={userPage >= Math.ceil(users.length / 10)}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WORKSPACES SECTION */}
      {activeSection === 'workspaces' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Workspace</CardTitle>
              <CardDescription>Add a new workspace for a class or group</CardDescription>
            </CardHeader>
            <CardContent>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Workspace Name (e.g., Class 12 Math)</Label>
                  <Input
                    value={newWorkspace.name}
                    onChange={e => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                    placeholder="Enter workspace name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category (e.g., Grade 12, Science)</Label>
                  <Input
                    value={newWorkspace.category}
                    onChange={e => setNewWorkspace({ ...newWorkspace, category: e.target.value })}
                    placeholder="Enter category"
                  />
                </div>
                <Button onClick={handleCreateWorkspace} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0">
                  <Briefcase className="mr-2 h-4 w-4" /> Create Workspace
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">My Workspaces ({filteredWorkspaces.length})</h3>
            <div className="flex gap-2">
              <Input
                placeholder="Search workspaces..."
                className="w-[200px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleReset}>Reset</Button>
            </div>
          </div>

          <div className="space-y-4">
            {filteredWorkspaces.slice((workspacePage - 1) * 2, workspacePage * 2).map((ws) => (
              <Card key={ws.id} className="overflow-hidden">
                <div className="bg-muted/30 p-4 flex items-center justify-between border-b">
                  <div className="flex items-center gap-3">
                    <h4 className="font-semibold text-lg">{ws.name}</h4>
                    <span className="text-xs bg-secondary/20 text-secondary-foreground px-2 py-1 rounded">{ws.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={() => handleOpenCsvUpload(ws.id, ws.name)}><Upload className="h-3 w-3 mr-1" /> CSV</Button>
                    <Button variant="destructive" size="sm" className="h-8" onClick={() => handleDeleteWorkspace(ws.id, ws.name)}>Delete</Button>
                  </div>
                </div>
                <CardContent className="p-4 space-y-4">
                  {/* Teachers Section */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h5 className="text-sm font-medium text-muted-foreground">Teachers ({ws.teachers.length})</h5>
                    </div>
                    <div className="space-y-2">
                      {ws.teachers.map(email => (
                        <div key={email} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                          <span>{email}</span>
                          <Button variant="destructive" size="sm" className="h-6 text-xs" onClick={() => handleRemoveMember(ws.id, 'teacher', email)}>Remove</Button>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <Input
                          placeholder="Teacher email"
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddMember(ws.id, 'teacher', e.currentTarget.value);
                          }}
                        />
                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          handleAddMember(ws.id, 'teacher', input.value);
                          input.value = '';
                        }}>Add Teacher</Button>
                      </div>
                    </div>
                  </div>

                  {/* Students Section */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h5 className="text-sm font-medium text-muted-foreground">Students ({ws.students.length})</h5>
                    </div>
                    <div className="space-y-2">
                      {ws.students.slice(((workspaceStudentPages[ws.id] || 1) - 1) * 10, (workspaceStudentPages[ws.id] || 1) * 10).map(email => (
                        <div key={email} className="flex items-center justify-between bg-muted/50 p-2 rounded text-sm">
                          <span>{email}</span>
                          <Button variant="destructive" size="sm" className="h-6 text-xs" onClick={() => handleRemoveMember(ws.id, 'student', email)}>Remove</Button>
                        </div>
                      ))}

                      {/* Student Pagination Controls */}
                      {ws.students.length > 10 && (
                        <div className="flex items-center justify-center space-x-2 py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWorkspaceStudentPages(prev => ({ ...prev, [ws.id]: Math.max(1, (prev[ws.id] || 1) - 1) }))}
                            disabled={(workspaceStudentPages[ws.id] || 1) === 1}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <span className="text-xs text-slate-400">
                            {(workspaceStudentPages[ws.id] || 1)} / {Math.ceil(ws.students.length / 10)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWorkspaceStudentPages(prev => ({ ...prev, [ws.id]: Math.min(Math.ceil(ws.students.length / 10), (prev[ws.id] || 1) + 1) }))}
                            disabled={(workspaceStudentPages[ws.id] || 1) >= Math.ceil(ws.students.length / 10)}
                            className="h-6 w-6 p-0"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <Input
                          placeholder="Student email"
                          className="h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddMember(ws.id, 'student', e.currentTarget.value);
                          }}
                        />
                        <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white border-0" onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          handleAddMember(ws.id, 'student', input.value);
                          input.value = '';
                        }}>Add Student</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Workspace Pagination */}
          {filteredWorkspaces.length > 2 && (
            <div className="flex items-center justify-center space-x-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkspacePage(p => Math.max(1, p - 1))}
                disabled={workspacePage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm text-slate-400">
                Page {workspacePage} of {Math.ceil(filteredWorkspaces.length / 2)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWorkspacePage(p => Math.min(Math.ceil(filteredWorkspaces.length / 2), p + 1))}
                disabled={workspacePage >= Math.ceil(filteredWorkspaces.length / 2)}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* QUERIES SECTION */}
      {activeSection === 'queries' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">User Queries</h2>
            <Button variant="destructive" size="sm" onClick={async () => {
              if (!confirm('Are you sure you want to delete ALL queries? This cannot be undone.')) return;
              try {
                const batch = writeBatch(db);
                const q = query(collection(db, 'queries'));
                const snap = await getDocs(q);
                snap.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                toast.success('All queries deleted');
                loadQueries();
              } catch (error) {
                console.error(error);
                toast.error('Failed to delete queries');
              }
            }}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete All
            </Button>
          </div>
          <div className="grid gap-4">
            {queries.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">No queries found</div>
            ) : (
              queries.map((q) => (
                <Card key={q.id}>
                  <CardHeader>
                    <div className="flex justify-between">
                      <CardTitle className="text-base">{q.query}</CardTitle>
                      <span className={`text-xs px-2 py-1 rounded-full ${q.status === 'solved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {q.status}
                      </span>
                    </div>
                    <CardDescription>{q.userEmail} • {q.createdAt?.toDate().toLocaleString()}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(q.reply || q.adminReply) && (
                      <div className="bg-muted p-3 rounded-md text-sm mb-3">
                        <strong>Reply:</strong> {q.reply || q.adminReply}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={async () => {
                        const reply = prompt('Enter reply:');
                        if (reply) {
                          await updateDoc(doc(db, 'queries', q.id), {
                            adminReply: reply,
                            status: 'replied',
                            repliedAt: serverTimestamp()
                          });
                          loadQueries();
                        }
                      }}>Reply</Button>
                      {q.status !== 'solved' && (
                        <Button size="sm" variant="default" onClick={async () => {
                          await updateDoc(doc(db, 'queries', q.id), {
                            status: 'solved',
                            solvedAt: serverTimestamp()
                          });
                          loadQueries();
                        }}>Mark Solved</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* AI CSV GENERATOR */}
      {activeSection === 'aiCsv' && (
        <div className="space-y-6 h-[calc(100vh-200px)]">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">AI CSV Generator</h2>
            <Button variant="outline" asChild>
              <a href="https://web-production-fefe7.up.railway.app/" target="_blank" rel="noopener noreferrer">
                Open in New Tab
              </a>
            </Button>
          </div>
          <div className="w-full h-full border rounded-lg overflow-hidden bg-black">
            <iframe
              src="https://web-production-fefe7.up.railway.app/"
              className="w-full h-full border-none"
              title="AI CSV Generator"
            />
          </div>
        </div>
      )}

      {/* SETTINGS */}
      {activeSection === 'settings' && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Settings</h2>
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Settings functionality coming soon...
            </CardContent>
          </Card>
        </div>
      )}

      {/* DIALOGS */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={newUser.role} onValueChange={(v: UserRole) => setNewUser({ ...newUser, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="teacher">Teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddUser}>Add User</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCsvDialog} onOpenChange={setShowCsvDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{activeWorkspaceName ? `Upload Users to "${activeWorkspaceName}"` : 'Upload Users via CSV'}</DialogTitle></DialogHeader>
          <div className="space-y-6">
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium">CSV Format Instructions:</h4>
              <p className="text-sm text-muted-foreground">Your CSV file should have the following columns:</p>
              <code className="block bg-black/10 p-2 rounded text-xs">name,email,password,role,department</code>

              <p className="text-sm text-muted-foreground mt-2">Example rows:</p>
              <div className="bg-black/10 p-2 rounded text-xs space-y-1">
                <div>John Doe,john@example.com,pass123,teacher,Mathematics</div>
                <div>Jane Smith,jane@example.com,pass456,student,Science</div>
              </div>

              <Button variant="outline" size="sm" className="mt-2" onClick={downloadSampleCSV}>
                <Download className="mr-2 h-4 w-4" /> Download Sample CSV
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 space-y-4">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                id="csv-upload"
                ref={fileInputRef}
              />
              <Label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center">
                <Button variant="default" className="pointer-events-none">
                  <Upload className="mr-2 h-4 w-4" /> Choose CSV File
                </Button>
                {csvFile && <span className="mt-2 text-sm text-muted-foreground">{csvFile.name}</span>}
              </Label>
            </div>

            {csvPreview.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Preview (First 5 rows):</h4>
                <div className="border rounded-md overflow-hidden overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(csvPreview[0]).map(h => <TableHead key={h}>{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvPreview.map((row, i) => (
                        <TableRow key={i}>
                          {Object.values(row).map((v: any, j) => <TableCell key={j}>{v}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="text-xs text-muted-foreground">Total users to upload: {csvPreview.length}+</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCsvDialog(false);
              setActiveWorkspaceId(null);
              setActiveWorkspaceName(null);
            }}>Cancel</Button>
            <Button onClick={handleCSVUpload} disabled={!csvFile}>Upload Users</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Workspace</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={newWorkspace.name} onChange={e => setNewWorkspace({ ...newWorkspace, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={newWorkspace.category} onChange={e => setNewWorkspace({ ...newWorkspace, category: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreateWorkspace}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
};

export default AdminDashboard;
