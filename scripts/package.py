#!/usr/bin/env python3
"""Create deterministic installable and source ZIP archives for DUMBER."""

from __future__ import annotations

import hashlib
import json
import os
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
VERSION = MANIFEST["version"]
INSTALL_OUTPUT = DIST / f"dumber-{VERSION}.zip"
SOURCE_OUTPUT = DIST / f"dumber-{VERSION}-source.zip"

INSTALL_FILES = [
    "manifest.json",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
    "README.md",
    "ROADMAP.md",
    "PRIVACY.md",
    "CHANGELOG.md",
    "ARCHITECTURE.md",
    "IMPLEMENTATION_STATUS.md",
]
INSTALL_DIRS = ["assets", "src"]
SOURCE_EXCLUDED_DIRS = {".git", "dist", "marketing", "node_modules", "__pycache__", ".pytest_cache"}
SOURCE_EXCLUDED_SUFFIXES = {".pyc", ".pyo"}
SECRET_PATTERNS = [
    (re.compile(rb"sk-[A-Za-z0-9_-]{16,}"), "OpenAI-style credential-like token"),
    (re.compile(rb"xai-[A-Za-z0-9_-]{16,}", re.IGNORECASE), "xAI-style credential-like token"),
    (re.compile(rb"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}"), "GitHub credential-like token"),
    (re.compile(rb"AIza[0-9A-Za-z_-]{30,}"), "Google API credential-like token"),
    (re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "private key material"),
    (re.compile(rb"sub\.muxing\.cfd", re.IGNORECASE), "legacy proxy endpoint"),
]


def timestamp() -> tuple[int, int, int, int, int, int]:
    raw = os.environ.get("SOURCE_DATE_EPOCH")
    if raw:
        value = datetime.fromtimestamp(int(raw), tz=timezone.utc)
    else:
        value = datetime(2026, 7, 23, tzinfo=timezone.utc)
    if value.year < 1980:
        value = datetime(1980, 1, 1, tzinfo=timezone.utc)
    elif value.year > 2107:
        value = datetime(2107, 12, 31, 23, 59, 58, tzinfo=timezone.utc)
    return value.year, value.month, value.day, value.hour, value.minute, value.second // 2 * 2


def install_files() -> list[Path]:
    files = [ROOT / name for name in INSTALL_FILES]
    for directory in INSTALL_DIRS:
        files.extend(path for path in (ROOT / directory).rglob("*") if path.is_file())
    return sorted(files, key=archive_name)


def source_files() -> list[Path]:
    files: list[Path] = []
    for path in ROOT.rglob("*"):
        relative_parts = path.relative_to(ROOT).parts
        if any(part in SOURCE_EXCLUDED_DIRS for part in relative_parts):
            continue
        if path.is_file() and path.suffix not in SOURCE_EXCLUDED_SUFFIXES:
            files.append(path)
    return sorted(files, key=archive_name)


def archive_name(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def audit_files(files: list[Path]) -> None:
    for path in files:
        if path.is_symlink():
            raise SystemExit(f"symbolic links are not allowed in release archives: {archive_name(path)}")
        data = path.read_bytes()
        for pattern, label in SECRET_PATTERNS:
            if pattern.search(data):
                raise SystemExit(f"{label} found in {archive_name(path)}")


def write_archive(output: Path, files: list[Path]) -> str:
    audit_files(files)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_STORED) as archive:
        for path in files:
            info = zipfile.ZipInfo(archive_name(path), timestamp())
            info.create_system = 3
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    checksum = output.with_suffix(output.suffix + ".sha256")
    checksum.write_text(f"{digest}  {output.name}\n", encoding="utf-8", newline="\n")
    print(f"created {output.relative_to(ROOT)}")
    print(f"sha256 {digest}")
    return digest


def main() -> None:
    DIST.mkdir(exist_ok=True)
    write_archive(INSTALL_OUTPUT, install_files())
    write_archive(SOURCE_OUTPUT, source_files())


if __name__ == "__main__":
    main()
