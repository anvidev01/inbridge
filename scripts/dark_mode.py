import os
import glob

replacements = {
    # Backgrounds
    "bg-white": "bg-[#0a0a0a]",
    "bg-[#F8FAFC]": "bg-[#171717]",
    "bg-[#E2E8F0]": "bg-neutral-800",
    "hover:bg-[#CBD5E1]": "hover:bg-neutral-700",
    "bg-[#334155]": "bg-[#ededed]",
    "hover:bg-[#1e293b]": "hover:bg-white",
    
    # Borders
    "border-gray-200": "border-neutral-800",
    "border-gray-100": "border-neutral-800",
    "border-gray-300": "border-neutral-700",
    
    # Text
    "text-gray-900": "text-neutral-100",
    "text-gray-800": "text-neutral-200",
    "text-gray-700": "text-neutral-300",
    "text-gray-600": "text-neutral-400",
    "text-gray-500": "text-neutral-500",
    "text-gray-400": "text-[#737373]",
    "text-slate-700": "text-neutral-200",
    
    # Element specific backgrounds
    "bg-gray-50": "bg-[#171717]",
    "hover:bg-gray-50": "hover:bg-neutral-800",
    "bg-gray-100": "bg-neutral-800",
    "hover:bg-gray-100": "hover:bg-neutral-700",
    "bg-gray-200": "bg-neutral-800",
    "hover:bg-gray-200": "hover:bg-neutral-700",
    
    # Hardcoded black/white elements
    "bg-black": "bg-white",
    "text-white": "__TEMP_TEXT_BLACK__",
    "text-black": "text-white",
    "__TEMP_TEXT_BLACK__": "text-black",
}

css_replacements = {
    "--color-bg: #F5F5F5;": "--color-bg: #0a0a0a;",
    "color: #111111;": "color: #ededed;",
}

files = glob.glob("src/components/chat/*.tsx") 
for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    for old, new in replacements.items():
        content = content.replace(old, new)
        
    with open(filepath, 'w') as f:
        f.write(content)

# Apply CSS replacements specifically
css_path = "src/app/globals.css"
if os.path.exists(css_path):
    with open(css_path, 'r') as f:
        content = f.read()
    for old, new in css_replacements.items():
        content = content.replace(old, new)
    # Also apply the background replacements to globals.css just in case
    for old, new in replacements.items():
        content = content.replace(old, new)
    with open(css_path, 'w') as f:
        f.write(content)

print("Dark mode replacements complete!")
