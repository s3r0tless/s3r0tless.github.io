import os
import re
import sys
import json
from bs4 import BeautifulSoup, NavigableString
from datetime import datetime, timezone, timedelta

NUM_RE = re.compile(r'[-+]?\d{1,3}(?:,\d{3})*(?:\.\d+)?|[-+]?\d+(?:\.\d+)?')
TARGET_DIV_CLASSES = {"w-full", "h-full", "flex", "justify-center", "items-center"}
CDN_AVATARS_PREFIX = r"https://cdn\.discordapp\.com/avatars/"
DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"
kst = timezone(timedelta(hours=9))

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
    """
    파일 단위로 처리해서 합계, avatar url 외에
    span.mr-4 텍스트들, span.capitalize 텍스트들을 반환합니다.
    """
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

    mr4_texts = []
    for sp in soup.find_all("span", class_="mr-4"):
        txt = sp.get_text(strip=True)
        if txt:
            mr4_texts.append(txt)

    cap_texts = []
    for sp in soup.find_all("span", class_="capitalize"):
        txt = sp.get_text(strip=True)
        if txt:
            cap_texts.append(txt)

    return total, avatar_url, mr4_texts, cap_texts

def main():
    start_dir = "."
    out_json = "players_sum.json"
    download_info_json = "download_info.json"
    if len(sys.argv) >= 2:
        start_dir = sys.argv[1]
    if len(sys.argv) >= 3:
        out_json = sys.argv[2]
    if len(sys.argv) >= 4:
        download_info_json = sys.argv[3]
    exec_time_str = datetime.now(kst).strftime('%Y-%m-%d %H:%M:%S')

    files = find_html_files(start_dir)
    players = {}

    if not files:
        print(f"경고: .html/.htm 파일을 찾지 못했습니다: {start_dir}")
        with open(out_json, "w", encoding="utf-8") as fh:
            json.dump([], fh, ensure_ascii=False, indent=2)
        with open(download_info_json, "w", encoding="utf-8") as fh:
            json.dump(exec_time_str, fh, ensure_ascii=False)
        print(f"빈 결과를 '{out_json}'에, 실행 시각을 '{download_info_json}'에 저장했습니다. 시각(UTC): {exec_time_str}")
        return

    for fpath in sorted(files):
        file_sum, avatar, mr4_texts, cap_texts = process_file_sum_and_avatar(fpath)
        basename = os.path.splitext(os.path.basename(fpath))[0]
        nick = extract_nickname_from_filename(basename)
        if nick not in players:
            players[nick] = {
                "sum": 0.0,
                "img_src": "",
                "_mr4_set": set(),
                "_cap_set": set()
            }
        players[nick]["sum"] += file_sum
        if not players[nick]["img_src"] and avatar:
            players[nick]["img_src"] = avatar
        for t in mr4_texts:
            players[nick]["_mr4_set"].add(t)
        for t in cap_texts:
            players[nick]["_cap_set"].add(t)

    out_list = []
    for nick in sorted(players.keys(), key=lambda x: x.lower()):
        val = players[nick]["sum"]
        if abs(val - int(val)) < 1e-12:
            val = int(val)
        img = players[nick]["img_src"] or DEFAULT_AVATAR
        mr4_list = sorted(players[nick].get("_mr4_set", []))
        cap_list = sorted(players[nick].get("_cap_set", []))
        if not cap_list:
            cap_list = ["unranked"]
        out_list.append({
            "nickname": nick,
            "sum": val,
            "img_src": img,
            "mr_4": mr4_list,
            "capitalize": cap_list
        })

    try:
        with open(out_json, "w", encoding="utf-8") as fh:
            json.dump(out_list, fh, ensure_ascii=False, indent=2)
        with open(download_info_json, "w", encoding="utf-8") as fh:
            json.dump(exec_time_str, fh, ensure_ascii=False)
        print(f"완료: '{out_json}'와 실행 시각을 '{download_info_json}'에 저장했습니다. 시각(UTC): {exec_time_str}")
    except Exception as e:
        print(f"오류: 결과를 저장하지 못했습니다: {e}")

if __name__ == "__main__":
    main()
