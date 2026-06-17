import sys
with open('frontend/src/pages/Nutrition.tsx', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'setStagedItems([])' in line:
            print(''.join(lines[i-15:i+15]))
