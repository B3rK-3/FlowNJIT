import json
import os
import time
import dotenv
from google import genai
from google.genai import types

dotenv.load_dotenv()

PROMPT_FILE = r"d:\Projects\NJIT_Course_FLOWCHART\prompt.txt"


def process_single_description(description):
    """
    Takes a single course description, queries the Gemini model using the prompt template,
    and returns the parsed JSON output.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        return None

    client = genai.Client(api_key=api_key)

    if not os.path.exists(PROMPT_FILE):
        print(f"File not found: {PROMPT_FILE}")
        return None

    with open(PROMPT_FILE, "r", encoding="utf-8") as f:
        prompt_template = f.read()

    final_prompt = prompt_template + "\n INPUT: " + description

    try:
        response = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=final_prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )

        # Parse JSON response
        try:
            # Handle potential 'undefined' values from model output
            clean_text = response.text.replace("undefined", "null")
            parsed_json = json.loads(clean_text)
            return parsed_json
        except json.JSONDecodeError:
            print(f"Error parsing JSON. Raw output: {response.text}")
            return {
                "error": "JSON Parse Error",
                "raw_response": response.text,
            }

    except Exception as e:
        print(f"API Error: {e}")
        return {}


if __name__ == "__main__":
    # Existing analysis code
    if os.path.exists("graph.json"):
        with open("graph.json", "r") as f:
            graph = json.load(f)

        courses_without_prereq = [
            course_id for course_id, data in graph.items() if "prereq_tree" not in data
        ]

        for course_id in courses_without_prereq:
            print(course_id)
            course_return = {
                "prereq_tree": None,
                "coreq_tree": None,
                "restrictions": [],
            }
            if graph[course_id]["desc"] not in ("", "No Description"):
                course_return = process_single_description(graph[course_id]["desc"])
            graph[course_id].update(course_return)
            print(graph[course_id])

        with open("graph.json", "w") as f:
            f.write(json.dumps(graph))

        print(f"Courses without prereq tree: {len(courses_without_prereq)}")
    else:
        print("graph.json not found in current directory.")
