import os
import re

root_dir = "/Users/anvisingh/Documents/InfoSetu2/infosetu-chatbot"

exclude_dirs = {"node_modules", ".next", ".git", ".github", ".vercel", "venv", "__pycache__", "vector_store"}
exclude_exts = {".png", ".jpg", ".jpeg", ".pdf", ".ico", ".woff2", ".tsbuildinfo", ".pyc", ".pack", ".idx"}

replacements = [
    (re.compile(r'InfoSetu'), 'InBridge'),
    (re.compile(r'Infosetu'), 'InBridge'),
    (re.compile(r'INFOSETU'), 'INBRIDGE'),
    (re.compile(r'infosetu'), 'inbridge'),
    (re.compile(r'इन्फोसेतु'), 'InBridge'),
]

for dirpath, dirnames, filenames in os.walk(root_dir):
    # filter in-place to avoid parsing excluded directories
    dirnames[:] = [d for d in dirnames if d not in exclude_dirs]
    for filename in filenames:
        ext = os.path.splitext(filename)[1].lower()
        if ext in exclude_exts:
            continue
        if filename == "rename_project.py":
            continue
            
        filepath = os.path.join(dirpath, filename)
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            continue # skip binary/non-UTF-8 files
            
        new_content = content
        for pattern, replacement in replacements:
            new_content = pattern.sub(replacement, new_content)
            
        if new_content != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {filepath}")
