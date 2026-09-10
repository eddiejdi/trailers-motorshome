#!/usr/bin/env python3
"""Generate a PDF with assembly view and puzzle layout for an open wooden box."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parents[1]
SHEET_W_MM = 2170
SHEET_H_MM = 1070
KERF_MM = 3


@dataclass
class Piece:
    name: str
    w: int
    h: int
    qty: int


def build_box_pieces(ext_h_mm: int, ext_l_mm: int, ext_d_mm: int, thickness_mm: int) -> list[Piece]:
    # Construction rule:
    # - Left/right walls full length
    # - Front/back between left/right
    # - Bottom inside all four walls
    left_right = Piece("Lateral", ext_l_mm, ext_h_mm, 2)
    front_back = Piece("Frente/Fundo", ext_d_mm - 2 * thickness_mm, ext_h_mm, 2)
    bottom = Piece("Fundo", ext_l_mm - 2 * thickness_mm, ext_d_mm - 2 * thickness_mm, 1)
    return [left_right, front_back, bottom]


def explode_pieces(pieces: list[Piece]) -> list[dict]:
    out = []
    for p in pieces:
        for i in range(p.qty):
            out.append({"name": p.name, "w": p.w, "h": p.h, "id": f"{p.name[:1]}{i+1}"})
    out.sort(key=lambda x: x["w"] * x["h"], reverse=True)
    return out


def pack_sheets(items: list[dict]) -> list[dict]:
    sheets = []

    def new_sheet():
        return {"placements": [], "free": [{"x": 0, "y": 0, "w": SHEET_W_MM, "h": SHEET_H_MM}]}

    def intersects(a, b):
        return not (a["x"] + a["w"] <= b["x"] or b["x"] + b["w"] <= a["x"] or a["y"] + a["h"] <= b["y"] or b["y"] + b["h"] <= a["y"])

    def split_rect(fr, used):
        if not intersects(fr, used):
            return [fr]
        out = []
        right_edge = used["x"] + used["w"] + KERF_MM
        bottom_edge = used["y"] + used["h"] + KERF_MM

        top_h = used["y"] - fr["y"]
        if top_h > 0:
            out.append({"x": fr["x"], "y": fr["y"], "w": fr["w"], "h": top_h})

        bottom_y = bottom_edge
        bottom_h = (fr["y"] + fr["h"]) - bottom_y
        if bottom_h > 0:
            out.append({"x": fr["x"], "y": bottom_y, "w": fr["w"], "h": bottom_h})

        left_w = used["x"] - fr["x"]
        mid_top = max(fr["y"], used["y"])
        mid_bottom = min(fr["y"] + fr["h"], bottom_edge)
        mid_h = mid_bottom - mid_top
        if left_w > 0 and mid_h > 0:
            out.append({"x": fr["x"], "y": mid_top, "w": left_w, "h": mid_h})

        right_x = right_edge
        right_w = (fr["x"] + fr["w"]) - right_x
        if right_w > 0 and mid_h > 0:
            out.append({"x": right_x, "y": mid_top, "w": right_w, "h": mid_h})
        return [r for r in out if r["w"] > 0 and r["h"] > 0]

    def prune(rects):
        out = []
        for i, a in enumerate(rects):
            contained = False
            for j, b in enumerate(rects):
                if i == j:
                    continue
                if a["x"] >= b["x"] and a["y"] >= b["y"] and a["x"] + a["w"] <= b["x"] + b["w"] and a["y"] + a["h"] <= b["y"] + b["h"]:
                    contained = True
                    break
            if not contained:
                out.append(a)
        return out

    for item in items:
        best = None
        for si, sheet in enumerate(sheets):
            for fri, fr in enumerate(sheet["free"]):
                for rotated in (False, True):
                    w = item["h"] if rotated else item["w"]
                    h = item["w"] if rotated else item["h"]
                    if w <= fr["w"] and h <= fr["h"]:
                        waste = fr["w"] * fr["h"] - w * h
                        score = waste
                        cand = {"sheet": si, "free": fri, "x": fr["x"], "y": fr["y"], "w": w, "h": h, "rot": rotated, "score": score}
                        if best is None or cand["score"] < best["score"]:
                            best = cand
        if best is None:
            sheets.append(new_sheet())
            si = len(sheets) - 1
            fr = sheets[si]["free"][0]
            if item["w"] <= fr["w"] and item["h"] <= fr["h"]:
                best = {"sheet": si, "free": 0, "x": 0, "y": 0, "w": item["w"], "h": item["h"], "rot": False, "score": 0}
            elif item["h"] <= fr["w"] and item["w"] <= fr["h"]:
                best = {"sheet": si, "free": 0, "x": 0, "y": 0, "w": item["h"], "h": item["w"], "rot": True, "score": 0}
            else:
                raise ValueError(f"Piece does not fit sheet: {item['name']} {item['w']}x{item['h']} mm")

        sheet = sheets[best["sheet"]]
        placed = {
            "name": item["name"],
            "id": item["id"],
            "x": best["x"],
            "y": best["y"],
            "w": best["w"],
            "h": best["h"],
            "rot": best["rot"],
        }
        sheet["placements"].append(placed)

        used = {"x": best["x"], "y": best["y"], "w": best["w"], "h": best["h"]}
        next_free = []
        for fr in sheet["free"]:
            next_free.extend(split_rect(fr, used))
        sheet["free"] = prune(next_free)

    return sheets


def mm_to_pt(mm: float) -> float:
    return mm * 72.0 / 25.4


def draw_poly(c: canvas.Canvas, points: list[tuple[float, float]], fill: int = 1, stroke: int = 1):
    path = c.beginPath()
    path.moveTo(points[0][0], points[0][1])
    for px, py in points[1:]:
        path.lineTo(px, py)
    path.close()
    c.drawPath(path, fill=fill, stroke=stroke)


def draw_assembly(c: canvas.Canvas, ext_h: int, ext_l: int, ext_d: int, t: int):
    w, h = landscape(A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(32, h - 36, "Caixa sem tampa - Montagem")
    c.setFont("Helvetica", 10)
    c.drawString(32, h - 54, f"Medidas externas: {ext_h} x {ext_l} x {ext_d} mm | Madeira: {t} mm")

    ox, oy = 110, 150
    scale = 0.22
    L = ext_l * scale
    D = ext_d * scale
    H = ext_h * scale
    dx, dy = 80, 48

    # Front face
    c.setStrokeColor(colors.HexColor("#1f2937"))
    c.setFillColor(colors.HexColor("#e5e7eb"))
    c.rect(ox, oy, L, H, fill=1, stroke=1)

    # Side face
    c.setFillColor(colors.HexColor("#d1d5db"))
    draw_poly(c, [(ox + L, oy), (ox + L + dx, oy + dy), (ox + L + dx, oy + H + dy), (ox + L, oy + H)], fill=1, stroke=1)

    # Bottom face (visible in perspective)
    c.setFillColor(colors.HexColor("#9ca3af"))
    draw_poly(c, [(ox, oy), (ox + dx, oy + dy), (ox + L + dx, oy + dy), (ox + L, oy)], fill=1, stroke=1)

    # Open top edges
    c.setLineWidth(2)
    c.line(ox, oy + H, ox + L, oy + H)
    c.line(ox + L, oy + H, ox + L + dx, oy + H + dy)
    c.line(ox, oy + H, ox + dx, oy + H + dy)

    c.setLineWidth(1)
    c.setFont("Helvetica", 9)
    c.drawString(32, 112, "Construcao usada:")
    c.drawString(32, 98, "- 2x laterais: 1200 x 500 mm")
    c.drawString(32, 84, "- 2x frente/fundo: 920 x 500 mm")
    c.drawString(32, 70, "- 1x fundo interno: 1170 x 920 mm")

    c.drawString(430, 112, "Observacao: frente/fundo entre laterais;")
    c.drawString(430, 98, "fundo montado por dentro das 4 paredes.")


def draw_puzzle(c: canvas.Canvas, sheets: list[dict], ext_h: int, ext_l: int, ext_d: int, t: int):
    page_w, page_h = landscape(A4)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(32, page_h - 36, "Puzzle de corte")
    c.setFont("Helvetica", 10)
    c.drawString(32, page_h - 54, f"Caixa {ext_h}x{ext_l}x{ext_d} mm | chapa util {SHEET_W_MM}x{SHEET_H_MM} | kerf {KERF_MM} mm")

    colors_cycle = [
        colors.HexColor("#dbeafe"),
        colors.HexColor("#dcfce7"),
        colors.HexColor("#fef3c7"),
        colors.HexColor("#fee2e2"),
        colors.HexColor("#ede9fe"),
        colors.HexColor("#cffafe"),
    ]

    y_cursor = page_h - 92
    usable_w = page_w - 64
    scale = min(usable_w / SHEET_W_MM, 170 / SHEET_H_MM)

    for si, sheet in enumerate(sheets):
        block_h = SHEET_H_MM * scale + 42
        if y_cursor - block_h < 28:
            c.showPage()
            c.setFont("Helvetica-Bold", 16)
            c.drawString(32, page_h - 36, "Puzzle de corte")
            c.setFont("Helvetica", 10)
            c.drawString(32, page_h - 54, f"Caixa {ext_h}x{ext_l}x{ext_d} mm | chapa util {SHEET_W_MM}x{SHEET_H_MM} | kerf {KERF_MM} mm")
            y_cursor = page_h - 92

        x0 = 32
        y0 = y_cursor - SHEET_H_MM * scale
        c.setStrokeColor(colors.HexColor("#374151"))
        c.rect(x0, y0, SHEET_W_MM * scale, SHEET_H_MM * scale, fill=0, stroke=1)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x0, y_cursor + 8, f"Chapa {si + 1}")

        for pi, pl in enumerate(sheet["placements"]):
            rx = x0 + pl["x"] * scale
            ry = y0 + pl["y"] * scale
            rw = pl["w"] * scale
            rh = pl["h"] * scale
            c.setFillColor(colors_cycle[pi % len(colors_cycle)])
            c.setStrokeColor(colors.HexColor("#4b5563"))
            c.rect(rx, ry, rw, rh, fill=1, stroke=1)
            c.setFillColor(colors.black)
            c.setFont("Helvetica", 7)
            label = f"{pl['id']} {pl['w']}x{pl['h']}"
            if rw > 58 and rh > 14:
                c.drawString(rx + 2, ry + rh - 10, label)

        y_cursor = y0 - 24


def generate_pdf(out_path: Path):
    ext_h, ext_l, ext_d = 500, 1200, 950
    thickness = 15
    pieces = build_box_pieces(ext_h, ext_l, ext_d, thickness)
    flat = explode_pieces(pieces)
    sheets = pack_sheets(flat)

    c = canvas.Canvas(str(out_path), pagesize=landscape(A4))
    draw_assembly(c, ext_h, ext_l, ext_d, thickness)
    c.showPage()
    draw_puzzle(c, sheets, ext_h, ext_l, ext_d, thickness)
    c.save()


if __name__ == "__main__":
    out = ROOT / "exports" / "caixa_sem_tampa_500x1200x950_15mm.pdf"
    out.parent.mkdir(parents=True, exist_ok=True)
    generate_pdf(out)
    print(out)
