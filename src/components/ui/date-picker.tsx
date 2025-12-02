import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
}

export function DatePicker({ date, setDate, placeholder = "Pick a date", className }: DatePickerProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                        "w-full justify-start text-left font-normal bg-slate-950 border-slate-700 text-slate-300 hover:bg-slate-900 hover:text-white truncate",
                        !date && "text-muted-foreground",
                        className
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                    {date ? format(date, "dd MMM yyyy") : <span>{placeholder}</span>}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-[1000] bg-slate-900 border-slate-700 text-slate-300" align="start">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    className="bg-slate-900 text-slate-300"
                    classNames={{
                        day_selected: "bg-blue-600 text-white hover:bg-blue-700 focus:bg-blue-700",
                        day_today: "bg-slate-800 text-white",
                        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-slate-800 hover:text-white rounded-md aria-selected:!bg-blue-600 aria-selected:!text-white aria-selected:hover:!bg-blue-700",
                        day_outside: "text-slate-600 opacity-50",
                        day_disabled: "text-slate-600 opacity-50",
                        head_cell: "text-slate-500 rounded-md w-9 font-normal text-[0.8rem]",
                        caption: "flex justify-center pt-1 relative items-center text-slate-300",
                    }}
                />
            </PopoverContent>
        </Popover>
    )
}
