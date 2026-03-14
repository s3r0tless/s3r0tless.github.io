import os
import re
import sys
import json
from collections import defaultdict
from bs4 import BeautifulSoup, NavigableString

NUM_RE = re.compile(r'[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-+]?\d+(?:\.\d+)?')
TARGET_DIV_CLASSES = {"w-full", "h-full", "flex", "justify-center", "items-center"}
CDN_AVATARS_PREFIX = r"https://cdn\.discordapp\.com/avatars/"
DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"

def extract_numbers_from_text(text):
    if not text:
        return []
    found = NUM_RE.findall(text)
    nums = []
    for s in found:
        s_clean = s.replace(',', '')
        try:
            nums.append(float(s_clean))
        except:
            continue
    return nums

def find_html_files(start_dir="."):
    matches = []
    EXCLUDE_NAMES = {"index.html", "index.htm"}
    for root, dirs, files in os.walk(start_dir):
        for fname in files:
            lname = fname.lower()
            if not lname.endswith((".html", ".htm")):
                continue
            if lname in EXCLUDE_NAMES:
                continue
            matches.append(os.path.join(root, fname))
    return matches

def extract_nickname_from_filename(fname):
    parts = re.split(r'\s+_\s+', fname, maxsplit=1)
    if len(parts) > 1:
        nick = parts[0].strip()
        return nick if nick else fname
    return fname

AVATAR_URL_RE = re.compile(CDN_AVATARS_PREFIX + r'[^"\'\s<>)]*')

def process_file_sum_and_avatar(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            html = fh.read()
    except Exception:
        with open(path, "r", encoding="latin-1") as fh:
            html = fh.read()

    soup = BeautifulSoup(html, "html.parser")
    total = 0.0
    for d in soup.find_all("div"):
        classes = set(d.get("class") or [])
        if TARGET_DIV_CLASSES.issubset(classes):
            for child in d.contents:
                if isinstance(child, NavigableString):
                    text = str(child).strip()
                    if not text:
                        continue
                    nums = extract_numbers_from_text(text)
                    if nums:
                        total += sum(nums)

    m = AVATAR_URL_RE.search(html)
    avatar_url = m.group(0) if m else ""
    return total, avatar_url

def main():
    start_dir = "."
    out_json = "players_sum.json"
    if len(sys.argv) >= 2:
        start_dir = sys.argv[1]
    if len(sys.argv) >= 3:
        out_json = sys.argv[2]

    files = find_html_files(start_dir)
    players = {}

    if not files:
        print(f"경고: .html/.htm 파일을 찾지 못했습니다: {start_dir}")
        with open(out_json, "w", encoding="utf-8") as fh:
            json.dump([], fh, ensure_ascii=False, indent=2)
        print(f"빈 결과를 '{out_json}'에 저장했습니다.")
        return

    for fpath in sorted(files):
        file_sum, avatar = process_file_sum_and_avatar(fpath)
        basename = os.path.splitext(os.path.basename(fpath))[0]
        nick = extract_nickname_from_filename(basename)
        if nick not in players:
            players[nick] = {"sum": 0.0, "img_src": ""}
        players[nick]["sum"] += file_sum
        if not players[nick]["img_src"] and avatar:
            players[nick]["img_src"] = avatar

    out_list = []
    for nick in sorted(players.keys(), key=lambda x: x.lower()):
        val = players[nick]["sum"]
        if abs(val - int(val)) < 1e-12:
            val = int(val)
        img = players[nick]["img_src"] or DEFAULT_AVATAR
        out_list.append({
            "nickname": nick,
            "sum": val,
            "img_src": img
        })

    try:
        with open(out_json, "w", encoding="utf-8") as fh:
            json.dump(out_list, fh, ensure_ascii=False, indent=2)
        print(f"완료: 닉네임별 합계와 Discord avatar URL을 '{out_json}'에 저장했습니다. 항목 수: {len(out_list)}")
    except Exception as e:
        print(f"오류: 결과를 저장하지 못했습니다: {e}")

if __name__ == "__main__":
    main()