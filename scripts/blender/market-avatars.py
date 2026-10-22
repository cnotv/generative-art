"""Builds the six market sector avatars for the homepage as one GLB: a bank, a telecom mast, a
stack of publications, the scales of governance, a defence shield and a town hall, in the skills
city's pastel palette.

Each avatar is one object named avatar-<key>, with its origin at the middle of its base so the
page can turn it in place. The keys match the `avatar` field of PRODUCT_SECTORS in config.ts.

Run from the repository root (see documentation/docs/guides/rebuilding-the-skills-city.md):
    blender -b --factory-startup --python scripts/blender/market-avatars.py -- public/market-avatars.glb /tmp/market-avatars.png
"""
import math
import os
import sys

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from primitives import (
    box,
    cylinder,
    cone,
    ball,
    mesh_object,
    prism,
    empty,
    WALL,
    WALL_DARK,
    ROOF,
    GLASS,
    SIGNAL,
)

ROSE = ("accent-rose", "#e8a8b8")
CREAM = ("accent-cream", "#f2d49b")
MINT = ("accent-mint", "#9fd9c3")
PERIWINKLE = ("accent-periwinkle", "#8fa8e8")
INK = ("ink", "#5d6f92")
SPACING = 4.0


def build_bank(root):
    box("bank-plinth", (1.9, 1.3, 0.14), (0, 0, 0), WALL_DARK, root)
    box("bank-step", (1.7, 1.1, 0.1), (0, 0, 0.14), WALL, root)
    box("bank-hall", (1.4, 0.6, 0.85), (0, 0.15, 0.24), WALL, root)
    for index, x in enumerate((-0.6, -0.2, 0.2, 0.6)):
        cylinder(f"bank-column-{index}", 0.09, 0.85, (x, -0.38, 0.665), WALL, root, vertices=8)
    box("bank-beam", (1.75, 1.15, 0.14), (0, 0, 1.09), WALL_DARK, root)
    prism("bank-pediment", 1.15, 0.42, 1.75, (0, 0, 1.23), ROOF, root)
    for index in range(3):
        cylinder(f"bank-coin-{index}", 0.22, 0.07, (0.75, -0.75, 0.04 + index * 0.075), CREAM, root, vertices=14)


def build_telco(root):
    box("telco-base", (0.9, 0.9, 0.14), (0, 0, 0), WALL_DARK, root)
    cone("telco-mast", 0.42, 2.3, (0, 0, 1.29), WALL, root, vertices=4, rot=(0, 0, math.pi / 4))
    for index, z in enumerate((0.6, 1.1, 1.55)):
        width = 0.62 - z * 0.3
        box(f"telco-ring-{index}", (width, width, 0.05), (0, 0, z), ROOF, root)
    for index, (z, turn) in enumerate(((1.25, 0.0), (1.7, math.pi * 0.6))):
        dish = cone(f"telco-dish-{index}", 0.28, 0.14, (0, 0, z), MINT, root, vertices=12,
                    rot=(math.pi / 2, 0, turn))
        dish.location = (math.sin(turn) * 0.22, -math.cos(turn) * 0.22, z)
    ball("telco-light", 0.09, (0, 0, 2.48), SIGNAL, root)


def build_publisher(root):
    for index, (color, turn) in enumerate(((ROSE, 0.0), (PERIWINKLE, 0.12), (CREAM, -0.08))):
        book = box(f"publisher-book-{index}", (1.3, 0.9, 0.2), (0, 0, index * 0.2), color, root, rot_z=turn)
        box(f"publisher-pages-{index}", (1.22, 0.84, 0.16), (0.05, 0, index * 0.2 + 0.02), WALL, root, rot_z=turn)
        book.location.x -= 0.02
    paper = box("publisher-paper", (0.95, 0.06, 1.15), (0, 0, 0), WALL, root)
    paper.rotation_euler = (-0.25, 0, 0.15)
    paper.location = (0.1, 0.15, 0.6)
    for index in range(4):
        line = box(f"publisher-line-{index}", (0.7 if index else 0.75, 0.02, 0.06 if index else 0.14),
                   (0, 0, 0), INK, root)
        line.rotation_euler = paper.rotation_euler
        offset = mathutils.Vector((0, -0.04, 0.38 - index * 0.2))
        offset.rotate(paper.rotation_euler)
        line.location = paper.location + offset


def build_governance(root):
    cylinder("governance-base", 0.5, 0.14, (0, 0, 0.07), WALL_DARK, root, vertices=14)
    cylinder("governance-post", 0.07, 1.7, (0, 0, 0.99), WALL, root, vertices=8)
    ball("governance-knob", 0.12, (0, 0, 1.88), CREAM, root)
    box("governance-beam", (1.7, 0.08, 0.08), (0, 0, 1.68), WALL, root)
    for side in (-1, 1):
        x = side * 0.8
        for strand, offset in enumerate((-0.2, 0.2)):
            cylinder(f"governance-chain-{side}-{strand}", 0.015, 0.6, (x + offset, 0, 1.39), INK, root, vertices=4)
        cylinder(f"governance-pan-{side}", 0.32, 0.06, (x, 0, 1.06), CREAM, root, vertices=16)


def build_defense(root):
    outline = [(-0.6, 1.75), (0.6, 1.75), (0.62, 1.1), (0.45, 0.65), (0.0, 0.3), (-0.45, 0.65), (-0.62, 1.1)]

    def shield(name, points, depth, y, material):
        count = len(points)
        verts = [(x, y - depth / 2, z) for x, z in points] + [(x, y + depth / 2, z) for x, z in points]
        faces = [tuple(range(count)), tuple(range(count, 2 * count))[::-1]]
        faces += [(i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)]
        return mesh_object(name, verts, faces, (0, 0, 0), material, root)

    box("defense-stand", (1.0, 0.5, 0.14), (0, 0.05, 0), WALL_DARK, root)
    box("defense-foot", (0.18, 0.18, 0.3), (0, 0.05, 0.12), WALL, root)
    shield("defense-shield", outline, 0.16, 0.05, PERIWINKLE)
    inner = [(x * 0.7, 1.03 + (z - 1.03) * 0.7) for x, z in outline]
    shield("defense-emblem", inner, 0.04, -0.06, WALL)
    star = [
        (math.sin(index * math.pi / 5) * radius, 1.08 + math.cos(index * math.pi / 5) * radius)
        for index, radius in enumerate([0.3, 0.12] * 5)
    ]
    shield("defense-star", star, 0.04, -0.1, ROSE)


def build_public(root):
    box("public-plinth", (2.0, 1.2, 0.12), (0, 0, 0), WALL_DARK, root)
    box("public-hall", (1.8, 0.9, 0.75), (0, 0, 0.12), WALL, root)
    box("public-roof", (1.9, 1.0, 0.08), (0, 0, 0.87), ROOF, root)
    for index, x in enumerate((-0.65, -0.35, 0.35, 0.65)):
        box(f"public-window-{index}", (0.16, 0.04, 0.3), (x, -0.46, 0.4), GLASS, root)
    box("public-door", (0.28, 0.04, 0.4), (0, -0.46, 0.12), INK, root)
    box("public-tower", (0.6, 0.6, 0.6), (0, 0, 0.95), WALL, root)
    cylinder("public-clock", 0.17, 0.04, (0, -0.31, 1.27), CREAM, root, vertices=14, rot=(math.pi / 2, 0, 0))
    ball("public-dome", 0.36, (0, 0, 1.55), PERIWINKLE, root, squash=0.8)
    cylinder("public-pole", 0.02, 0.5, (0, 0, 2.05), INK, root, vertices=4)
    box("public-flag", (0.3, 0.02, 0.18), (0.15, 0, 2.1), ROSE, root)


AVATARS = [
    ("bank", build_bank),
    ("telco", build_telco),
    ("publisher", build_publisher),
    ("governance", build_governance),
    ("defense", build_defense),
    ("public", build_public),
]


def join_avatar(name, root):
    """Joins an avatar's meshes into one object whose origin is the middle of its base."""
    parts = [child for child in root.children if child.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.join()
    joined = bpy.context.active_object
    scene.cursor.location = root.location
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    joined.name = name
    bpy.data.objects.remove(root)
    return joined


for index, (key, build) in enumerate(AVATARS):
    root = empty(f"avatar-{key}-parts", (index * SPACING, 0, 0), None)
    build(root)
    bpy.context.view_layer.update()
    join_avatar(f"avatar-{key}", root)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    use_selection=True,
    export_extras=True,
    export_apply=True,
)
meshes = [o for o in scene.objects if o.type == "MESH"]
print("AVATARS", len(meshes), "FACES", sum(len(o.data.polygons) for o in meshes))

# A preview of the six in a row, seen from the front and a little above.
camera_data = bpy.data.cameras.new("preview-camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = SPACING * len(AVATARS) + 1
camera = bpy.data.objects.new("preview-camera", camera_data)
scene.collection.objects.link(camera)
middle = mathutils.Vector((SPACING * (len(AVATARS) - 1) / 2, 0, 1))
camera.location = middle + mathutils.Vector((0.35, -1, 0.6)).normalized() * 40
camera.rotation_euler = (middle - camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

for engine in ("BLENDER_WORKBENCH", "WORKBENCH"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_cavity = True
scene.render.resolution_x = 1500
scene.render.resolution_y = 300
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("DONE")
