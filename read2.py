with open('frontend/src/pages/Nutrition.tsx', 'r') as f:
    for line in f.readlines():
        if 'confirm(' in line:
            print(line.strip())
