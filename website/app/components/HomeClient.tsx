"use client";

import React, { useState, useMemo, useCallback, useEffect, JSX } from "react";
import dynamic from "next/dynamic";
import graphDataRaw from "../../graph.json";
import {
    CourseStructure,
    generateNonBlueColor,
    generateRandomRGB,
    getRandomInt,
    Nodes,
} from "../constants";
import { Span } from "next/dist/trace";

const MAX_GRAPH_COURSES = 100;
const graphData = graphDataRaw as CourseStructure;
// Dynamic import to avoid SSR issues with React Flow
const CourseGraph = dynamic(() => import("./CourseGraph"), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
    ),
});

interface HomeClientProps {
    initialSelectedDept?: string;
    initialSelectedCourse?: string;
    initialSearchQuery?: string;
    initialInfoCourse?: string;
}

export default function HomeClient({
    initialSelectedDept,
    initialSelectedCourse,
    initialSearchQuery,
    initialInfoCourse,
}: HomeClientProps) {
    const [selectedCourse, setSelectedCourse] = useState<string>(
        initialSelectedCourse ?? ""
    );
    const [infoCourse, setInfoCourse] = useState<string>(
        initialInfoCourse ?? initialSelectedCourse ?? ""
    );
    const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? "");
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    useEffect(() => {
        setSelectedCourse(initialSelectedCourse ?? "");
        setInfoCourse(initialInfoCourse ?? initialSelectedCourse ?? "");
        setSearchQuery(initialSearchQuery ?? "");
    }, [initialInfoCourse, initialSearchQuery, initialSelectedCourse]);

    const courseList = useMemo(() => Object.keys(graphData).sort(), []);

    const filteredCourses = useMemo(() => {
        if (!searchQuery) return courseList;
        return courseList.filter((course) =>
            course.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [courseList, searchQuery]);

    // Get departments for filtering
    const departments = useMemo(() => {
        const depts = new Set<string>();
        courseList.forEach((course) => {
            const dept = course.split(" ")[0];
            depts.add(dept);
        });
        return Array.from(depts).sort();
    }, [courseList]);

    const [selectedDept, setSelectedDept] = useState<string>(
        initialSelectedDept ?? ""
    );

    useEffect(() => {
        setSelectedDept(initialSelectedDept ?? "");
    }, [initialSelectedDept]);

    const displayedCourses = useMemo(() => {
        let courses = filteredCourses;
        if (selectedDept) {
            courses = courses.filter((course) =>
                course.startsWith(selectedDept + " ")
            );
        }
        return courses;
    }, [filteredCourses, selectedDept]);

    const graphCourses = useMemo(() => {
        if (selectedCourse) return [selectedCourse];
        return displayedCourses.slice(0, MAX_GRAPH_COURSES);
    }, [displayedCourses, selectedCourse]);

    const infoData = useMemo(() => {
        console.log(infoCourse);
        if (!infoCourse) return undefined;
        return graphData[infoCourse];
    }, [infoCourse]);

    const getPrereqText = useCallback((prereq: Nodes | null): JSX.Element => {
        if (!prereq) return <>None</>;
        if (prereq.type == "COURSE") return <span>{prereq.course}</span>;
        if (prereq.type == "PERMISSION") return <span>{prereq.raw}</span>;
        if (prereq.type == "PLACEMENT") return <span>{prereq.name}</span>;
        if (prereq.type == "SKILL") return <span>{prereq.name}</span>;
        if (prereq.type == "STANDING") return <span>{prereq.standing}</span>;
        if (!Array.isArray(prereq.children) || prereq.children.length === 0) {
            return <></>;
        }

        const color = generateNonBlueColor();

        const parts = prereq.children.map((child: any) => getPrereqText(child));

        if (parts.length === 0) return <></>;
        return (
            <>
                <br></br>
                <span style={{ color: color, fontWeight: 700 }}>(</span>
                <span>{parts[0]}</span>
                {parts.slice(1).map((el) => {
                    if (React.Children.count(el) > 0) {
                        return (
                            <>
                                {" "}
                                <strong>{prereq.type}</strong> <span>{el}</span>
                            </>
                        );
                    }
                })}
                <span style={{ color: color, fontWeight: 700 }}>)</span>
                <br></br>
            </>
        );
    }, []);

    const prerequisitesText = useMemo(() => {
        if (!infoData) return <>None</>;
        return getPrereqText(infoData.prereq_tree);
    }, [getPrereqText, infoCourse, infoData]);

    const infoLink = infoCourse
        ? `https://catalog.njit.edu/search/?search=${encodeURIComponent(
              infoCourse
          )}`
        : "";

    return (
        <div className="flex h-dvh bg-gradient-to-br from-slate-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950">
            {/* Sidebar */}
            <aside className="w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-xl">
                <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                        ViewNJIT
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Visualize classes and prereqs
                    </p>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search courses..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full px-4 py-2.5 pl-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                        />
                        <svg
                            className="absolute left-3 top-3 h-5 w-5 text-slate-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Department Filter */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Filter by Department
                    </label>
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    >
                        <option value="">All Departments</option>
                        {departments.map((dept) => (
                            <option key={dept} value={dept}>
                                {dept}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Show All Button */}
                <div className="px-4 pt-4">
                    <button
                        onClick={() => {
                            setSelectedCourse("");
                            setInfoCourse("");
                        }}
                        className={`w-full px-4 py-2.5 rounded-xl font-medium transition-all ${
                            selectedCourse === ""
                                ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                    >
                        View{" "}
                        {Math.min(displayedCourses.length, MAX_GRAPH_COURSES)}{" "}
                        Results
                    </button>
                </div>

                {/* Course List */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="space-y-1">
                        {displayedCourses.slice(0, 100).map((course) => (
                            <button
                                key={course}
                                onClick={() => {
                                    setSelectedCourse(course);
                                    setInfoCourse(course);
                                }}
                                className={`w-full text-left px-4 py-2.5 rounded-lg font-medium transition-all ${
                                    selectedCourse === course
                                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md"
                                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                }`}
                            >
                                {course}
                            </button>
                        ))}
                        {displayedCourses.length > 100 && (
                            <p className="text-center text-sm text-slate-500 py-2">
                                And {displayedCourses.length - 100} more...
                            </p>
                        )}
                    </div>
                </div>

                {/* Legend */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Legend
                    </h3>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-amber-500"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                AND connection
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-sky-500 animate-pulse"></div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                                OR connection
                            </span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex">
                <div className="flex-1 flex flex-col">
                    {/* Header */}
                    <header className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                                    {selectedCourse ||
                                        selectedDept +
                                            (selectedDept
                                                ? " Deparment"
                                                : "") ||
                                        "All Courses"}
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    {selectedCourse
                                        ? `Viewing prerequisites for ${selectedCourse}`
                                        : displayedCourses.length >
                                          MAX_GRAPH_COURSES
                                        ? `
                                            Showing the first 
                                            ${MAX_GRAPH_COURSES} matches to keep
                                            the graph smooth. Narrow your search
                                            or pick a course to focus.
                                        `
                                        : `Displaying ${Math.min(
                                              displayedCourses.length,
                                              MAX_GRAPH_COURSES
                                          )} courses in graph view`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-sm font-medium">
                                    {Object.keys(graphData).length} classes
                                </span>
                            </div>
                        </div>
                    </header>

                    {/* Graph Container */}
                    <div className="flex-1 p-4">
                        <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800">
                            <CourseGraph
                                graphData={graphData}
                                selectedCourse={selectedCourse || undefined}
                                infoCourse={infoCourse}
                                visibleCourses={graphCourses}
                                onCourseSelect={(course) => {
                                    // setSelectedCourse(course);
                                    setInfoCourse(course);
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Course Sidebar */}
                <aside className="w-80 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 shadow-xl absolute rounded-md shadow-xl ml-7 top-28">
                    <div className="p-2 pl-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        {infoCourse && infoData ? (
                            <>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                    {infoCourse}
                                </h3>
                            </>
                        ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                Select a course to see details
                            </div>
                        )}
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className={`h-5 w-5 text-slate-500 transition-transform ${
                                    isSidebarOpen ? "rotate-180" : ""
                                }`}
                                viewBox="0 0 20 20"
                                fill="currentColor"
                            >
                                <path
                                    fillRule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </button>
                    </div>

                    <div
                        className={`transition-all duration-300 ease-in-out overflow-scroll ${
                            isSidebarOpen
                                ? "max-h-96"
                                : "overflow-hidden max-h-0"
                        }`}
                    >
                        <div className="p-6 pt-2 space-y-4">
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-600 dark:text-slate-400">
                                    Name:
                                </span>{" "}
                                {infoData && infoData.title}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-600 dark:text-slate-400">
                                    Description:
                                </span>{" "}
                                {infoData && infoData.desc}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-600 dark:text-slate-400">
                                    Link:
                                </span>{" "}
                                {infoCourse ? (
                                    <a
                                        href={infoLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-indigo-600 dark:text-indigo-400 hover:underline"
                                    >
                                        {infoCourse} -&gt;
                                    </a>
                                ) : (
                                    "no link"
                                )}
                            </div>
                            <div className="text-sm text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-600 dark:text-slate-400">
                                    Prerequisites:
                                </span>{" "}
                                {infoCourse ? prerequisitesText : "None"}
                            </div>
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
