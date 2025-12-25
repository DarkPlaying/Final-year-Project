import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar, CalendarProps } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
    date: Date | undefined
    setDate: (date: Date | undefined) => void
    placeholder?: string
    className?: string
    calendarProps?: Partial<CalendarProps>
}

export function DatePicker({ date, setDate, placeholder = "Pick a date", className, calendarProps }: DatePickerProps) {
    const { mode, ...restCalendarProps } = calendarProps || {};
    const [inputValue, setInputValue] = React.useState("")

    React.useEffect(() => {
        if (date) {
            setInputValue(format(date, "dd/MM/yyyy"))
        } else {
            setInputValue("")
        }
    }, [date])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value
        setInputValue(value)

        // Try to parse various formats
        const formats = ["dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "yyyy-MM-dd"]
        let parsedDate: Date | undefined = undefined

        for (const fmt of formats) {
            const d = parse(value, fmt, new Date())
            if (isValid(d)) {
                parsedDate = d
                break
            }
        }

        if (parsedDate) {
            setDate(parsedDate)
        } else {
            if (value === "") {
                setDate(undefined)
            }
        }
    }

    const handleCalendarSelect = (newDate: Date | undefined) => {
        setDate(newDate);
        // Input value update handled by useEffect
    }

    return (
        <div className={cn("relative w-full", className)}>
            <Input
                type="text"
                placeholder={placeholder}
                value={inputValue}
                onChange={handleInputChange}
                className="w-full bg-slate-950 border-slate-700 text-slate-300 placeholder:text-muted-foreground pr-10 hover:bg-slate-900 focus:bg-slate-900 focus:text-white transition-colors"
                autoComplete="off"
            />
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full w-10 text-slate-400 hover:text-white hover:bg-transparent"
                    >
                        <CalendarIcon className="h-4 w-4" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-[9999] bg-slate-900 border-slate-700 text-slate-300 pointer-events-auto" align="end">
                    <Calendar
                        {...restCalendarProps}
                        mode="single"
                        selected={date}
                        onSelect={handleCalendarSelect as any}
                        initialFocus
                        className="bg-slate-900 text-slate-300 [&_select]:bg-slate-800 [&_select]:text-white [&_select]:border [&_select]:border-slate-700 [&_select]:rounded-md [&_select]:p-1 [&_select]:text-sm [&_select]:font-medium [&_select]:cursor-pointer [&_select]:focus:outline-none [&_select]:focus:ring-2 [&_select]:focus:ring-blue-600 [&_option]:bg-slate-900 [&_option]:text-white"
                        classNames={{
                            day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
                            day_today: "bg-slate-800 text-white",
                            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:!bg-blue-600 hover:!text-white focus:!bg-blue-600 focus:text-white rounded-md aria-selected:!bg-blue-600 aria-selected:!text-white aria-selected:hover:!bg-blue-700",
                            day_outside: "text-slate-600 opacity-50",
                            day_disabled: "text-slate-600 opacity-50",
                            head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                            caption: "flex justify-center pt-1 relative items-center text-slate-300",
                            caption_label: "text-sm font-medium",
                            caption_dropdowns: "flex gap-2 items-center justify-center grow",
                            nav: "space-x-1 flex items-center bg-slate-800 rounded-md p-0.5",
                            ...calendarProps?.classNames,
                        }}
                    />
                </PopoverContent>
            </Popover>
        </div>
    )
}
