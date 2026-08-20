"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar } from "lucide-react";

interface ParsedTime {
    [day: string]: [number, number][]; // e.g., "M": [[600, 720]]
}

interface Section {
    course: string;
    section_id: string;
    days: string;
    crn: string;
    times: string;
    location: string;
    instructor: string;
    parsed_times: ParsedTime;
}

interface Schedule {
    sections: Section[];
    days_used: string[];
    num_days: number;
}

interface ScheduleViewerProps {
    schedules: Schedule[];
    isOpen: boolean;
    onClose: () => void;
    onDelete: (index: number) => void;
    setSearchQuery: (query: string) => void;
}

export default function ScheduleViewer({
    schedules,
    isOpen,
    onClose,
    onDelete,
    setSearchQuery,
}: ScheduleViewerProps) {
    const [activeTab, setActiveTab] = useState(0);

    // Ensure active tab is valid when schedules change
    useEffect(() => {
        if (activeTab >= schedules.length && schedules.length > 0) {
            setActiveTab(schedules.length - 1);
        }
    }, [schedules.length, activeTab]);

    if (!isOpen) return null;

    const days = ["M", "T", "W", "R", "F"];
    const dayLabels = {
        M: "Monday",
        T: "Tuesday",
        W: "Wednesday",
        R: "Thursday",
        F: "Friday",
    };

    // Time range for the calendar (8 AM to 10 PM)
    const startHour = 8;
    const endHour = 22;
    const totalMinutes = (endHour - startHour) * 60;

    const getPositionStyle = (startMin: number, endMin: number) => {
        const startOffset = startMin - startHour * 60;
        const duration = endMin - startMin;
        const top = (startOffset / totalMinutes) * 100;
        const height = (duration / totalMinutes) * 100;
        return { top: `${top}%`, height: `${height}%` };
    };

    const currentSchedule = schedules[activeTab];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 md:p-8">
            <div className="flex h-full w-full max-w-6xl flex-col overflow-hidden border border-black/20 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b-4 border-[#cc0000] bg-[#171717] p-2 text-white">
                    <div className="flex items-center overflow-x-auto gap-1 hide-scrollbar max-w-[calc(100%-3rem)]">
                        {schedules.map((_, idx) => (
                            <div
                                key={idx}
                                onClick={() => setActiveTab(idx)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 cursor-pointer transition-all whitespace-nowrap text-sm font-bold
                                    ${
                                        activeTab === idx
                                            ? "bg-[#cc0000] text-white"
                                            : "text-white/60 hover:bg-white/10 hover:text-white"
                                    }
                                `}
                            >
                                <span>Option {idx + 1}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(idx);
                                    }}
                                    className="p-0.5 transition-colors hover:bg-white/20"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 bg-white dark:bg-slate-900">
                    {currentSchedule ? (
                        <div className="flex flex-col h-full min-h-[600px]">
                            {/* Days Header */}
                            <div className="grid grid-cols-5 border-b border-slate-200 dark:border-slate-700 ml-11">
                                {days.map((day) => (
                                    <div
                                        key={day}
                                        className="py-3 text-center font-semibold text-slate-700 dark:text-slate-200 border-r last:border-r-0 border-slate-100 dark:border-slate-800"
                                    >
                                        {
                                            dayLabels[
                                                day as keyof typeof dayLabels
                                            ]
                                        }
                                    </div>
                                ))}
                            </div>

                            {/* Calendar Grid */}
                            <div className="flex-1 flex-row relative min-h-[500px]">
                                {/* Horizontal Time Lines (Background) */}
                                {Array.from({
                                    length: endHour - startHour,
                                }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="absolute w-full border-t border-dashed border-slate-100 dark:border-slate-800 text-xs text-slate-400 pl-1 pointer-events-none"
                                        style={{
                                            top: `${
                                                (i / (endHour - startHour)) *
                                                100
                                            }%`,
                                        }}
                                    >
                                        {startHour + i > 12
                                            ? startHour + i - 12
                                            : startHour + i}{" "}
                                        {startHour + i >= 12 ? "PM" : "AM"}
                                    </div>
                                ))}

                                <div className="flex-1 grid grid-cols-5 relative h-full ml-11">
                                    {days.map((day, i) => (
                                        <div
                                            key={day}
                                            className="relative border-r last:border-r-0 border-slate-100 dark:border-slate-800 h-full"
                                        >
                                            {currentSchedule.sections.map(
                                                (section, sIdx) => {
                                                    const timeSlots =
                                                        section.parsed_times[
                                                            day
                                                        ];
                                                    if (!timeSlots) return null;

                                                    return timeSlots.map(
                                                        (slot, tIdx) => (
                                                            <div
                                                                key={`${sIdx}-${tIdx}`}
                                                                className="group absolute left-[2.5%] w-[95%] cursor-pointer overflow-hidden border-l-4 border-[#cc0000] bg-[#fff1f1] p-2 text-xs shadow-sm transition-all hover:z-10 hover:shadow-md"
                                                                style={getPositionStyle(
                                                                    slot[0],
                                                                    slot[1]
                                                                )}
                                                                onClick={() => {
                                                                    setSearchQuery(
                                                                        section.course
                                                                    );
                                                                    onClose();
                                                                }}
                                                            >
                                                                <div className="font-black text-[#990000]">
                                                                    {
                                                                        section.course
                                                                    }
                                                                </div>
                                                                <div className="text-slate-600 dark:text-slate-400 truncate">
                                                                    {
                                                                        section.section_id
                                                                    }{" "}
                                                                    |{" "}
                                                                    {
                                                                        section.instructor
                                                                    }
                                                                </div>
                                                                <div className="text-slate-500 dark:text-slate-500 truncate">
                                                                    {
                                                                        section.location
                                                                    }
                                                                </div>
                                                            </div>
                                                        )
                                                    );
                                                }
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <Calendar className="w-16 h-16 mb-4 opacity-50" />
                            <p>No schedules generated yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
