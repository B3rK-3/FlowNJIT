import json
import os
import time
import dotenv
from google import genai
from google.genai import types
import pickle as pkl

dotenv.load_dotenv()
errors = []
# File Paths
courses_file = r"d:\Projects\NJIT_Course_FLOWCHART\data\njit_courses.json"
prompt_file = r"d:\Projects\NJIT_Course_FLOWCHART\prompt.txt"
output_file = r"d:\Projects\NJIT_Course_FLOWCHART\gemini_2_5_pro.json"

graph_output = {}
def create_graph_json():
    # Check for API Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        print("Please set it using: set GEMINI_API_KEY=your_api_key_here")
        return

    # Configure Gemini
    client = genai.Client(api_key=api_key)

    # Load Data
    if not os.path.exists(courses_file):
        print(f"File not found: {courses_file}")
        return

    print("Loading courses and prompt...")
    with open(courses_file, "r") as f:
        courses_data = json.load(f)

    with open(prompt_file, "r", encoding='utf-8') as f:
        prompt_template = f.read()

    # Collect all courses that have prerequisites
    courses_to_process = []
    for subject, course_list in courses_data.items():
        for course_obj in course_list:
            if "desc" in course_obj:
                courses_to_process.append(course_obj)

    total_courses = len(courses_to_process)
    print(f"Found {total_courses} courses with prerequisites.")

    # Process each course
    for i, course_obj in enumerate(courses_to_process):
        course_code = course_obj.get("course")
        prereq_text = course_obj.get("desc")

        if not course_code.startswith("CS"):
            continue

        print(f"[{i + 1}/{total_courses}] Processing {course_code}...", end="\r")

        # Inject text into prompt
        final_prompt = prompt_template + '\n INPUT: ' + prereq_text

        try:
            response = client.models.generate_content(
                model="gemini-2.5-pro",
                contents=final_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )

            # Parse JSON response
            try:
                parsed_json = json.loads(response.text)
                print(course_code, ":", parsed_json)
                parsed_json["desc"] = prereq_text
                print()
                print(prereq_text)
                usage = response.usage_metadata
                print(f"Total Tokens: {usage.total_token_count}")
                print(f"Cached Tokens: {usage.cached_content_token_count}")
                print("-"*50)
                graph_output[course_code] = parsed_json
            except json.JSONDecodeError:
                print(f"\nError parsing JSON for {course_code}. Raw output saved.")
                graph_output[course_code] = {
                    "error": "JSON Parse Error",
                    "raw_response": response.text,
                }
        except Exception as e:
            print(f"\nAPI Error on {course_code}: {e}")
            time.sleep(5)  # Backoff on error
        save()

    print(f"\nSaving results to {output_file}...")
    with open(output_file, "w") as f:
        json.dump(graph_output, f, indent=4)
    print("Process complete.")

def save():
    pkl.dump(errors, open('erros.pkl', 'wb+'))
    with open(output_file, "w") as f:
        json.dump(graph_output, f, indent=4)


def create_graph_json_missing_courses(
    all_courses_file: str = r"d:\Projects\NJIT_Course_FLOWCHART\data\all_course_njit.json",
    graph_file: str = r"d:\Projects\NJIT_Course_FLOWCHART\graph.json",
    output_file_missing: str = r"d:\Projects\NJIT_Course_FLOWCHART\gemini_2_5_pro_missing.json"
):
    """
    Processes only courses that exist in all_courses_file but NOT in graph_file.
    Uses the same Gemini API to generate prerequisite data for missing courses.
    """
    global errors, graph_output
    
    # Check for API Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        return

    # Configure Gemini
    client = genai.Client(api_key=api_key)

    # Load existing graph
    existing_courses = set()
    if os.path.exists(graph_file):
        print(f"Loading existing graph from {graph_file}...")
        with open(graph_file, "r") as f:
            existing_graph = json.load(f)
            existing_courses = set(existing_graph.keys())
        print(f"Found {len(existing_courses)} courses already in graph.json")
    else:
        print(f"Graph file not found: {graph_file}")
        return

    # Load all courses
    if not os.path.exists(all_courses_file):
        print(f"File not found: {all_courses_file}")
        return

    print(f"Loading all courses from {all_courses_file}...")
    with open(all_courses_file, "r") as f:
        courses_data = json.load(f)

    with open(prompt_file, "r", encoding='utf-8') as f:
        prompt_template = f.read()

    # Collect courses that are NOT in graph.json
    courses_to_process = []
    for course_code, course_info in courses_data.items():
        if course_code and course_code not in existing_courses:
            courses_to_process.append((course_code, course_info))

    total_courses = len(courses_to_process)
    print(f"Found {total_courses} courses missing from graph.json")

    if total_courses == 0:
        print("No missing courses to process.")
        return

    # Load existing graph output to append to it
    missing_graph_output = {}
    if os.path.exists(output_file_missing):
        print(f"Loading existing missing courses data from {output_file_missing}...")
        with open(output_file_missing, "r") as f:
            missing_graph_output = json.load(f)

    # Process each missing course
    for i, course_obj in enumerate(courses_to_process):
        course_code = course_obj[0]
        prereq_text = course_obj[1].get("desc")

        print(f"[{i + 1}/{total_courses}] Processing {course_code}...", end="\r")

        # Inject text into prompt
        final_prompt = prompt_template + '\n INPUT: ' + prereq_text

        try:
            response = client.models.generate_content(
                model="gemini-2.5-pro",
                contents=final_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                ),
            )

            # Parse JSON response
            try:
                parsed_json = json.loads(response.text.replace('undefined', 'null'))
                print(f"{course_code}: Success")
                parsed_json["desc"] = prereq_text
                usage = response.usage_metadata
                print(f"Total Tokens: {usage.total_token_count}")
                print(f"Cached Tokens: {usage.cached_content_token_count}")
                print("-" * 50)
                missing_graph_output[course_code] = parsed_json
            except json.JSONDecodeError:
                print(f"\nError parsing JSON for {course_code}. Raw output saved.")
                missing_graph_output[course_code] = {
                    "error": "JSON Parse Error",
                    "raw_response": response.text,
                }
        except Exception as e:
            print(f"\nAPI Error on {course_code}: {e}")
            time.sleep(5)  # Backoff on error
        
        # Save progress
        with open(output_file_missing, "w") as f:
            json.dump(missing_graph_output, f, indent=4)

    print(f"\nSaving results to {output_file_missing}...")
    with open(output_file_missing, "w") as f:
        json.dump(missing_graph_output, f, indent=4)
    print("Process complete.")


if __name__ == "__main__":
    start_time = time.time()
    # create_graph_json()
    create_graph_json_missing_courses()
    end_time = time.time()

    print("TIME TAKEN:", end_time-start_time)
