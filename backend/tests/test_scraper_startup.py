import importlib
import os
import sys
import tempfile
import types
import unittest
from unittest.mock import patch


class ScraperStartupTests(unittest.TestCase):
    def test_course_sections_refresh_before_first_sleep(self):
        scrape_calls = []
        publish_calls = []

        courses = types.ModuleType("backend.scrapers.courses")
        courses.scrape_courses = lambda term, sections=False: scrape_calls.append(
            (term, sections)
        )

        rmp = types.ModuleType("backend.scrapers.rmp")
        rmp.check_all_lecturers = lambda: None

        class Logger:
            def info(self, *args, **kwargs):
                pass

            def warning(self, *args, **kwargs):
                pass

            def error(self, *args, **kwargs):
                pass

        class Redis:
            def publish(self, *args):
                publish_calls.append(args)

        scraper_constants = types.ModuleType("backend.scrapers.constants")
        scraper_constants.logger = Logger()
        scraper_constants.REDIS = Redis()
        scraper_constants.LECTURER_DATA = {}
        scraper_constants.COURSE_DATA = {}

        with tempfile.NamedTemporaryFile(mode="w", delete=False) as term_file:
            term_file.write("202690")
            scraper_constants.TERM_FILE_PATH = term_file.name

        modules = {
            "backend.scrapers.courses": courses,
            "backend.scrapers.rmp": rmp,
            "backend.scrapers.constants": scraper_constants,
        }

        sys.modules.pop("backend.scrapers.__main__", None)
        try:
            with patch.dict(sys.modules, modules):
                scraper_main = importlib.import_module("backend.scrapers.__main__")
                with patch.object(
                    scraper_main.time,
                    "sleep",
                    side_effect=RuntimeError("stop after first cycle"),
                ):
                    with self.assertRaisesRegex(RuntimeError, "stop after first cycle"):
                        scraper_main.run_course_scraper()
        finally:
            sys.modules.pop("backend.scrapers.__main__", None)
            os.unlink(scraper_constants.TERM_FILE_PATH)

        self.assertEqual(scrape_calls, [("202690", True)])
        self.assertEqual(publish_calls, [("course_updates", "sections")])


if __name__ == "__main__":
    unittest.main()
