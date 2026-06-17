import sys
with open('frontend/src/pages/Nutrition.tsx', 'r') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        if 'savedMeals.map' in line:
            print(''.join(lines[i:i+30]))
