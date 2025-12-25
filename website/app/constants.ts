/** 1) AND/OR node */
export interface AndOrNode {
    type: "AND" | "OR";
    children: Nodes[];
}

/** 3) COURSE node */
export interface CourseNode {
    type: "COURSE";
    course: string; // e.g. "MATH 112", "PHYS 121A"
    min_grade?: string; // e.g. "C", "B-", only when explicitly stated for this course
}

/** 4) PLACEMENT node */
export interface PlacementNode {
    type: "PLACEMENT";
    name: string; // raw phrase (always keep)
    placement_kind?: PlacementKind;
    subject?: string; // e.g., "MATH", "ENGL"
    exam?: string; // e.g., "ACCUPLACER", "ALEKS", "SAT", "AP"
    min_course?: string; // e.g., "MATH 111" meaning “placement into >= this”
    level?: string; // e.g., "college algebra", "calculus"
    min_score?: number | string; // keep string if sources vary (e.g., "QAS 250")
}

export type PlacementKind =
    | "PLACEMENT_INTO_COURSE"
    | "PLACEMENT_ABOVE_COURSE"
    | "PLACEMENT_TEST_REQUIRED"
    | "SCORE_THRESHOLD"
    | "DIAGNOSTIC"
    | "UNKNOWN";

/** 5) PERMISSION node */
export interface PermissionNode {
    type: "PERMISSION";
    raw: string; // raw text (always keep)
    permission_kind?: PermissionKind; // coarse category
    authority?: PermissionAuthority; // who grants it
    action?: PermissionAction; // what must happen
    artifact?: string[]; // proposal/form/etc
}

export type PermissionKind =
    | "INSTRUCTOR_APPROVAL"
    | "DEPARTMENT_APPROVAL"
    | "SCHOOL_APPROVAL"
    | "PROGRAM_APPROVAL"
    | "ADMIN_OVERRIDE"
    | "UNKNOWN";

export type PermissionAuthority =
    | "INSTRUCTOR"
    | "FACULTY_SUPERVISOR"
    | "DEPARTMENT"
    | "SCHOOL"
    | "PROGRAM"
    | "ADVISOR"
    | "REGISTRAR"
    | "UNKNOWN";

export type PermissionAction =
    | "APPROVAL_REQUIRED"
    | "SIGNATURE_REQUIRED"
    | "PROPOSAL_APPROVAL"
    | "APPLICATION_REQUIRED"
    | "OVERRIDE_REQUIRED"
    | "UNKNOWN";

/** 6) STANDING node */
export interface StandingNode {
    type: "STANDING";
    standing: string; // exact
    normalized?: "FRESHMAN" | "SOPHOMORE" | "JUNIOR" | "SENIOR" | "GRAD";
}

/** 7) SKILL node */
export interface SkillNode {
    type: "SKILL";
    name: string; // exact skill phrase from input
}

/** Union of all structured nodes */
export type Nodes =
    | AndOrNode
    | CourseNode
    | PlacementNode
    | PermissionNode
    | StandingNode
    | SkillNode;

/** Compile-time “non-empty array” helper */
export type NonEmptyArray<T> = [T, ...T[]];

export interface Restriction {
    raw: string; // exact text from catalog/banner
    kinds?: RestrictionKind[]; // inferred tags (optional)
    entities?: string[]; // majors/programs/courses mentioned (optional)
}

export type RestrictionKind =
    | "MAJOR_ONLY"
    | "PROGRAM_ONLY"
    | "CLASS_STANDING_ONLY"
    | "CAMPUS_ONLY"
    | "COLLEGE_ONLY"
    | "INSTRUCTOR_PERMISSION"
    | "DEPARTMENT_PERMISSION"
    | "ADVISOR_PERMISSION"
    | "NOT_FOR_MAJOR"
    | "NOT_FOR_PROGRAM"
    | "NO_CREDIT_IF_TAKEN"
    | "REPEAT_LIMIT"
    | "CROSS_LISTED"
    | "TIME_CONFLICT_RULE"
    | "PRIOR_CREDIT_EXCLUSION"
    | "OTHER";

export interface CourseInfo {
    prereq_tree: AndOrNode | null;
    coreq_tree: AndOrNode | null;
    restrictions: Restriction[];
    desc: string;
    title: string;
    credits: number;
}

export interface CourseStructure {
    [courseName: string]: CourseInfo;
}

export const getRandomInt = (min: number, max: number) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateRandomRGB = () => {
    const r = getRandomInt(0, 255);
    const g = getRandomInt(0, 255);
    const b = getRandomInt(0, 255);

    return `rgb(${r}, ${g}, ${b})`;
};

export const generateNonBlueColor = () => {
  const r = getRandomInt(100, 255); // High Red
  const g = getRandomInt(100, 255); // High Green
  const b = getRandomInt(0, 80);    // Keep Blue very low
  
  return `rgb(${r}, ${g}, ${b})`;
};