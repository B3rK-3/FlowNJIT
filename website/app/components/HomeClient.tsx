"use client";

import React, {
    useState,
    useMemo,
    useCallback,
    useEffect,
    JSX,
    useRef,
} from "react";
import dynamic from "next/dynamic";

import {
    CourseStructure,
    currentTermCourses,
    currentTerm,
    generateNonBlueColor,
    generateRandomRGB,
    getRandomInt,
    Nodes,
    updateSectionsData,
    initCourseData,
    _COURSE_DATA,
} from "../constants";
import { useRouter } from "next/navigation";

import { Span } from "next/dist/trace";
import MainSidebar from "./MainSidebar";
import CourseSidebar from "./CourseSidebar";
import ChatPopup from "./ChatPopup";

const MAX_GRAPH_COURSES = 40;

// Dynamic import to avoid SSR issues with React Flow
const CourseGraph = dynamic(() => import("./CourseGraph"), {
    ssr: false,
    loading: () => (
        <div className="flex h-full items-center justify-center">
            <div className="h-10 w-10 animate-spin border-2 border-black/15 border-t-[#cc0000]" />
        </div>
    ),
});

interface HomeClientProps {
    initialSelectedDept?: string;
    initialSelectedCourse?: string;
    initialSearchQuery?: string;
    initialInfoCourse?: string;
    course_data?: CourseStructure;
}

export default function HomeClient({
    initialSelectedDept,
    initialSelectedCourse,
    initialSearchQuery,
    initialInfoCourse,
    course_data,
}: HomeClientProps) {
    if (
        course_data &&
        Object.keys(_COURSE_DATA).length === 0 &&
        Object.keys(course_data).length > 0
    ) {
        initCourseData(course_data);
    }
    // console.log(course_data);
    const [selectedCourse, setSelectedCourse] = useState<string>(
        initialSelectedCourse ?? ""
    );
    const [currentCourse, setCurrentCourse] = useState<string>(
        initialInfoCourse ?? initialSelectedCourse ?? ""
    );
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedTerm, setSelectedTerm] = useState(currentTerm);
    const [displayOnlyTermCourses, setDisplayOnlyTermCourses] = useState(false);
    const router = useRouter();

    const [searchQuery, setSearchQuery] = useState(initialSearchQuery ?? "");
    const [selectedDept, setSelectedDept] = useState(
        initialSelectedDept ?? "ALL"
    );

    useEffect(() => {
        setSelectedCourse(initialSelectedCourse ?? "");
        setCurrentCourse(initialInfoCourse ?? initialSelectedCourse ?? "");
        setSearchQuery(initialSearchQuery ?? "");
        setSelectedDept(initialSelectedDept ?? "ALL");
    }, [
        initialInfoCourse,
        initialSearchQuery,
        initialSelectedCourse,
        initialSelectedDept,
    ]);

    useEffect(() => {
        updateSectionsData(selectedTerm);
    }, [selectedTerm]);

    const handleDeptChange = (newDept: string) => {
        setSelectedDept(newDept);
        const url = new URL(window.location.origin);
        url.pathname += `dept/${newDept}`;
        if (searchQuery) {
            url.searchParams.set("search", searchQuery);
        } else {
            url.searchParams.delete("search");
        }
        window.history.replaceState(null, "", url.toString());
    };

    const handleSearchChange = (newSearch: string) => {
        setSearchQuery(newSearch);
        const url = new URL(window.location.href);
        if (newSearch) {
            url.searchParams.set("search", newSearch);
        } else {
            url.searchParams.delete("search");
        }
        window.history.replaceState(null, "", url.toString());
    };

    const courseList = useMemo(() => {
        if (displayOnlyTermCourses) {
            return [...currentTermCourses].sort();
        }
        return Object.keys(_COURSE_DATA).sort();
    }, [displayOnlyTermCourses, selectedTerm]);

    const filteredCourses = useMemo(() => {
        // console.log(courseList);
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

    const graphContainerRef = useRef<HTMLDivElement>(null);
    const [graphDimensions, setGraphDimensions] = useState({
        width: 0,
        height: 0,
    });

    useEffect(() => {
        if (!graphContainerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setGraphDimensions({ width, height });
            }
        });

        observer.observe(graphContainerRef.current);
        return () => observer.disconnect();
    }, []);

    const displayedCourses = useMemo(() => {
        let courses = filteredCourses;
        if (selectedDept != "ALL") {
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
        if (!currentCourse) return undefined;
        return _COURSE_DATA[currentCourse];
    }, [currentCourse]);

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
                            <span key={getRandomInt(0, 9007199254740990)}>
                                {" "}
                                <strong>{prereq.type}</strong> <span>{el}</span>
                            </span>
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
    }, [getPrereqText, currentCourse, infoData]);

    const infoLink = currentCourse
        ? `https://catalog.njit.edu/search/?search=${encodeURIComponent(
              currentCourse
          )}`
        : "";

    return (
        <div className="flex min-h-dvh flex-col bg-[#f4f2ee] lg:h-dvh lg:flex-row lg:overflow-hidden">
            <MainSidebar
                searchQuery={searchQuery}
                setSearchQuery={handleSearchChange}
                selectedDept={selectedDept == "ALL" ? "" : selectedDept}
                setSelectedDept={handleDeptChange}
                departments={departments}
                displayedCourses={displayedCourses}
                selectedCourse={selectedCourse}
                setSelectedCourse={setSelectedCourse}
                setCurrentCourse={setCurrentCourse}
                currentTerm={selectedTerm}
                onTermChange={setSelectedTerm}
                displayOnlyTermCourses={displayOnlyTermCourses}
                setDisplayOnlyTermCourses={setDisplayOnlyTermCourses}
            />

            <main className="relative flex min-h-[720px] min-w-0 flex-1 flex-col lg:min-h-0">
                <header className="relative z-10 border-b border-black/10 bg-white px-5 py-4 sm:px-7">
                    <div className="flex items-center justify-between gap-5">
                        <div className="min-w-0">
                            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#cc0000]">
                                NJIT course catalog / term {selectedTerm}
                            </div>
                            <h2 className="truncate text-2xl font-black uppercase tracking-[-0.035em] text-[#171717] sm:text-3xl">
                                {selectedCourse ||
                                    (selectedDept !== "ALL"
                                        ? `${selectedDept} Department`
                                        : "All Course Pathways")}
                            </h2>
                            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#68635d] sm:text-sm">
                                {selectedCourse
                                    ? `Tracing the prerequisite path for ${selectedCourse}. Select any node to inspect its catalog details.`
                                    : displayedCourses.length >
                                      MAX_GRAPH_COURSES
                                    ? `Showing the first ${MAX_GRAPH_COURSES} of ${displayedCourses.length} matches. Search or choose a department to narrow the graph.`
                                    : `${Math.min(
                                          displayedCourses.length,
                                          MAX_GRAPH_COURSES
                                      )} courses currently mapped.`}
                            </p>
                        </div>
                        <div className="hidden shrink-0 items-stretch sm:flex">
                            <div className="border-l-4 border-[#cc0000] bg-[#f4f2ee] px-4 py-2">
                                <div className="text-xl font-black leading-none text-[#171717]">
                                    {Object.keys(_COURSE_DATA).length}
                                </div>
                                <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.15em] text-[#77716a]">
                                    Courses indexed
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div
                    className="relative min-h-[560px] flex-1 p-3 sm:p-5"
                    ref={graphContainerRef}
                >
                    <div className="h-full min-h-[540px] w-full overflow-hidden border border-black/15 bg-white shadow-[0_12px_36px_rgba(23,23,23,0.08)]">
                        <CourseGraph
                            graphData={_COURSE_DATA}
                            selectedCourse={selectedCourse || undefined}
                            infoCourse={currentCourse}
                            visibleCourses={graphCourses}
                            onCourseSelect={setCurrentCourse}
                        />
                    </div>

                    <CourseSidebar
                        currentCourse={currentCourse}
                        infoData={infoData}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        prerequisitesText={prerequisitesText}
                        infoLink={infoLink}
                        currentTerm={selectedTerm}
                    />
                </div>
            </main>

            <ChatPopup
                setSearchQuery={handleSearchChange}
                maxWidth={graphDimensions.width}
                maxHeight={graphDimensions.height}
            />
        </div>
    );
}
