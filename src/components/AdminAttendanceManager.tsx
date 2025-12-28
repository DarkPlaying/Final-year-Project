import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Search, Download, Save, Loader2, Filter, ClipboardList, Fingerprint, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, setDoc, doc, Timestamp, writeBatch, deleteField } from 'firebase/firestore';

interface Teacher {
    id: string;
    name: string;
    email: string;
    department: string;
}

interface AttendanceRecord {
    status: 'P' | 'A' | 'HL';
    remarks?: string;
}

export const AdminAttendanceManager = () => {
    const [date, setDate] = useState<Date>(new Date());
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState('all');
    const [departments, setDepartments] = useState<string[]>([]);

    // Load Teachers
    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
                const snapshot = await getDocs(q);
                const teacherList: Teacher[] = [];
                const depts = new Set<string>();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    teacherList.push({
                        id: doc.id,
                        name: data.name || data.full_name || 'Unknown',
                        email: data.email,
                        department: data.department || 'General'
                    });
                    if (data.department) depts.add(data.department);
                });

                setTeachers(teacherList);
                setDepartments(Array.from(depts));
            } catch (error) {
                console.error("Error fetching teachers:", error);
                toast.error("Failed to load teachers");
            }
        };
        fetchTeachers();
    }, []);

    // Load Attendance for Date
    useEffect(() => {
        if (!date) return;
        const fetchAttendance = async () => {
            setLoading(true);
            try {
                const dateStr = format(date, 'yyyy-MM-dd');
                // We'll store/fetch from a 'teacher_attendance' collection
                // Doc ID structure: `${dateStr}_${teacherId}`
                // Or query by date field. Let's query by date field for flexibility.

                const q = query(
                    collection(db, 'teacher_attendance'),
                    where('dateStr', '==', dateStr)
                );

                const snapshot = await getDocs(q);
                const currentAttendance: Record<string, AttendanceRecord> = {};

                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.teacherId) {
                        currentAttendance[data.teacherId] = {
                            status: data.status,
                            remarks: data.remarks
                        };
                    }
                });

                setAttendance(currentAttendance);
            } catch (error) {
                console.error("Error loading attendance:", error);
                toast.error("Failed to load attendance");
            } finally {
                setLoading(false);
            }
        };
        fetchAttendance();
    }, [date]);

    const handleStatusChange = (teacherId: string, status: 'P' | 'A' | 'HL') => {
        setAttendance(prev => ({
            ...prev,
            [teacherId]: { ...prev[teacherId], status }
        }));
    };

    const saveAttendance = async () => {
        if (!date) return;
        setSaving(true);
        try {
            const batch = writeBatch(db);
            const dateStr = format(date, 'yyyy-MM-dd');
            const timestamp = Timestamp.fromDate(date);

            // We only save records for teachers who have a status set (or explicit update)
            // Since we want to capture "Absent" vs "Not Marked", we iterate through visible teachers 
            // or just the ones in `attendance` state. 
            // A robust system would save all. Let's save all visible teachers to ensure completeness.

            teachers.forEach(teacher => {
                const record = attendance[teacher.id];
                if (record) {
                    const docRef = doc(db, 'teacher_attendance', `${dateStr}_${teacher.id}`);
                    batch.set(docRef, {
                        dateStr,
                        date: timestamp,
                        teacherId: teacher.id,
                        teacherName: teacher.name,
                        department: teacher.department,
                        status: record.status,
                        updatedAt: Timestamp.now()
                    }, { merge: true });
                }
            });

            await batch.commit();
            toast.success("Attendance saved successfully");
        } catch (error) {
            console.error("Error saving attendance:", error);
            toast.error("Failed to save attendance");
        } finally {
            setSaving(false);
        }
    };

    const downloadCSV = () => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const headers = ['Name', 'Email', 'Department', 'Date', 'Status'];

        // Filter teachers based on current view
        const filteredTeachers = teachers.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDept = departmentFilter === 'all' || t.department === departmentFilter;
            return matchesSearch && matchesDept;
        });

        const rows = filteredTeachers.map(t => {
            const status = attendance[t.id]?.status || 'Not Marked';
            return [
                t.name,
                t.email,
                t.department,
                dateStr,
                status
            ].map(val => `"${val}"`).join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Teacher_Attendance_${dateStr}.csv`;
        a.click();
    };

    // Filter Logic
    const filteredTeachers = teachers.filter(t => {
        const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            t.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = departmentFilter === 'all' || t.department === departmentFilter;
        return matchesSearch && matchesDept;
    });

    // Calculate Stats
    const stats = {
        present: Object.values(attendance).filter(r => r.status === 'P').length,
        absent: Object.values(attendance).filter(r => r.status === 'A').length,
        halfDay: Object.values(attendance).filter(r => r.status === 'HL').length,
    };

    const resetBiometric = async (teacherId: string, name: string) => {
        if (!confirm(`Are you sure you want to reset fingerprint for ${name}?`)) return;
        try {
            await setDoc(doc(db, 'users', teacherId), {
                biometricCredId: deleteField(),
                biometricCredIds: deleteField()
            }, { merge: true });
            toast.success(`Fingerprint reset for ${name}`);
        } catch (error) {
            console.error("Error resetting fingerprint:", error);
            toast.error("Failed to reset fingerprint");
        }
    };

    const resetAllBiometrics = async () => {
        let targets = [];
        if (departmentFilter === 'all') {
            targets = teachers;
        } else {
            targets = teachers.filter(t => t.department === departmentFilter);
        }

        if (targets.length === 0) {
            toast.error("No teachers found to reset.");
            return;
        }

        if (!confirm(`WARNING: This will remove fingerprint access for ${targets.length} teachers in ${departmentFilter === 'all' ? 'All Departments' : departmentFilter}. Continue?`)) return;

        setSaving(true);
        try {
            const batch = writeBatch(db);
            targets.forEach(t => {
                const ref = doc(db, 'users', t.id);
                // updating with deleteField inside a set({merge:true}) or update()
                batch.update(ref, {
                    biometricCredId: deleteField(),
                    biometricCredIds: deleteField()
                });
            });
            await batch.commit();
            toast.success("All selected fingerprints reset successfully");
        } catch (error) {
            console.error("Error resetting all:", error);
            toast.error("Failed to reset all fingerprints");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 w-full">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                    <ClipboardList className="h-8 w-8 text-indigo-500" />
                    Manage Teacher Attendance
                </h1>
                <p className="text-slate-400">View and modify daily attendance reports for teachers.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Controls Panel */}
                <Card className="bg-slate-800 border-slate-700 text-white lg:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>Controls</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full justify-start text-left font-normal bg-slate-900 border-slate-700 hover:bg-slate-800"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {date ? format(date, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={date}
                                        onSelect={(d) => d && setDate(d)}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-2">
                            <Label>Department</Label>
                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="bg-slate-900 border-slate-700">
                                    <SelectValue placeholder="All Departments" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Departments</SelectItem>
                                    {departments.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Summary</Label>
                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                <div className="bg-green-500/20 p-2 rounded text-green-400 border border-green-500/30">
                                    <div className="font-bold text-lg">{stats.present}</div>
                                    <div>Present</div>
                                </div>
                                <div className="bg-red-500/20 p-2 rounded text-red-400 border border-red-500/30">
                                    <div className="font-bold text-lg">{stats.absent}</div>
                                    <div>Absent</div>
                                </div>
                                <div className="bg-yellow-500/20 p-2 rounded text-yellow-400 border border-yellow-500/30">
                                    <div className="font-bold text-lg">{stats.halfDay}</div>
                                    <div>Half Day</div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 space-y-3 border-t border-slate-700">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={saveAttendance} disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Changes
                            </Button>

                            <Button variant="outline" className="w-full border-slate-700" onClick={downloadCSV}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Report
                            </Button>

                            <Button
                                variant="destructive"
                                className="w-full bg-red-900/50 hover:bg-red-900 border border-red-800 text-red-200"
                                onClick={resetAllBiometrics}
                                disabled={saving}
                            >
                                <Fingerprint className="mr-2 h-4 w-4" />
                                Reset {departmentFilter === 'all' ? 'All' : departmentFilter} Biometrics
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Main List */}
                <Card className="bg-slate-800 border-slate-700 text-white lg:col-span-3">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Attendance List</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search teacher..."
                                className="pl-8 bg-slate-900 border-slate-700 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border border-slate-700 overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-900 border-b border-slate-700">
                                    <TableRow className="border-slate-700 hover:bg-slate-900">
                                        <TableHead className="text-slate-400">Teacher</TableHead>
                                        <TableHead className="text-slate-400">Department</TableHead>
                                        <TableHead className="text-center text-slate-400">Status</TableHead>
                                        <TableHead className="text-center text-slate-400">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-500" />
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredTeachers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                                                No teachers found
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredTeachers.map((teacher) => {
                                            const status = attendance[teacher.id]?.status; // undefined = Not Marked
                                            return (
                                                <TableRow key={teacher.id} className="border-slate-700 hover:bg-slate-700/30">
                                                    <TableCell className="font-medium">
                                                        <div>{teacher.name}</div>
                                                        <div className="text-xs text-slate-500">{teacher.email}</div>
                                                    </TableCell>
                                                    <TableCell>{teacher.department}</TableCell>
                                                    <TableCell>
                                                        <div className="flex justify-center gap-2">
                                                            <button
                                                                onClick={() => handleStatusChange(teacher.id, 'P')}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all
                                                            ${status === 'P'
                                                                        ? 'bg-green-600 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-slate-900'
                                                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                                title="Present"
                                                            >
                                                                P
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusChange(teacher.id, 'A')}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all
                                                            ${status === 'A'
                                                                        ? 'bg-red-600 text-white ring-2 ring-red-400 ring-offset-2 ring-offset-slate-900'
                                                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                                title="Absent"
                                                            >
                                                                A
                                                            </button>
                                                            <button
                                                                onClick={() => handleStatusChange(teacher.id, 'HL')}
                                                                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all
                                                            ${status === 'HL'
                                                                        ? 'bg-yellow-600 text-white ring-2 ring-yellow-400 ring-offset-2 ring-offset-slate-900'
                                                                        : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                                                title="Half Day Leave"
                                                            >
                                                                HL
                                                            </button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-slate-400 hover:text-red-400 hover:bg-red-400/10"
                                                            onClick={() => resetBiometric(teacher.id, teacher.name)}
                                                            title="Reset Fingerprint"
                                                        >
                                                            <Fingerprint className="h-4 w-4" />
                                                            <span className="sr-only">Reset</span>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};


