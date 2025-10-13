#!/usr/bin/env python3
"""
Script to complete state bills integration by updating all billSource checks in Legislation.jsx
"""

import re

def update_legislation_jsx():
    """Update all billSource checks to include 'state'"""

    file_path = "frontend/src/components/Legislation.jsx"

    with open(file_path, 'r') as f:
        content = f.read()

    # Pattern 1: billSource === 'recommended' || billSource === 'link'
    # Replace with: billSource === 'recommended' || billSource === 'link' || billSource === 'state'
    pattern1 = r"billSource === 'recommended' \|\| billSource === 'link'(?! \|\| billSource === 'state')"
    replacement1 = "billSource === 'recommended' || billSource === 'link' || billSource === 'state'"

    matches1 = list(re.finditer(pattern1, content))
    print(f"Found {len(matches1)} instances to update:")

    for i, match in enumerate(matches1, 1):
        # Get line number
        line_num = content[:match.start()].count('\n') + 1
        # Get surrounding context
        start = max(0, match.start() - 50)
        end = min(len(content), match.end() + 50)
        context = content[start:end]
        print(f"\n{i}. Line {line_num}:")
        print(f"   Context: ...{context}...")

    # Apply replacements
    updated_content = re.sub(pattern1, replacement1, content)

    # Pattern 2: (billSource === 'recommended')  - single check (be careful not to break existing logic)
    # We'll skip these for safety - they may be intentionally checking only 'recommended'

    # Count changes
    changes_made = len(matches1)

    if changes_made > 0:
        print(f"\n{'='*80}")
        print(f"TOTAL CHANGES: {changes_made}")
        print(f"{'='*80}")

        # Write updated content
        with open(file_path, 'w') as f:
            f.write(updated_content)

        print(f"\n✅ Successfully updated {file_path}")
        print(f"   {changes_made} billSource checks now include 'state'")
    else:
        print("\n✅ No changes needed - all checks already include 'state'")

if __name__ == "__main__":
    print("State Bills Integration - Completing billSource checks")
    print("=" * 80)
    update_legislation_jsx()
    print("\n" + "=" * 80)
    print("Integration complete! Next steps:")
    print("1. Review the changes in Legislation.jsx")
    print("2. Add LEGISCAN_API_KEY to your .env file")
    print("3. Restart the backend server")
    print("4. Test the state bills functionality")
    print("=" * 80)
