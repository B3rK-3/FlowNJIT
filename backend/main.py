from functions import initialize_database, course_query
import json


def main() -> None:
    try:
        print("Starting ChromaDB initialization...")
        initialize_database()
        print("Initialization complete.")

    except Exception as error:
        print("Error in main execution:", error)


if __name__ == "__main__":
    main()
