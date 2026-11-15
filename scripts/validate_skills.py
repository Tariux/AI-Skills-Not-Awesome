#!/usr/bin/env python3
"""
Validate Agent Skills in this repository against the official specification.

Checks:
- Frontmatter compliance (name as slug, required fields, metadata map)
- Name matches directory name
- Description length and trigger keywords
- Body length recommendation (<500 lines)
- Relative references exist
- README catalog consistency

Usage: python3 scripts/validate_skills.py [--exclude DIR...] [--json]
"""

import os
import re
import sys
import json
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Set

SKILLS_ROOT = Path(__file__).parent.parent / "skills"
SPEC_NAME_RE = re.compile(r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
FRONTMATTER_RE = re.compile(r'^---\n(.*?)\n---', re.DOTALL)
MD_LINK_RE = re.compile(r'\[[^\]]+\]\(([^)]+)\)')
BACKTICK_PATH_RE = re.compile(r'`((?:references|scripts|examples|assets)/[^`]+)`')

ALLOWED_TOP_LEVEL = {'name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'}
REQUIRED_TOP_LEVEL = {'name', 'description'}
METADATA_RECOMMENDED = {'author', 'version', 'source', 'category', 'tags', 'output'}


def parse_frontmatter(content: str) -> Tuple[Dict, str]:
    """Extract and parse YAML frontmatter (simple parser for our constrained format)."""
    match = FRONTMATTER_RE.match(content)
    if not match:
        return {}, content
    fm_text = match.group(1)
    body = content[match.end():].lstrip('\n')

    result = {}
    metadata = {}
    in_metadata = False
    for line in fm_text.split('\n'):
        line = line.rstrip()
        if not line or line.startswith('#'):
            continue
        if line == 'metadata:':
            in_metadata = True
            continue
        if in_metadata:
            m = re.match(r'^\s{2}(\w+):\s*(.+)$', line)
            if m:
                key, val = m.groups()
                metadata[key] = val.strip().strip('"\'')
            else:
                in_metadata = False
        if not in_metadata:
            m = re.match(r'^(\w+):\s*(.+)$', line)
            if m:
                key, val = m.groups()
                result[key] = val.strip().strip('"\'')
    if metadata:
        result['metadata'] = metadata
    return result, body


def validate_skill(skill_dir: Path, exclude: Set[str]) -> List[str]:
    """Validate a single skill directory. Returns list of error messages."""
    errors = []
    skill_name = skill_dir.name

    if skill_name in exclude:
        return errors

    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        errors.append(f"{skill_name}: missing SKILL.md")
        return errors

    content = skill_md.read_text(encoding='utf-8')
    fm, body = parse_frontmatter(content)

    # Required top-level fields
    for field in REQUIRED_TOP_LEVEL:
        if field not in fm:
            errors.append(f"{skill_name}: missing required frontmatter field '{field}'")

    # Name validation
    name = fm.get('name', '')
    if name:
        if not SPEC_NAME_RE.match(name):
            errors.append(f"{skill_name}: name '{name}' must be lowercase alphanumeric + hyphens, no leading/trailing/consecutive hyphens")
        if name != skill_name:
            errors.append(f"{skill_name}: name '{name}' does not match directory name '{skill_name}'")

    # Description validation
    desc = fm.get('description', '')
    if desc:
        if len(desc) > 1024:
            errors.append(f"{skill_name}: description exceeds 1024 characters ({len(desc)})")
        if len(desc) < 20:
            errors.append(f"{skill_name}: description too short (<20 chars), should include trigger keywords")
        # Check for "Use when" or similar trigger phrase
        trigger_phrases = ['use when', 'when to use', 'use for', 'ideal for']
        if not any(phrase in desc.lower() for phrase in trigger_phrases):
            errors.append(f"{skill_name}: description should include trigger guidance (e.g., 'Use when...')")

    # License
    if 'license' not in fm:
        errors.append(f"{skill_name}: missing license field")

    # Unknown top-level fields
    for key in fm:
        if key not in ALLOWED_TOP_LEVEL:
            errors.append(f"{skill_name}: unknown top-level field '{key}' (move to metadata)")

    # Metadata validation
    metadata = fm.get('metadata', {})
    if not isinstance(metadata, dict):
        errors.append(f"{skill_name}: metadata must be a map")
    else:
        for key, val in metadata.items():
            if not isinstance(val, str):
                errors.append(f"{skill_name}: metadata.{key} must be a string")
        for rec in METADATA_RECOMMENDED:
            if rec not in metadata:
                errors.append(f"{skill_name}: recommended metadata field '{rec}' missing")

    # Body length
    body_lines = body.count('\n') + 1
    if body_lines > 500:
        errors.append(f"{skill_name}: body has {body_lines} lines (recommended <500)")

    # Relative references in markdown links
    for match in MD_LINK_RE.finditer(body):
        url = match.group(1)
        if not url.startswith(('http://', 'https://', '#', 'mailto:')):
            ref_path = (skill_dir / url).resolve()
            if not ref_path.exists():
                errors.append(f"{skill_name}: broken reference '{url}' (from markdown link)")

    # Backtick path references
    for match in BACKTICK_PATH_RE.finditer(body):
        rel = match.group(1)
        ref_path = (skill_dir / rel).resolve()
        if not ref_path.exists():
            errors.append(f"{skill_name}: broken reference '{rel}' (from backtick)")

    return errors


def validate_readme_catalog(exclude: Set[str]) -> List[str]:
    """Validate README.md catalog matches actual skills."""
    errors = []
    readme_path = SKILLS_ROOT.parent / "README.md"
    if not readme_path.exists():
        errors.append("README.md not found at repository root")
        return errors

    content = readme_path.read_text(encoding='utf-8')

    # Extract slugs from table
    slug_pattern = re.compile(r'\|\s*`([^`]+)`\s*\|')
    catalog_slugs = set(slug_pattern.findall(content))

    # Actual skill directories (excluding curly and excluded)
    actual_slugs = {d.name for d in SKILLS_ROOT.iterdir() if d.is_dir() and d.name not in exclude and d.name != 'curly'}

    missing_in_catalog = actual_slugs - catalog_slugs
    extra_in_catalog = catalog_slugs - actual_slugs

    for slug in sorted(missing_in_catalog):
        errors.append(f"README catalog missing skill: {slug}")

    for slug in sorted(extra_in_catalog):
        errors.append(f"README catalog has extra skill not in skills/: {slug}")

    # Check count claim
    count_match = re.search(r'Found (\d+) skills', content)
    if count_match:
        claimed = int(count_match.group(1))
        actual = len(actual_slugs)
        if claimed != actual:
            errors.append(f"README claims 'Found {claimed} skills' but {actual} skills exist (excluding curly)")

    return errors


def main():
    parser = argparse.ArgumentParser(description='Validate Agent Skills')
    parser.add_argument('--exclude', action='append', default=[], help='Skill directory to exclude')
    parser.add_argument('--json', action='store_true', help='Output JSON')
    args = parser.parse_args()

    exclude = set(args.exclude)
    all_errors = []

    # Validate each skill
    for skill_dir in sorted(SKILLS_ROOT.iterdir()):
        if skill_dir.is_dir():
            all_errors.extend(validate_skill(skill_dir, exclude))

    # Validate README catalog
    all_errors.extend(validate_readme_catalog(exclude))

    if args.json:
        print(json.dumps({'errors': all_errors, 'count': len(all_errors)}, indent=2))
    else:
        if all_errors:
            print(f"VALIDATION FAILED ({len(all_errors)} errors):")
            for err in all_errors:
                print(f"  - {err}")
            sys.exit(1)
        else:
            print("VALIDATION PASSED: All skills comply with specification.")


if __name__ == '__main__':
    main()