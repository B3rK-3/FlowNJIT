import json
import re


def convert_scraped_courses_format(input_file: str = 'data/scraped_courses_grad.json', output_file: str = 'data/scraped_courses_flat1.json'):
    """
    Converts scraped courses from departmental structure to flat course_code -> {desc, title} format.
    
    Input format:
    {
        "Computing Sciences": [
            {
                "course": "BNFO 601.  Foundations of Bioinformatics I.  3 credits, 3 contact hours.",
                "desc": "..."
            },
            ...
        ],
        ...
    }
    
    Output format:
    {
        "BNFO 601": {
            "desc": "...",
            "title": "Foundations of Bioinformatics I"
        },
        ...
    }
    """
    print(f"Loading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        courses_by_dept = json.load(f)
    
    flat_courses = {}
    
    for department, course_list in courses_by_dept.items():
        print(f"\nProcessing {department}...")
        for course_data in course_list:
            course_str = course_data.get('course', '')
            desc = course_data.get('desc', '')
            
            if course_str:
                # Split by '.' to extract course code and title
                parts = course_str.replace('\u00a0', ' ').split('.')
                
                if len(parts) >= 2:
                    course_code = parts[0].strip()
                    title = parts[1].strip()
                    
                    flat_courses[course_code] = {
                        'desc': desc,
                        'title': title
                    }
                    print(f"  Converted: {course_code} -> {title}")
                else:
                    print(f"  Warning: Could not parse course string: {course_str}")
            else:
                print(f"  Warning: Course missing 'course' field in {department}")
    
    print(f"\nWriting {len(flat_courses)} courses to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(flat_courses, f, indent=2)
    
    print(f"Successfully converted {len(flat_courses)} courses!")


if __name__ == "__main__":
    convert_scraped_courses_format()
