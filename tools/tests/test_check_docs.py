"""Regression cases for clean-checkout document validation."""
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

SPEC = importlib.util.spec_from_file_location("check_docs", Path(__file__).resolve().parents[1] / "check-docs.py")
docs = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(docs)


class DocumentLinksTest(unittest.TestCase):
    def test_code_examples_are_not_links(self):
        sample = "`[example](missing.md)`\n```md\n[fenced](missing.md)\n```\n[real](actual.md#part)"
        self.assertEqual(list(docs.links(sample)), [(5, "actual.md")])

    def test_remote_images_anchors_and_routes_are_not_files(self):
        self.assertEqual(list(docs.links("[web](https://example.test) [part](#part) ![media](/uploads/a.jpg)")), [])

    def test_angle_paths_and_url_encoding(self):
        self.assertEqual(list(docs.links('[a](<report one.md>) [b](report%20two.md "Title")')), [(1, 'report one.md'), (1, 'report two.md')])

    def test_backticks_in_a_label_do_not_hide_real_link(self):
        self.assertEqual(list(docs.links('[`source`](source.md)')), [(1, 'source.md')])

    def test_clean_checkout_checks_tracked_files_and_local_references(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary).resolve()
            subprocess.run(["git", "init", "--quiet", str(root)], check=True)
            (root / '.gitignore').write_text('review/\n', encoding='utf-8')
            (root / 'README.md').write_text('[good](guide.md) [local](review/report.md) [bad](missing.md)', encoding='utf-8')
            (root / 'guide.md').write_text('# Guide\n', encoding='utf-8')
            subprocess.run(["git", "-C", str(root), "add", "--", ".gitignore", "README.md", "guide.md"], check=True)
            checked, missing, ignored = docs.check(root)
            self.assertEqual(checked, 2)
            self.assertEqual(len(missing), 1)
            self.assertIn('missing.md', missing[0])
            self.assertEqual(len(ignored), 1)
            (root / 'guide.md').unlink()
            checked, missing, ignored = docs.check(root)
            self.assertEqual(checked, 1)
            self.assertEqual(len(missing), 2)  # A tracked deletion must break its existing backlink.


if __name__ == '__main__':
    unittest.main()
