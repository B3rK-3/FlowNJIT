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
                errors.append(course_code)
        except Exception as e:
            errors.append(course_code)
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

if __name__ == "__main__":
    start_time = time.time()
    create_graph_json()
    end_time = time.time()

    print("TIME TAKEN:", end_time-start_time)
