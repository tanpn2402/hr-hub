#!/usr/bin/env python3
"""Validate an HR Hub web app folder and package it as <folder>.zip (same rules as the HR Hub upload check).

Usage: python3 package.py <app-folder> [output.zip]
"""
import json
import os
import re
import sys
import zipfile

ALLOWED = set(
    "html htm css js mjs json map txt md xml csv svg png jpg jpeg gif webp avif ico woff woff2 ttf otf webmanifest wasm mp3 mp4 webm ogg wav".split()
)
ICON_FILES = ("favicon.svg", "favicon.png", "favicon.ico")  # HR Hub picks the first one found at the root
MAX_FILES, MAX_FILE, MAX_TOTAL, MAX_ARCHIVE = 2000, 20 * 2**20, 200 * 2**20, 50 * 2**20
SLUG = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}$")


SETTING_KEY = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,39}$")
SETTING_TYPES = ("app", "string", "text", "number", "boolean", "select")


def check_manifest(path, files):
    """Same rules as the HR Hub upload check (web-app-manifest.ts): a broken hrhub.json rejects the upload."""
    try:
        raw = json.load(open(path, encoding="utf-8"))
    except ValueError as error:
        return [f"hrhub.json is not valid JSON ({error})"]
    if not isinstance(raw, dict):
        return ["hrhub.json must be a JSON object"]
    errors = []

    for key, limit in (("name", 100), ("description", 500), ("slug", 63), ("icon", 100)):
        if key in raw and raw[key] is not None and (not isinstance(raw[key], str) or len(raw[key]) > limit):
            errors.append(f'hrhub.json "{key}" must be text (max {limit})')
    if isinstance(raw.get("slug"), str) and not SLUG.match(raw["slug"]):
        errors.append('hrhub.json "slug" must use lowercase letters, digits and hyphens (2-63)')
    icon = raw.get("icon")
    if isinstance(icon, str):
        if not re.match(r"^[A-Za-z0-9._-]+\.(svg|png|ico|webp)$", icon, re.I):
            errors.append('hrhub.json "icon" must be a file at the root (.svg, .png, .ico, .webp)')
        elif icon not in files:
            errors.append(f'hrhub.json "icon": {icon} is not at the root of the folder')

    settings = raw.get("settings", {})
    app_settings = set()
    if not isinstance(settings, dict):
        errors.append('hrhub.json "settings" must be an object { key: { type, label, ... } }')
        settings = {}
    for key, definition in list(settings.items())[:30]:
        at = f"hrhub.json settings.{key}"
        if not SETTING_KEY.match(key):
            errors.append(f"{at}: key must start with a letter and use letters, digits, _ (max 40)")
            continue
        if not isinstance(definition, dict):
            errors.append(f"{at} must be an object {{ type, label }}")
            continue
        kind = definition.get("type")
        if kind not in SETTING_TYPES:
            errors.append(f"{at}.type must be one of {', '.join(SETTING_TYPES)}")
        if not isinstance(definition.get("label"), str) or not definition["label"].strip():
            errors.append(f"{at}.label is required")
        if "required" in definition and not isinstance(definition["required"], bool):
            errors.append(f"{at}.required must be true or false")
        if kind == "select":
            options = definition.get("options")
            if not isinstance(options, list) or not 1 <= len(options) <= 50:
                errors.append(f"{at}.options must list 1-50 choices")
        if kind == "app":
            app_settings.add(key)
    if len(settings) > 30:
        errors.append('hrhub.json "settings": at most 30 keys')

    realtime = raw.get("realtime")
    if realtime is None:
        return errors
    if not isinstance(realtime, dict) or not isinstance(realtime.get("channels"), list):
        return errors + ['hrhub.json: "realtime" must be { "channels": [...] }']
    prefixes = []
    for i, rule in enumerate(realtime["channels"]):
        at = f"hrhub.json realtime.channels[{i}]"
        if not isinstance(rule, dict):
            errors.append(f"{at} must be an object")
            continue
        prefix = rule.get("prefix", "")
        if not isinstance(prefix, str) or (prefix and not re.match(r"^[A-Za-z0-9._:-]{1,48}$", prefix)):
            errors.append(f"{at}.prefix must use letters, digits, . _ : - (max 48)")
        prefixes.append(prefix)
        participants = rule.get("participants", [])
        if not isinstance(participants, list):
            errors.append(f"{at}.participants must be a list")
            participants = []
        for entry in participants:
            if isinstance(entry, str) and SLUG.match(entry.strip()):
                continue
            if isinstance(entry, dict) and isinstance(entry.get("$setting"), str):
                if entry["$setting"] not in app_settings:
                    errors.append(f'{at}.participants: "$setting": "{entry["$setting"]}" must name an "app" setting')
                continue
            errors.append(f'{at}.participants: each entry is an app slug or {{ "$setting": "<app setting>" }}')
        roles = rule.get("hostRoles", [])
        if not isinstance(roles, list) or any(not isinstance(v, str) or not v.strip() or len(v) > 100 for v in roles):
            errors.append(f"{at}.hostRoles must be a list of names")
        for key, low, high in (("maxParticipants", 1, 2000), ("hostGraceSeconds", 0, 3600)):
            value = rule.get(key)
            if value is not None and (not isinstance(value, int) or isinstance(value, bool) or not low <= value <= high):
                errors.append(f"{at}.{key} must be an integer {low}-{high}")
        for key in ("allowAnonymous", "presenceVisible"):
            if key in rule and not isinstance(rule[key], bool):
                errors.append(f"{at}.{key} must be true or false")
    if len(set(prefixes)) != len(prefixes):
        errors.append("hrhub.json realtime.channels: prefixes must be unique")
    return errors


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
    icons = [name for name in ICON_FILES if any(rel == name for _, rel in files)]
    if not icons:
        warnings.append("no favicon.svg / favicon.png / favicon.ico at the root (the app switcher and browser tab show a generic icon)")
    elif icons[0] == "favicon.svg":
        svg = open(os.path.join(src, "favicon.svg"), encoding="utf-8", errors="ignore").read()
        if os.path.getsize(os.path.join(src, "favicon.svg")) > 10 * 1024:
            warnings.append("favicon.svg is larger than 10 KB; keep it a simple shape")
        if "viewBox" not in svg:
            warnings.append("favicon.svg has no viewBox (it will not scale to 16-32 px)")
        if re.search(r"<script|<foreignObject|(href|src)=['\"]https?://", svg, re.I):
            warnings.append("favicon.svg must not contain scripts, foreignObject or external references")

    if any(rel == "hrhub.json" for _, rel in files):
        errors += check_manifest(os.path.join(src, "hrhub.json"), {rel for _, rel in files})

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
            if not re.search(r"<title>\s*\S", text):
                warnings.append("index.html has no <title> (use the app name; HR Hub shows it in the browser tab)")
            if icons and not re.search(r"<link[^>]+rel=['\"](shortcut )?icon['\"]", text):
                warnings.append(f"index.html does not link {icons[0]} (<link rel=\"icon\" href=\"{icons[0]}\" />)")
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
