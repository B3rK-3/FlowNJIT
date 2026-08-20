"use client";

import React from "react";
import { semesters, setCurrentTerm, terms } from "../constants";
import { X, Search, Network, SlidersHorizontal } from "lucide-react";
const MAX_GRAPH_COURSES = 40;

interface MainSidebarProps {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedDept: string;
    setSelectedDept: (dept: string) => void;
    departments: string[];
    displayedCourses: string[];
    selectedCourse: string;
    setSelectedCourse: (course: string) => void;
    setCurrentCourse: (course: string) => void;
    currentTerm: string;
    onTermChange: (term: string) => void;
    displayOnlyTermCourses: boolean;
    setDisplayOnlyTermCourses: (checked: boolean) => void;
}

export default function MainSidebar({
    searchQuery,
    setSearchQuery,
    selectedDept,
    setSelectedDept,
    departments,
    displayedCourses,
    selectedCourse,
    setSelectedCourse,
    setCurrentCourse,
    currentTerm,
    onTermChange,
    displayOnlyTermCourses,
    setDisplayOnlyTermCourses,
}: MainSidebarProps) {
    // console.log(displayedCourses);
    const getTermLabel = (term: string) => {
        const semesterCode = term.slice(-2);
        const year = term.slice(0, -2);
        const semesterName = semesters[semesterCode as keyof typeof semesters];

        return semesterName ? `${year} ${semesterName}` : term;
    };

    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-black/10 bg-[#171717] text-white lg:h-dvh lg:w-[296px] lg:border-b-0 lg:border-r">
            <div className="relative overflow-hidden border-b border-white/15 px-5 py-5">
                <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full border-[18px] border-[#cc0000]/50" />
                <div className="relative flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center bg-[#cc0000]">
                        <Network className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-[-0.04em]">
                            Flow<span className="text-[#ef2b2d]">NJIT</span>
                        </h1>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                            Course pathway explorer
                        </p>
                    </div>
                </div>
            </div>

            <div className="border-b border-white/15 p-4">
                <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Refine courses
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <label className="sm:col-span-2 lg:col-span-1">
                        <span className="sr-only">Search course name</span>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
                            <input
                                type="search"
                                placeholder="Course code or keyword"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-11 w-full rounded-none border border-white/20 bg-white/[0.07] pl-10 pr-10 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ef2b2d] focus:ring-1 focus:ring-[#ef2b2d]"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    aria-label="Clear search"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/45 hover:text-white"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            )}
                        </div>
                    </label>

                    <label>
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                            Department
                        </span>
                        <select
                            value={selectedDept || "ALL"}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="h-10 w-full rounded-none border border-white/20 bg-[#262626] px-3 text-sm text-white outline-none focus:border-[#ef2b2d]"
                        >
                            <option value="ALL">All departments</option>
                            {departments.map((dept) => (
                                <option key={dept} value={dept}>
                                    {dept}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label>
                        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">
                            Academic term
                        </span>
                        <select
                            value={currentTerm}
                            onChange={(e) => {
                                const nextTerm = e.target.value;
                                setCurrentTerm(nextTerm);
                                onTermChange(nextTerm);
                            }}
                            className="h-10 w-full rounded-none border border-white/20 bg-[#262626] px-3 text-sm text-white outline-none focus:border-[#ef2b2d]"
                        >
                            {terms.map((term) => (
                                <option key={term} value={term}>
                                    {getTermLabel(term)}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-white/65">
                    <input
                        type="checkbox"
                        checked={displayOnlyTermCourses}
                        onChange={(e) =>
                            setDisplayOnlyTermCourses(e.target.checked)
                        }
                        className="h-4 w-4 accent-[#cc0000]"
                    />
                    Only courses offered this term
                </label>

                <button
                    type="button"
                    onClick={() => {
                        setSelectedCourse("");
                        setCurrentCourse("");
                    }}
                    className={`mt-4 h-10 w-full border text-xs font-black uppercase tracking-[0.12em] transition ${
                        selectedCourse === ""
                            ? "border-[#cc0000] bg-[#cc0000] text-white"
                            : "border-white/25 bg-transparent text-white hover:border-white/60"
                    }`}
                >
                    View {Math.min(displayedCourses.length, MAX_GRAPH_COURSES)} results
                </button>
            </div>

            <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden p-3 lg:overflow-x-hidden lg:overflow-y-auto">
                <div className="flex gap-2 lg:flex-col lg:gap-1">
                    {displayedCourses.slice(0, 100).map((course) => (
                        <button
                            type="button"
                            key={course}
                            onClick={() => {
                                setSelectedCourse(course);
                                setCurrentCourse(course);
                            }}
                            className={`shrink-0 border-l-4 px-3 py-2.5 text-left text-sm font-bold transition lg:w-full ${
                                selectedCourse === course
                                    ? "border-[#ef2b2d] bg-white text-black"
                                    : "border-transparent text-white/72 hover:border-white/30 hover:bg-white/10 hover:text-white"
                            }`}
                        >
                            {course}
                        </button>
                    ))}
                    {displayedCourses.length > 100 && (
                        <p className="shrink-0 px-3 py-2 text-xs text-white/40">
                            +{displayedCourses.length - 100} more
                        </p>
                    )}
                </div>
            </div>

            <div className="hidden border-t border-white/15 px-4 py-3 lg:block">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-white/45">
                    <span>AND</span>
                    <span className="mx-2 h-px flex-1 bg-[#cc0000]" />
                    <span>OR</span>
                    <span className="mx-2 h-px flex-1 bg-[#e2a300]" />
                    <span>Logic</span>
                </div>
            </div>
        </aside>
    );
}
