import json


def section_info_into_graph(graph_path: str):
    """
    Merges section information (title and credits) from sections.json into graph.json
    and outputs the result to n_graph.json.
    """
    graph = json.loads(open(graph_path).read())
    sections = json.loads(open('sections.json').read())

    new_graph = {}

    for course_name, values in graph.items():
        course_sections = sections[course_name]
        course_title = course_sections[0]

        try:
            num_credits = float(course_sections[1][list(course_sections[1].keys())[0]][-3])
        except Exception as e:
            print(course_title)
            exit
        values['title'] = course_title
        values['credits'] = num_credits
        new_graph[course_name] = values

    json.dump(new_graph, open('n_graph.json', 'w'))


def fix_parse_errors(graph_path: str):
    graph_str = open(graph_path, 'r', encoding='utf-8').read()
    graph: dict[str, dict] = json.loads(graph_str)
    
    for key, value in graph.items():
        if 'error' in value.keys():
            if value['error'] == "JSON Parse Error":
                response = value['raw_response'].replace('undefined', 'null')
                response = json.loads(response)
                graph[key] = response 
            else:
                print(value['error'])
    open(graph_path, 'w').write(json.dumps(graph))


def add_missing_descriptions(graph_path: str, courses_path: str = 'data/njit_courses_flat.json'):
    """
    Fills in missing 'desc' fields in graph.json by looking them up from njit_courses.json.
    Saves the updated graph back to the same file.
    """
    graph = json.loads(open(graph_path, 'r', encoding='utf-8').read())
    courses = json.loads(open(courses_path, 'r', encoding='utf-8').read())
    
    for course_name, course_data in graph.items():
        if 'desc' not in course_data or course_data['desc'] is None:
            # Try to find the course in njit_courses.json
            if course_name in courses:
                course_desc = courses[course_name].get('desc', None)
                if course_desc:
                    graph[course_name]['desc'] = course_desc
                    print(f"Added description for {course_name}")
                else:
                    graph[course_name]['desc'] = "No Description"
                    print(f"No description found for {course_name} in courses data")
            else:
                print(f"Course {course_name} not found in courses data")
    
    open(graph_path, 'w', encoding='utf-8').write(json.dumps(graph))
    print(f"Updated {graph_path} with missing descriptions")


if __name__ == "__main__":
    add_missing_descriptions('graph.json')
    # fix_parse_errors('gemini_2_5_pro.json')
    # section_info_into_graph('gemini_2_5_pro.json')
    
