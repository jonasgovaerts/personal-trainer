import sys
with open('frontend/src/pages/Meals.tsx', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'deleteMeal' in line:
            print(f"{i}: {line.strip()}")
