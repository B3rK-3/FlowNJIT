"use client";

import React, { JSX, useEffect, useState } from "react";
import SectionsPopover from "./SectionsPopover";
import { sectionsData, baseURL } from "../constants";
import { ChevronDown, ExternalLink, Info } from "lucide-react";

interface CourseSidebarProps {
    currentCourse: string;
    infoData?: {
        title: string;
        desc: string;
        prereq_tree: any;
    };
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    prerequisitesText: JSX.Element;
    infoLink: string;
    currentTerm: string;
}

export default function CourseSidebar({
    currentCourse,
    infoData,
    isSidebarOpen,
    setIsSidebarOpen,
    prerequisitesText,
    infoLink,
    currentTerm,
}: CourseSidebarProps) {
    const [profLinks, setProfLinks] = useState<
        Record<string, { link: string; avgRating?: string }>
    >({});
    // Fetch professor links when popover opens
    useEffect(() => {
        const fetchProfessorLinks = async () => {
            if (!currentCourse || !sectionsData[currentCourse]) return;

            const courseData = sectionsData[currentCourse];
            const instructors = Array.from(
                new Set(Object.values(courseData).map((section) => section[8]))
            ).filter(Boolean);

            if (instructors.length === 0) return;

            const profURL = `${baseURL}/getprofs`;

            try {
                const response = await fetch(profURL, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ profs: instructors }),
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                const fallback =
                    "https://www.ratemyprofessors.com/teacher-not-found";

                const newLinks: Record<
                    string,
                    { link: string; avgRating?: string }
                > = {};
                instructors.forEach((instructor) => {
                    const profData = data[instructor];
                    if (profData) {
                        newLinks[instructor] = {
                            link: profData.link || fallback,
                            avgRating: profData.avgRating,
                        };
                    } else {
                        newLinks[instructor] = { link: fallback };
                    }
                });

                setProfLinks((prev) => ({ ...prev, ...newLinks }));
            } catch (error) {
                console.error("Error fetching professor data:", error);
            }
        };

        fetchProfessorLinks();
    }, [currentCourse, currentTerm]);
    return (
        <aside className="absolute left-6 top-6 z-20 w-[calc(100%-3rem)] max-w-sm border border-black/15 bg-white shadow-[8px_8px_0_rgba(23,23,23,0.12)] sm:w-80">
            <div className="flex items-center justify-between border-b-4 border-[#cc0000] px-4 py-3">
                <div className="min-w-0">
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-[#cc0000]">
                        Course details
                    </div>
                    <h3 className="truncate text-lg font-black tracking-tight text-[#171717]">
                        {currentCourse || "Select a course"}
                    </h3>
                </div>
                <div className="flex items-center gap-1">
                    {currentCourse && (
                        <SectionsPopover
                            courseName={currentCourse}
                            profLinks={profLinks}
                            currentTerm={currentTerm}
                        />
                    )}
                    <button
                        type="button"
                        aria-label={
                            isSidebarOpen
                                ? "Collapse course details"
                                : "Expand course details"
                        }
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="grid h-8 w-8 place-items-center border border-black/15 text-[#171717] transition hover:border-[#cc0000] hover:text-[#cc0000]"
                    >
                        <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                                isSidebarOpen ? "rotate-180" : ""
                            }`}
                        />
                    </button>
                </div>
            </div>

            <div
                className={`overflow-y-auto transition-all duration-300 ${
                    isSidebarOpen ? "max-h-[360px]" : "max-h-0 overflow-hidden"
                }`}
            >
                {currentCourse && infoData ? (
                    <div className="space-y-5 p-4">
                        <div>
                            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#847e77]">
                                Catalog title
                            </div>
                            <p className="text-sm font-bold leading-snug text-[#272727]">
                                {infoData.title}
                            </p>
                        </div>
                        <div>
                            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#847e77]">
                                Description
                            </div>
                            <p className="text-xs leading-relaxed text-[#5e5953]">
                                {infoData.desc}
                            </p>
                        </div>
                        <div>
                            <div className="mb-1 text-[9px] font-black uppercase tracking-[0.16em] text-[#847e77]">
                                Prerequisites
                            </div>
                            <div className="text-xs leading-relaxed text-[#272727]">
                                {prerequisitesText}
                            </div>
                        </div>
                        <a
                            href={infoLink}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-between border-t border-black/10 pt-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#cc0000] hover:text-[#990000]"
                        >
                            Open official catalog
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    </div>
                ) : (
                    <div className="flex gap-3 p-4 text-xs leading-relaxed text-[#68635d]">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#cc0000]" />
                        Choose a node in the pathway graph to inspect its
                        description, prerequisites, and available sections.
                    </div>
                )}
            </div>
        </aside>
    );
}
