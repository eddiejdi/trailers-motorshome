#!/usr/bin/env python3
"""Patch a GLB: inject baseColorFactor/metal/rough from Blender Principled BSDF.

Blender 5.x glTF export sometimes omits pbrMetallicRoughness for untextured
materials → THREE defaults to white metal (blowout). Run after export_hb20_glb.py.
"""
import json
import re
import struct
import subprocess
import sys
from pathlib import Path


def get_blend_colors(blend_path: Path) -> dict:
    script = (
        "import bpy, json\n"
        "data={}\n"
        "for mat in bpy.data.materials:\n"
        "    if not mat.use_nodes:\n"
        "        data[mat.name]=None; continue\n"
        "    bsdf=mat.node_tree.nodes.get('Principled BSDF')\n"
        "    if not bsdf:\n"
        "        data[mat.name]=None; continue\n"
        "    bc=list(bsdf.inputs['Base Color'].default_value)\n"
        "    data[mat.name]={\n"
        "      'baseColorFactor': bc,\n"
        "      'metallicFactor': float(bsdf.inputs['Metallic'].default_value),\n"
        "      'roughnessFactor': float(bsdf.inputs['Roughness'].default_value),\n"
        "    }\n"
        "print('JSONSTART'+json.dumps(data)+'JSONEND')"
    )
    r = subprocess.run(
        ["flatpak", "run", "org.blender.Blender", "-b", str(blend_path), "--python-expr", script],
        capture_output=True,
        text=True,
        timeout=180,
    )
    m = re.search(r"JSONSTART(\{.*\})JSONEND", r.stdout)
    if not m:
        raise SystemExit(f"failed to read blend colors:\n{r.stdout[-2000:]}\n{r.stderr[-1000:]}")
    return json.loads(m.group(1))


def patch_glb(glb_path: Path, colors: dict) -> int:
    data = glb_path.read_bytes()
    if data[:4] != b"glTF":
        raise SystemExit("not a GLB")
    off = 12
    js = None
    bin_chunk = None
    while off + 8 <= len(data):
        clen, ctype = struct.unpack_from("<II", data, off)
        payload = data[off + 8 : off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(payload.rstrip(b"\x00"))
        elif ctype == 0x004E4942:
            bin_chunk = payload
        off += 8 + clen
    if js is None or bin_chunk is None:
        raise SystemExit("missing GLB chunks")

    patched = 0
    for mdef in js.get("materials", []):
        name = mdef.get("name", "")
        pbr = mdef.get("pbrMetallicRoughness")
        if pbr and "baseColorFactor" in pbr:
            continue
        info = colors.get(name)
        if not info:
            continue
        if pbr is None:
            mdef["pbrMetallicRoughness"] = {}
            pbr = mdef["pbrMetallicRoughness"]
        pbr["baseColorFactor"] = info["baseColorFactor"]
        pbr.setdefault("metallicFactor", info["metallicFactor"])
        pbr.setdefault("roughnessFactor", info["roughnessFactor"])
        if name and re.search(r"vidro|glass", name, re.I):
            if info["baseColorFactor"][3] < 0.99:
                mdef["alphaMode"] = "BLEND"
            elif "alphaMode" not in mdef:
                # exporter may drop blend; force windows transparent enough for PBR glass
                pbr["baseColorFactor"] = [
                    info["baseColorFactor"][0],
                    info["baseColorFactor"][1],
                    info["baseColorFactor"][2],
                    0.35,
                ]
                mdef["alphaMode"] = "BLEND"
        patched += 1

    def pad4(n: int) -> int:
        return (4 - (n % 4)) % 4

    js_bytes = json.dumps(js, separators=(",", ":")).encode("utf-8")
    js_padded = js_bytes + (b" " * pad4(len(js_bytes)))
    bin_padded = bin_chunk + (b"\x00" * pad4(len(bin_chunk)))
    total = 12 + 8 + len(js_padded) + 8 + len(bin_padded)
    out = bytearray()
    out += b"glTF"
    out += struct.pack("<II", 2, total)
    out += struct.pack("<II", len(js_padded), 0x4E4F534A)
    out += js_padded
    out += struct.pack("<II", len(bin_padded), 0x004E4942)
    out += bin_padded
    glb_path.write_bytes(out)
    return patched


def main() -> None:
    glb = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("assets/models/hb20.glb")
    blend = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("blend/cars/hb20.blend")
    colors = get_blend_colors(blend)
    n = patch_glb(glb, colors)
    print(f"patched {n} materials in {glb} ({glb.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
