import json
import os
from typing import List, Dict, Union, Optional, Literal, Set, Tuple, Any, Annotated
from pydantic import BaseModel, RootModel, ConfigDict, ValidationError, Field
import dotenv
import redis
import contextvars


dotenv.load_dotenv("./.env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
CHROMA_KEY = os.getenv("CHROMA_KEY")
CHROMA_TENANT = os.getenv("CHROMA_TENANT")
CHROMA_DB = os.getenv("CHROMA_DB")
# paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, "../data/graph.json")
REDIS = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)


# section entries
SectionEntries = Tuple[str, str, str, str, str, str, str, str, str, str, str, str, str]
SectionInfo = Dict[str, SectionEntries]

TERMS = Literal["202610", "202595", "202590", "202550", "202510"]
STANDINGS = ["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR", "GRAD"]
StandingsLiteral = Literal["FRESHMAN", "SOPHOMORE", "JUNIOR", "SENIOR", "GRAD"]

SEMESTERS = {
    "10": "Spring",
    "90": "Fall",
    "95": "Winter",
    "50": "Summer",
}

COLLECTION_NAME = "njit_courses"

PermittedGrades = Literal["A", "B+", "B", "C+", "C", "F"]

PlacementKind = Literal[
    "PLACEMENT_INTO_COURSE",
    "PLACEMENT_ABOVE_COURSE",
    "PLACEMENT_TEST_REQUIRED",
    "SCORE_THRESHOLD",
    "DIAGNOSTIC",
    "UNKNOWN",
]

PermissionKind = Literal[
    "INSTRUCTOR_APPROVAL",
    "ADVISOR_APPROVAL",
    "DEPARTMENT_APPROVAL",
    "SCHOOL_APPROVAL",
    "PROGRAM_APPROVAL",
    "ADMIN_OVERRIDE",
    "UNKNOWN",
]

PermissionAuthority = Literal[
    "INSTRUCTOR",
    "FACULTY_SUPERVISOR",
    "DEPARTMENT",
    "SCHOOL",
    "PROGRAM",
    "ADVISOR",
    "REGISTRAR",
    "UNKNOWN",
]

PermissionAction = Literal[
    "APPROVAL_REQUIRED",
    "SIGNATURE_REQUIRED",
    "PROPOSAL_APPROVAL",
    "APPLICATION_REQUIRED",
    "OVERRIDE_REQUIRED",
    "UNKNOWN",
]

RestrictionKind = Literal[
    "MAJOR_ONLY",
    "PROGRAM_ONLY",
    "CLASS_STANDING_ONLY",
    "CAMPUS_ONLY",
    "COLLEGE_ONLY",
    "INSTRUCTOR_PERMISSION",
    "DEPARTMENT_PERMISSION",
    "ADVISOR_PERMISSION",
    "NOT_FOR_MAJOR",
    "NOT_FOR_PROGRAM",
    "NO_CREDIT_IF_TAKEN",
    "REPEAT_LIMIT",
    "CROSS_LISTED",
    "TIME_CONFLICT_RULE",
    "PRIOR_CREDIT_EXCLUSION",
    "PROGRAM_APPROVAL",
    "OTHER",
]


# pydantic models
class AndOrNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["AND", "OR"]
    children: List["NodesModel"]


class CourseNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["COURSE"]
    course: str
    min_grade: Optional[str] = None


class PlacementNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["PLACEMENT"]
    name: str
    placement_kind: Optional[PlacementKind] = None
    subject: Optional[str] = None
    exam: Optional[str] = None
    min_course: Optional[str] = None
    level: Optional[str] = None
    min_score: Optional[Union[float, str]] = None


class PermissionNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["PERMISSION"]
    raw: str
    permission_kind: Optional[PermissionKind] = None
    authority: Optional[PermissionAuthority] = None
    action: Optional[PermissionAction] = None
    artifact: Optional[List[str]] = None


class StandingNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["STANDING"]
    standing: str
    normalized: StandingsLiteral
    semesters_left: Optional[int] = None


class SkillNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["SKILL"]
    name: str


class EquivalentNodeModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["EQUIVALENT"]
    courses: List[str]


NodesModel = Annotated[
    Union[
        AndOrNodeModel,
        CourseNodeModel,
        PlacementNodeModel,
        PermissionNodeModel,
        StandingNodeModel,
        SkillNodeModel,
        EquivalentNodeModel,
    ],
    Field(discriminator="type"),  # <--- Critical for Gemini to pick the right one
]
AndOrNodeModel.model_rebuild()


class RestrictionModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    raw: str
    kinds: Optional[List[RestrictionKind]] = None
    entities: Optional[List[str]] = None


class CourseInfoModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    # fixed: added defaults for all trees and optional data
    prereq_tree: Optional[AndOrNodeModel]
    coreq_tree: Optional[AndOrNodeModel]
    restrictions: List[RestrictionModel]
    desc: str
    title: str
    credits: Optional[Union[float, None]] = None
    sections: Optional[Dict[str, SectionInfo]] = None


class CourseStructureModel(RootModel[Dict[str, CourseInfoModel]]):
    pass


class CourseMetadata(BaseModel):
    title: str
    description: str
    hash: str


class CourseQueryFormat(BaseModel):
    model_config = {"extra": "forbid"}

    query: str = Field(
        description="Natural language description of the course(s) the user is searching for."
    )

    top_n: int = Field(
        default=20,
        ge=1,
        le=100,
        description="Maximum number of courses to return, ordered by relevance.",
    )

    only_prereqs_fulfilled: bool = Field(
        default=True,
        description=(
            "If true, return only courses for which the user satisfies all prerequisites. "
            "If false, return all relevant courses regardless of prerequisites."
        ),
    )


class UserCourseInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(
        description="Name of the course. If course is not valid, will return an error.",
    )
    grade: PermittedGrades = Field(
        default="C",
        description="Grade recieved in course. A pass is a 'C'. Example: 'I passed a class', then grade = 'C'.",
    )


UserCourses = Dict[str, UserCourseInfo]


class UserFulfilled(BaseModel):
    model_config = ConfigDict(extra="forbid")
    courses: UserCourses = {}
    equivalents: List[str] = []
    standing: Optional[StandingsLiteral] = None
    semesters_left: Optional[int] = None


class AddUserPrereqsFormat(BaseModel):
    model_config = ConfigDict(extra="forbid")
    courses: List[UserCourseInfo] = Field(
        default_factory=list,
        description="List of completed or in-progress courses the user has taken.",
    )
    equivalents: List[str] = Field(
        default_factory=list,
        description="List of courses that the user has equivalents for. Example: (equivalents for CS 350).",
    )
    standing: Optional[StandingsLiteral] = Field(
        default=None,
        description="User's academic standing (FRESHMAN, SOPHOMORE, JUNIOR, SENIOR, GRAD).",
    )
    semesters_left: Optional[int] = Field(
        default=None, description="Number of semesters remaining until graduation."
    )

class CourseSearchFormat(BaseModel):
    model_config = ConfigDict(extra="forbid")
    course_name: str

class RPCRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    method: str
    params: Dict[str, Any] = {}


class ChatRequest(BaseModel):
    sessionID: str
    query: str
    term: TERMS


class ChatResponse(BaseModel):
    response: str


# data & state
def load_graph_data(path: str) -> Dict[str, CourseInfoModel]:
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    parsed = CourseStructureModel.model_validate(raw)
    return parsed.root


graph_data: Dict[str, CourseInfoModel] = {}

try:
    graph_data = load_graph_data(DATA_FILE)
except FileNotFoundError:
    print(f"Warning: {DATA_FILE} not found. graph_data will be empty.")
except ValidationError as e:
    print("graph.json failed validation:")
    print(e)
    graph_data = {}


# global state
sections_data: Dict[str, SectionEntries] = {}
current_term_courses: Set[str] = set()
CHAT_N = 5
current_session_id = contextvars.ContextVar("current_session_id", default=None)
current_session_prereqs = contextvars.ContextVar[UserFulfilled](
    "current_session_prereqs", default=UserFulfilled()
)
VALID_COURSES = set(graph_data.keys())
