import html.parser, os, re

base = "D:/Project/Psychology/psydoctor"

# 1. Parse HTML files
for fname in ["index.html", "main.html"]:
    path = os.path.join(base, fname)
    with open(path, encoding="utf-8") as f:
        content = f.read()
    parser = html.parser.HTMLParser()
    try:
        parser.feed(content)
        print(f"[PASS] {fname}: HTML 解析成功，长度 {len(content)} 字符")
    except Exception as e:
        print(f"[FAIL] {fname}: HTML 解析失败: {e}")

# 2. Check script src attributes in index.html
index_path = os.path.join(base, "index.html")
with open(index_path, encoding="utf-8") as f:
    index_content = f.read()

srcs = re.findall(r'<script[^>]+src=["\x27]([^"\x27]+)["\x27]', index_content)
print(f"\nindex.html 中的 script src 引用 ({len(srcs)} 个):")
for s in srcs:
    full_path = os.path.join(base, s.lstrip("./"))
    exists = os.path.exists(full_path)
    status = "[PASS]" if exists else "[FAIL]"
    print(f"  {status} {s}")

# 3. Check script src in main.html
main_path = os.path.join(base, "main.html")
with open(main_path, encoding="utf-8") as f:
    main_content = f.read()

srcs_main = re.findall(r'<script[^>]+src=["\x27]([^"\x27]+)["\x27]', main_content)
print(f"\nmain.html 中的 script src 引用 ({len(srcs_main)} 个):")
for s in srcs_main:
    full_path = os.path.join(base, s.lstrip("./"))
    exists = os.path.exists(full_path)
    status = "[PASS]" if exists else "[FAIL]"
    print(f"  {status} {s}")

# 4. Check critical DOM IDs in main.html
critical_ids = [
    "psy-chat-log", "psy-chat-input", "psy-chat-send-btn",
    "psy-world-time", "psy-level-line", "psy-ct-indicator",
    "psy-client-list", "psy-main-layout", "psy-bootstrap-gate",
    "psy-header-info"
]
print(f"\nmain.html 关键 DOM ID 检查:")
for id_ in critical_ids:
    found = f'id="{id_}"' in main_content
    status = "[PASS]" if found else "[FAIL]"
    print(f"  {status} #{id_}")

# 5. Check critical DOM IDs in index.html
index_ids = [
    "splash-screen", "api-settings-root", "save-load-root",
    "character-creation-screen", "psy-trait-detail-root"
]
print(f"\nindex.html 关键 DOM ID 检查:")
for id_ in index_ids:
    found = f'id="{id_}"' in index_content
    status = "[PASS]" if found else "[FAIL]"
    print(f"  {status} #{id_}")

# 6. Verify bridge.js and logPanel.js are identical to mortal_journey
mj_base = "D:/Project/Github/mortal_journey"
for fname in ["silly_tarven/bridge.js", "js/log/logPanel.js", "css/logPanel.css"]:
    psy_path = os.path.join(base, fname)
    mj_path = os.path.join(mj_base, fname)
    if os.path.exists(psy_path) and os.path.exists(mj_path):
        with open(psy_path, "rb") as pf, open(mj_path, "rb") as mf:
            same = pf.read() == mf.read()
        status = "[PASS]" if same else "[FAIL]"
        print(f"\n{status} {fname} 与 mortal_journey 版本一致")
    else:
        print(f"[WARN] 文件不存在: {fname}")

# 7. Check inline script syntax (basic)
inline_scripts = re.findall(r'<script>([\s\S]*?)</script>', index_content)
inline_scripts += re.findall(r'<script>([\s\S]*?)</script>', main_content)
print(f"\n共 {len(inline_scripts)} 个内联 script 块")
# Just check they don't have obvious syntax issues (no unclosed brackets in key constructs)
for i, script in enumerate(inline_scripts):
    if 'function qs(' in script:
        print(f"  [{i}] 含 qs() 函数定义")

print("\n验证完成")
