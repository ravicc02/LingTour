"""Check Git-visible Markdown links without scanning dependencies or worktrees."""
import argparse
from pathlib import Path
import re
import subprocess
from urllib.parse import unquote

LINK = re.compile(r"\[[^\]]*\]\(([^)]+)\)")
INLINE_CODE = re.compile(r"(`+)(.*?)\1")
FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")


def links(text):
    fence = None
    for number, line in enumerate(text.splitlines(), 1):
        match = FENCE.match(line)
        if match:
            marker = match[1]
            if fence is None:
                fence = marker
            elif marker[0] == fence[0] and len(marker) >= len(fence):
                fence = None
            continue
        if fence is not None:
            continue
        line = INLINE_CODE.sub("", line)
        for raw in LINK.findall(line):
            target = raw.strip()
            if target.startswith("<") and ">" in target:
                target = target[1:target.index(">")]
            else:
                target = target.split(' "', 1)[0].split(" '", 1)[0]
            if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target) or target.startswith(("#", "/")):
                continue
            target = unquote(target.split("#", 1)[0].split("?", 1)[0])
            if target:
                yield number, target


def check(root):
    result = subprocess.run(
        ["git", "-C", str(root), "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "*.md"],
        check=True, capture_output=True,
    )
    missing, ignored, checked = [], [], 0
    for relative in sorted(set(result.stdout.decode("utf-8").split("\0")) - {""}):
        source = root / relative
        if not source.is_file():  # Tracked deletions are handled by the commit-range check.
            continue
        checked += 1
        for line, target in links(source.read_text(encoding="utf-8-sig")):
            destination = (source.parent / target).resolve()
            if destination.exists():
                continue
            try:
                destination_relative = destination.relative_to(root).as_posix()
            except ValueError:
                missing.append(f"{relative}:{line}: {target}")
                continue
            ignored_target = subprocess.run(
                ["git", "-C", str(root), "check-ignore", "--quiet", "--", destination_relative],
                capture_output=True,
            ).returncode == 0
            if ignored_target:
                ignored.append(f"{relative}:{line}: {target}")
            else:
                missing.append(f"{relative}:{line}: {target}")
    return checked, missing, ignored


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args()
    checked, missing, ignored = check(args.root.resolve())
    for item in ignored:
        print(f"Local-only ignored reference (not distributed): {item}")
    for item in missing:
        print(f"Broken link: {item}")
    print(f"Markdown: {checked} files, {len(missing)} broken links, {len(ignored)} local-only references")
    return bool(missing)


if __name__ == "__main__":
    raise SystemExit(main())
