"""Add a progress index page to SMALLWORLD_EVENTS.xlsx.

The index is built from counts that already exist in the workbook — nothing is
estimated and no percentage is invented:

  * a page that counts "done" against a "total" gets a real bar;
  * a page that only lists outstanding work (gap lists, cleanup lists, the folder
    move plan) is shown at 0% with that stated, because the workbook records no
    row as fixed yet. A bare 0 can therefore never be read as "unknown";
  * pages with no completion measure at all are listed as reference, with no bar.

Usage:
    python add_progress_index.py [workbook.xlsx]

Re-runnable: it replaces the index sheet if it is already there and leaves every
other sheet untouched. A backup is written to .freebuff/ before saving.
"""

from __future__ import annotations

import datetime as dt
import os
import re
import shutil
import sys

from openpyxl import load_workbook
from openpyxl.formatting.rule import DataBarRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo

INDEX_SHEET = "0 Progress Index"

NAVY = "1F3864"
HEADER_FILL = PatternFill("solid", fgColor=NAVY)
SECTION_FILL = PatternFill("solid", fgColor="E8EDF7")
HEADER_FONT = Font(bold=True, color="FFFFFF", size=11)
TITLE_FONT = Font(bold=True, size=15, color=NAVY)
SUBTITLE_FONT = Font(italic=True, color="555555", size=10)
NOTE_FONT = Font(italic=True, color="777777", size=9)
STATUS_COLORS = {
    "Complete": "1E7B34",
    "Mostly done": "1F4E9C",
    "In progress": "B45309",
    "Not started": "8A8A8A",
}
STATUS_NOTES = {
    "Complete": "",
    "Mostly done": "",
    "In progress": "",
    "Not started": "nothing marked fixed yet",
}


def _rows(ws, first_row=1, max_rows=None):
    """Yield (row_number, values) for the used range of a sheet."""
    last = ws.max_row if max_rows is None else min(ws.max_row, first_row + max_rows - 1)
    for index, row in enumerate(ws.iter_rows(min_row=first_row, max_row=last, values_only=True), start=first_row):
        yield index, row


def _num(value) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        return 0.0


def _text(value) -> str:
    return "" if value is None else str(value).strip()


def _find_header(ws, required, scan_rows=8):
    """Row number of the header row whose cells EQUAL the given labels.

    Exact matching matters: the sentence above each table names the columns in
    passing ("146 files in 43 folders…"), and counting from there added the
    header row itself to the totals. Only if no exact header exists does a
    substring match on short cells get a look.
    """
    for row_number, row in _rows(ws, 1, scan_rows):
        labels = [_text(cell).lower() for cell in row]
        if all(token in labels for token in required):
            return row_number
    for row_number, row in _rows(ws, 1, scan_rows):
        labels = [_text(cell).lower() for cell in row if len(_text(cell)) <= 30]
        if all(any(token in label for label in labels) for token in required):
            return row_number
    return None


def collect(wb) -> dict:
    """Every figure the index shows, read from the workbook's own cells."""
    figures: dict = {}

    # 1 Inventory Check — "TOTAL (7 folders)" row: files on disk / in index.
    ws = wb["1 Inventory Check"]
    disk = index = None
    scan_note = ""
    for _, row in _rows(ws):
        first = _text(row[0]) if row else ""
        if first.upper().startswith("TOTAL"):
            disk, index = _num(row[1]), _num(row[2])
        match = re.search(r"live scan (\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}))?", first)
        if match:
            scan_note = match.group(1)
    figures["files_total"] = int(disk or index or 0)
    figures["files_verified"] = int(min(disk or 0, index or 0))
    figures["scan_date"] = scan_note

    # 3 Event Summary — one row per event, Status in the "Status" column.
    ws = wb["3 Event Summary"]
    header = _find_header(ws, ["event", "status"]) or 1
    headers = [_text(c).lower() for c in next(ws.iter_rows(min_row=header, max_row=header, values_only=True))]
    status_col = headers.index("status")
    events = ok_events = 0
    for _, row in _rows(ws, header + 1):
        if not _text(row[0]):
            continue
        events += 1
        if _text(row[status_col]).lower() == "ok":
            ok_events += 1
    figures["events"] = events
    figures["events_ok"] = ok_events

    # 4 Missing Info — one row per outstanding gap.
    ws = wb["4 Missing Info"]
    header = _find_header(ws, ["severity", "event"]) or 1
    figures["gaps_open"] = sum(
        1 for _, row in _rows(ws, header + 1) if _text(row[0]).lower() in {"high", "medium", "low"}
    )

    # 5 Unclassified Files — one row per file no rule recognised.
    ws = wb["5 Unclassified Files"]
    header = _find_header(ws, ["folder", "file"]) or 1
    figures["files_unclassified"] = sum(1 for _, row in _rows(ws, header + 1) if _text(row[0]))

    # 6 No Date / 7 Camera Filenames — first numeric column is the problem count.
    ws = wb["6 No Date"]
    header = _find_header(ws, ["folder", "undated files"]) or 1
    figures["files_undated"] = int(sum(_num(row[1]) for _, row in _rows(ws, header + 1)))

    ws = wb["7 Camera Filenames"]
    header = _find_header(ws, ["folder", "camera-named"]) or 1
    figures["files_camera_named"] = int(sum(_num(row[1]) for _, row in _rows(ws, header + 1)))

    # 8 Unsorted Photos — photo folders with no event label.
    ws = wb["8 Unsorted Photos"]
    header = _find_header(ws, ["folder", "files"]) or 1
    unsorted_rows = [row for _, row in _rows(ws, header + 1) if _text(row[0])]
    figures["unsorted_folders"] = len(unsorted_rows)
    figures["files_unsorted"] = int(sum(_num(row[1]) for row in unsorted_rows))

    # 9 Media Only Events — events with media but no paperwork (one row per folder).
    ws = wb["9 Media Only Events"]
    header = _find_header(ws, ["event", "folder"]) or 1
    figures["events_media_only"] = len({_text(row[0]) for _, row in _rows(ws, header + 1) if _text(row[0])})

    # 10 Housekeeping — one row per item to fix.
    ws = wb["10 Housekeeping"]
    header = _find_header(ws, ["issue", "folder"]) or 1
    figures["cleanup_items"] = sum(1 for _, row in _rows(ws, header + 1) if _text(row[0]))

    # 12 Folder Map — folders that exist now vs the proposed folders.
    ws = wb["12 Folder Map"]
    header = _find_header(ws, ["current folder", "proposed folder"]) or 1
    map_rows = [row for _, row in _rows(ws, header + 1) if _text(row[0])]
    figures["folders_now"] = len({_text(row[0]) for row in map_rows})
    figures["folders_target"] = len({_text(row[6]) for row in map_rows if _text(row[6])})

    return figures


def build_index(wb, figures: dict) -> None:
    if INDEX_SHEET in wb.sheetnames:
        del wb[INDEX_SHEET]
    ws = wb.create_sheet(INDEX_SHEET, 0)

    files = figures["files_total"]
    events = figures["events"]

    # (page, what it tracks, done, total)
    measured = [
        ("1 Inventory Check", "Index matches disk", figures["files_verified"], files),
        ("5 Unclassified Files", "Files sorted into an event", files - figures["files_unclassified"], files),
        ("6 No Date", "Files carrying a year", files - figures["files_undated"], files),
        ("7 Camera Filenames", "Files named for their content", files - figures["files_camera_named"], files),
        ("9 Media Only Events", "Events with paperwork", events - figures["events_media_only"], events),
        ("3 Event Summary", "Events with no gaps left", figures["events_ok"], events),
        ("4 Missing Info", "Gap rows closed", 0, figures["gaps_open"]),
        ("8 Unsorted Photos", "Photo folders given a label", 0, figures["unsorted_folders"]),
        ("10 Housekeeping", "Cleanup items fixed", 0, figures["cleanup_items"]),
        ("12 Folder Map", "Folders moved", 0, figures["folders_now"]),
    ]

    reference = [
        ("2 Events by Year", "Files per event per year"),
        ("11 Event Contents", "What each event holds, and where"),
        ("13 Target Structure", f"The {figures['folders_target']} folders the archive moves into"),
        ("14 Files by Event", f"One row per file ({files:,})"),
        ("15 Classification Rules", "The pattern that sorted each path"),
    ]

    ws["A1"] = "Archive progress"
    ws["A1"].font = TITLE_FONT
    ws["A2"] = (
        f"{len(measured)} pages measured · {len(reference)} reference pages · "
        f"{files:,} files · {events} events · {figures['folders_now']:,} folders → {figures['folders_target']}"
    )
    ws["A2"].font = SUBTITLE_FONT
    ws["A3"] = (
        f"Every count is read from this workbook. Index vs disk: live scan {figures['scan_date']}."
        if figures["scan_date"]
        else "Every count is read from this workbook."
    )
    ws["A3"].font = NOTE_FONT
    ws.merge_cells("A2:F2")
    ws.merge_cells("A3:F3")

    header_row = 5
    headings = ["#", "Page (sheet)", "What the page tracks", "Done / Total", "Progress", "Status"]
    for column, heading in enumerate(headings, start=1):
        cell = ws.cell(row=header_row, column=column, value=heading)
        # The Excel table style paints the header; only the type is set here so
        # the two don't fight over the fill.
        cell.font = HEADER_FONT
        cell.alignment = Alignment(vertical="center")

    first_data = header_row + 1
    for offset, (page, tracks, done, total) in enumerate(measured):
        row = first_data + offset
        share = (done / total) if total else 0.0
        if share >= 0.999:
            status = "Complete"
        elif share >= 0.7:
            status = "Mostly done"
        elif share > 0:
            status = "In progress"
        else:
            status = "Not started"
        values = [offset + 1, page, tracks, f"{done:,} / {total:,}", share, status]
        for column, value in enumerate(values, start=1):
            cell = ws.cell(row=row, column=column, value=value)
            cell.alignment = Alignment(vertical="center")
            if column == 1:
                cell.font = Font(color="888888")
                cell.alignment = Alignment(horizontal="right", vertical="center")
            if column == 4:
                cell.alignment = Alignment(horizontal="right", vertical="center")
            if column == 5:
                cell.number_format = "0.0%"
                cell.alignment = Alignment(horizontal="right", vertical="center")
                cell.font = Font(bold=True, color=NAVY)
            if column == 6:
                cell.font = Font(color=STATUS_COLORS[status])
                cell.alignment = Alignment(horizontal="right", vertical="center")

    last_data = first_data + len(measured) - 1
    # Real Excel data bars over the progress column, so the bars survive sorting
    # and read as a bar rather than a stack of block characters.
    ws.conditional_formatting.add(
        f"E{first_data}:E{last_data}",
        DataBarRule(start_type="num", start_value=0, end_type="num", end_value=1, color="5B8DEF", showValue=True),
    )

    # A real Excel table: banded rows, a styled header and sort arrows, so the
    # page looks like a designed report and stays sortable/filterable.
    table = Table(displayName="ArchiveProgress", ref=f"A{header_row}:F{last_data}")
    table.tableStyleInfo = TableStyleInfo(
        name="TableStyleMedium2",
        showFirstColumn=False,
        showLastColumn=False,
        showRowStripes=True,
        showColumnStripes=False,
    )
    ws.add_table(table)

    ref_title = last_data + 2
    title_cell = ws.cell(row=ref_title, column=1, value="Reference pages — nothing on them counts as done or open")
    title_cell.font = Font(bold=True, color=NAVY, size=10)
    for column in range(1, 7):
        ws.cell(row=ref_title, column=column).fill = SECTION_FILL

    for offset, (page, what) in enumerate(reference):
        row = ref_title + 1 + offset
        ws.cell(row=row, column=2, value=page).font = Font(color="555555")
        ws.cell(row=row, column=3, value=what).font = Font(color="555555")

    note_row = ref_title + len(reference) + 2
    notes = [
        "0% is literal: the page lists open work, but no row in the workbook is marked fixed yet.",
        "Bars cover the Progress column only. Regenerate after the archive changes: python add_progress_index.py",
    ]
    for offset, note in enumerate(notes):
        ws.cell(row=note_row + offset, column=1, value=note).font = NOTE_FONT

    widths = {"A": 4, "B": 25, "C": 33, "D": 17, "E": 12, "F": 13}
    for column, width in widths.items():
        ws.column_dimensions[column].width = width
    ws.row_dimensions[header_row].height = 22
    for offset in range(len(measured)):
        ws.row_dimensions[first_data + offset].height = 18
    ws.freeze_panes = f"A{first_data}"
    ws.sheet_view.showGridLines = False
    ws.sheet_properties.tabColor = NAVY


def main() -> int:
    target = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "SMALLWORLD_EVENTS.xlsx")
    if not os.path.exists(target):
        print(f"No such workbook: {target}")
        return 1

    backup_dir = os.path.join(os.path.dirname(target), ".freebuff")
    os.makedirs(backup_dir, exist_ok=True)
    backup = os.path.join(backup_dir, f"SMALLWORLD_EVENTS.backup-{dt.datetime.now():%Y%m%d-%H%M%S}.xlsx")
    shutil.copy2(target, backup)
    print(f"Backup: {backup}")

    wb = load_workbook(target)
    figures = collect(wb)
    print("Figures read from the workbook:")
    for key, value in figures.items():
        print(f"  {key}: {value}")

    build_index(wb, figures)

    temp = target + ".tmp.xlsx"
    wb.save(temp)
    os.replace(temp, target)
    print(f"Wrote {INDEX_SHEET!r} as the first page of {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
