"use client";

import React, { useState, useRef, useEffect } from "react";
import sectionsData from "../../sections.json";

interface SectionsPopoverProps {
    courseName: string;
}

interface SectionData {
    section: string;
    code: string;
    days: string;
    time: string;
    room: string;
    status: string;
    capacity: string;
    enrolled: string;
    instructor: string;
    format: string;
    credits: string;
    book: string;
    notes: string;
}

export default function SectionsPopover({ courseName }: SectionsPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close popover when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [isOpen]);

    const courseData = (sectionsData as any)[courseName];

    if (!courseData) {
        return (
            <button
                disabled
                className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
                title="No sections available"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            </button>
        );
    }

    const courseTitle = courseData[0];
    const sectionsObj = courseData[1] as Record<string, string[]>;
    const sections: SectionData[] = Object.values(sectionsObj).map(
        (sectionArray) => ({
            section: sectionArray[0],
            code: sectionArray[1],
            days: sectionArray[2],
            time: sectionArray[3],
            room: sectionArray[4],
            status: sectionArray[5],
            capacity: sectionArray[6],
            enrolled: sectionArray[7],
            instructor: sectionArray[8],
            format: sectionArray[9],
            credits: sectionArray[10],
            book: sectionArray[11],
            notes: sectionArray[12],
        })
    );

    return (
        <div className="relative ">
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
                title="View sections"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 mt-2 w-[800px] max-h-[600px] bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-rollout"
                >
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {courseName}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                            {courseTitle}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                            {sections.length} section{sections.length !== 1 ? "s" : ""} available
                        </p>
                    </div>

                    <div className="overflow-auto max-h-[500px]">
                        <table className="w-full text-sm text-center">
                            <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Section
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        CRN
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Days
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Time
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Room
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Status
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Enrolled
                                    </th>
                                    <th className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">
                                        Instructor
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                {sections.map((section, idx) => (
                                    <tr
                                        key={idx}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                    >
                                        <td className="px-3 py-2 text-slate-900 dark:text-white font-medium">
                                            {section.section}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                            {section.code}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                            {section.days}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                            {section.time}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                            {section.room}
                                        </td>
                                        <td className="px-3 py-2">
                                            <span
                                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    section.status === "Open"
                                                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                                }`}
                                            >
                                                {section.status}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                            {section.enrolled}/{section.capacity}
                                        </td>
                                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                                            {section.instructor}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
