#!/usr/bin/env python3
"""Validate an HR Hub web app folder and package it as <folder>.zip (same rules as the HR Hub upload check).

Usage: python3 package.py <app-folder> [output.zip]
"""
import os
import re
import sys
import zipfile

ALLOWED = set(
    "html htm css js mjs json map txt md xml csv svg png jpg jpeg gif webp avif ico woff woff2 ttf otf webmanifest wasm mp3 mp4 webm ogg wav".split()
)
MAX_FILES, MAX_FILE, MAX_TOTAL, MAX_ARCHIVE = 2000, 20 * 2**20, 200 * 2**20, 50 * 2**20


def main() -> int:
    if len(sys.argv) < 2 or not os.path.isdir(sys.argv[1]):
        print("usage: package.py <app-folder> [output.zip]")
        return 2

    src = os.path.abspath(sys.argv[1])
    out = os.path.abspath(sys.argv[2]) if len(sys.argv) > 2 else src.rstrip("/") + ".zip"
    errors, warnings, files = [], [], []

    for root, dirs, names in os.walk(src):
        dirs[:] = [d for d in dirs if d not in ("node_modules", "__MACOSX") and not d.startswith(".git")]
        for name in names:
            if name == ".DS_Store":
                continue
            path = os.path.join(root, name)
            rel = os.path.relpath(path, src).replace(os.sep, "/")
            if os.path.islink(path):
                errors.append(f"symlink not allowed: {rel}")
            elif os.path.splitext(name)[1][1:].lower() not in ALLOWED:
                errors.append(f"file type not allowed: {rel}")
            elif os.path.getsize(path) > MAX_FILE:
                errors.append(f"file larger than 20 MB: {rel}")
            else:
                files.append((path, rel))

    if not any(rel == "index.html" for _, rel in files):
        errors.append("index.html must exist at the root of the folder")
    if len(files) > MAX_FILES:
        errors.append(f"more than {MAX_FILES} files")
    if sum(os.path.getsize(p) for p, _ in files) > MAX_TOTAL:
        errors.append("more than 200 MB in total")

    # Content checks on text files
    for path, rel in files:
        if not rel.lower().endswith((".html", ".htm", ".js", ".mjs")):
            continue
        text = open(path, encoding="utf-8", errors="ignore").read()
        if re.search(r"\b(localStorage|sessionStorage|indexedDB)\b", text):
            warnings.append(f"{rel}: uses browser storage, which is blocked in the sandbox (use hrhub.data)")
        if re.search(r"document\.cookie", text):
            warnings.append(f"{rel}: cookies are not available in the sandbox")
        if re.search(r"fetch\(\s*['\"`]/?(hr-hub/)?api/", text):
            warnings.append(f"{rel}: direct HR Hub API calls are not allowed (use hrhub-sdk.js)")
        if re.search(r"\beval\(|document\.write\(", text):
            warnings.append(f"{rel}: avoid eval/document.write")
        if rel.endswith((".html", ".htm")) and re.search(r"(src|href)=['\"]https?://", text):
            warnings.append(f"{rel}: external resource; apps should be self-contained")
        if rel == "index.html":
            if "/hr-hub/hrhub-sdk.js" not in text:
                warnings.append("index.html does not load /hr-hub/hrhub-sdk.js (needed to persist data)")
            if "/hr-hub/hrhub-theme.css" not in text:
                warnings.append("index.html does not load /hr-hub/hrhub-theme.css (HR Hub styling)")

    for message in warnings:
        print("WARN ", message)
    if errors:
        for message in errors:
            print("ERROR", message)
        return 1

    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for path, rel in sorted(files, key=lambda item: item[1]):
            archive.write(path, rel)

    size = os.path.getsize(out)
    if size > MAX_ARCHIVE:
        print(f"ERROR archive is {size / 2**20:.1f} MB (limit 50 MB)")
        return 1
    print(f"OK    {out} ({len(files)} files, {size / 1024:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
