import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { toast } from 'sonner';

interface Teacher {
    id: string;
    name: string;
    email: string;
    department: string;
}

interface AdminOverallAttendanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    departments: string[];
}

export const AdminOverallAttendanceDialog = ({ open, onOpenChange, departments }: AdminOverallAttendanceDialogProps) => {
    const [selectedDept, setSelectedDept] = useState<string>('all');
    const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [attendanceData, setAttendanceData] = useState<Map<string, Map<string, string>>>(new Map());
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hoveredRow, setHoveredRow] = useState<number | null>(null);
    const [hoveredCol, setHoveredCol] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    // Fetch Teachers for Dept
    useEffect(() => {
        if (!open) return;
        const fetchTeachers = async () => {
            try {
                let q = query(collection(db, 'users'), where('role', '==', 'teacher'));
                if (selectedDept !== 'all') {
                    q = query(collection(db, 'users'), where('role', '==', 'teacher'), where('department', '==', selectedDept));
                }
                const snapshot = await getDocs(q);
                const list: Teacher[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    list.push({
                        id: doc.id,
                        name: data.name || data.full_name || 'Unknown',
                        email: data.email,
                        department: data.department || 'General'
                    });
                });
                setTeachers(list);
            } catch (error) {
                console.error("Error fetching teachers:", error);
            }
        };
        fetchTeachers();
        setCurrentPage(1);
    }, [selectedDept, open]);

    // Fetch Monthly Attendance
    useEffect(() => {
        if (!open || !selectedMonth) return;
        const fetchMonthlyAttendance = async () => {
            setLoading(true);
            try {
                const [year, month] = selectedMonth.split('-');
                const startDate = `${selectedMonth}-01`;
                const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
                const endDate = `${selectedMonth}-${lastDay}`;

                let q = query(
                    collection(db, 'teacher_attendance'),
                    where('dateStr', '>=', startDate),
                    where('dateStr', '<=', endDate)
                );

                const snapshot = await getDocs(q);
                const newData = new Map<string, Map<string, string>>();

                snapshot.forEach(doc => {
                    const data = doc.data();
                    const dateStr = data.dateStr;
                    const teacherId = data.teacherId;
                    const status = data.status;

                    if (!newData.has(dateStr)) {
                        newData.set(dateStr, new Map());
                    }
                    newData.get(dateStr)!.set(teacherId, status);
                });

                setAttendanceData(newData);
            } catch (error) {
                console.error("Error fetching monthly attendance:", error);
                toast.error("Failed to load attendance records");
            } finally {
                setLoading(false);
            }
        };
        fetchMonthlyAttendance();
    }, [selectedMonth, open]);

    const filteredTeachers = teachers.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const paginatedTeachers = filteredTeachers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const totalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE);

    // Reset to page 1 when search query changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const daysInMonth = () => {
        if (!selectedMonth) return 31;
        const [year, month] = selectedMonth.split('-');
        return new Date(parseInt(year), parseInt(month), 0).getDate();
    };

    const getStatusColor = (status: string | undefined) => {
        switch (status) {
            case 'P': return 'bg-emerald-500 text-emerald-950';
            case 'A': return 'bg-rose-500 text-rose-950';
            case 'HL': return 'bg-amber-500 text-amber-950';
            default: return 'bg-slate-800/30 text-slate-600';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] w-full h-[90vh] bg-slate-900 border-slate-700 text-white flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        Overall Teacher Attendance
                    </DialogTitle>
                </DialogHeader>

                <div className="px-6 py-4 border-b border-slate-700 flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <Label className="text-xs text-slate-400">Department</Label>
                        <Select value={selectedDept} onValueChange={setSelectedDept}>
                            <SelectTrigger className="bg-slate-800 border-slate-700 h-9">
                                <SelectValue placeholder="All Departments" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700 text-white">
                                <SelectItem value="all">All Departments</SelectItem>
                                {departments.map(d => (
                                    <SelectItem key={d} value={d}>{d}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <Label className="text-xs text-slate-400">Select Month</Label>
                        <Input
                            type="month"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-slate-800 border-slate-700 h-9 text-white [&::-webkit-calendar-picker-indicator]:invert"
                        />
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                        <Label className="text-xs text-slate-400">Search Teacher</Label>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                            <Input
                                placeholder="Name or email..."
                                className="pl-9 bg-slate-800 border-slate-700 h-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-2">
                            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                            <p className="text-slate-400">Loading attendance data...</p>
                        </div>
                    ) : filteredTeachers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <p>No teachers found for the selected department.</p>
                        </div>
                    ) : (
                        <div className="border border-slate-700 rounded-lg overflow-hidden h-full flex flex-col">
                            <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                                <table className="min-w-full table-auto border-collapse text-xs whitespace-nowrap" onMouseLeave={() => { setHoveredRow(null); setHoveredCol(null); }}>
                                    <thead className="sticky top-0 z-30">
                                        <tr className="bg-slate-950 border-b border-slate-700">
                                            <th className="p-0 font-medium text-slate-400 text-left sticky left-0 top-0 bg-slate-950 z-40 border-r border-slate-700">
                                                <div className="p-2 w-[160px] md:w-[200px] text-sm font-bold">Teacher</div>
                                            </th>
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                                const isRealDay = day <= daysInMonth();
                                                return (
                                                    <th key={day} className={`p-0 font-medium text-slate-400 text-center border-r border-slate-800/50 last:border-0 ${hoveredCol === day ? 'bg-indigo-500/10' : ''} ${!isRealDay ? 'bg-slate-900/50' : ''}`}>
                                                        <div className="py-2 w-7 md:w-8 flex items-center justify-center text-[10px] font-bold">{day}</div>
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {paginatedTeachers.map((teacher, idx) => {
                                            const totalDays = daysInMonth();
                                            const [year, month] = selectedMonth.split('-');

                                            return (
                                                <tr key={teacher.id} className="hover:bg-slate-800/50 transition-colors">
                                                    <td className={`p-0 font-medium text-slate-300 sticky left-0 bg-slate-900 z-20 border-r border-slate-700 shadow-[2px_0_5px_rgba(0,0,0,0.5)] ${hoveredRow === idx ? 'bg-indigo-500/10' : ''}`}>
                                                        <div className="p-2 w-[160px] md:w-[200px] flex flex-col">
                                                            <span className="truncate text-sm font-bold" title={teacher.name}>{teacher.name}</span>
                                                            <span className="truncate text-[10px] text-slate-500" title={teacher.email}>{teacher.email}</span>
                                                        </div>
                                                    </td>
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => {
                                                        const isRealDay = day <= totalDays;
                                                        const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                                                        const status = attendanceData.get(dateStr)?.get(teacher.id);

                                                        return (
                                                            <td
                                                                key={day}
                                                                className={`p-0 text-center border-r border-slate-800/50 last:border-0 transition-colors ${hoveredRow === idx || hoveredCol === day ? 'bg-indigo-500/10' : ''} ${!isRealDay ? 'bg-slate-900/30' : ''}`}
                                                                onMouseEnter={() => { setHoveredRow(idx); setHoveredCol(day); }}
                                                            >
                                                                <div className="py-1 w-7 md:w-8 flex items-center justify-center">
                                                                    {isRealDay ? (
                                                                        <div
                                                                            className={`w-5 h-5 md:w-6 md:h-6 rounded-sm flex items-center justify-center text-[9px] font-black shadow-sm transition-all ${getStatusColor(status)}`}
                                                                            title={`${dateStr}: ${status || 'No Record'}`}
                                                                        >
                                                                            {status || '-'}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-5 h-5 md:w-6 md:h-6" />
                                                                    )}
                                                                </div>
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700"
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <div className="flex items-center gap-1.5 px-4 text-sm font-medium text-slate-400">
                            Page <span className="text-white">{currentPage}</span> of <span className="text-white">{totalPages || 1}</span>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700"
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages || totalPages === 0}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                    <Button variant="outline" className="border-slate-600 text-slate-300 w-full md:w-auto" onClick={() => onOpenChange(false)}>
                        Close Window
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
