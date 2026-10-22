"""Builds the homepage skills city as one GLB: an island split by streets into eight themed
districts and a few filler blocks (houses, warehouses, tanks), with a harbour on its west coast.

Moving parts carry glTF extras (anim, axis, speed, amount, phase, lift) that the page plays back.
Axes in those extras are in three.js terms: Blender z is "y", Blender x is "x".

Run from the repository root (see documentation/docs/guides/rebuilding-the-skills-city.md):
    blender -b --factory-startup --python scripts/blender/skills-city.py -- public/skills-city.glb /tmp/skills-city.png
"""
import math
import os
import random
import sys

import bpy
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
OUT_GLB, OUT_PNG = argv[0], argv[1]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hex_rgba(value):
    value = value.lstrip("#")
    srgb = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*linear, 1.0)


MATERIALS = {}


def mat(name, color, roughness=0.85):
    if name in MATERIALS:
        return MATERIALS[name]
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = hex_rgba(color)
    bsdf.inputs["Roughness"].default_value = roughness
    material.diffuse_color = hex_rgba(color)
    MATERIALS[name] = material
    return material


WALL = ("wall", "#c9d3e6")
WALL_DARK = ("wall-dark", "#9aaac6")
ROOF = ("roof", "#5d6f92")
GLASS = ("glass", "#e9f0ff")
TRUNK = ("trunk", "#8a7a6a")
LEAF = ("leaf", "#a8d8a8")
LEAF_DARK = ("leaf-dark", "#7fb89a")
LAWN = ("lawn", "#46655f")
WATER = ("water", "#8fc0f0")
SMOKE = ("smoke", "#dfe6f2")
SIGNAL = ("signal", "#7fe0a8")


def finish(obj, material, parent):
    obj.data.materials.append(mat(*material))
    obj.parent = parent
    bpy.ops.object.shade_flat()
    return obj


def box(name, size, loc, material, parent, rot_z=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(loc[0], loc[1], loc[2] + size[2] / 2))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.rotation_euler[2] = rot_z
    bpy.ops.object.transform_apply(scale=True, rotation=False, location=False)
    return finish(obj, material, parent)


def cylinder(name, radius, depth, loc, material, parent, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, parent)


def cone(name, radius, depth, loc, material, parent, vertices=12, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, parent)


def ball(name, radius, loc, material, parent, squash=1.0):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (1, 1, squash)
    bpy.ops.object.transform_apply(scale=True, rotation=False, location=False)
    return finish(obj, material, parent)


def torus(name, major, minor, loc, material, parent):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=14,
                                     minor_segments=4, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, parent)


def mesh_object(name, verts, faces, loc, material, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    scene.collection.objects.link(obj)
    obj.location = loc
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return finish(obj, material, parent)


def prism(name, width, height, length, loc, material, parent, along_x=True):
    """A triangular roof with its base at loc z and its ridge along x (or y)."""
    half_length, half_width = length / 2, width / 2
    if along_x:
        verts = [(-half_length, -half_width, 0), (-half_length, half_width, 0), (-half_length, 0, height),
                 (half_length, -half_width, 0), (half_length, half_width, 0), (half_length, 0, height)]
    else:
        verts = [(-half_width, -half_length, 0), (half_width, -half_length, 0), (0, -half_length, height),
                 (-half_width, half_length, 0), (half_width, half_length, 0), (0, half_length, height)]
    faces = [(0, 2, 1), (3, 4, 5), (0, 3, 5, 2), (1, 2, 5, 4), (0, 1, 4, 3)]
    return mesh_object(name, verts, faces, loc, material, parent)


def empty(name, loc, parent, rot=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    obj.rotation_euler = rot
    return obj


def anim(obj, kind, axis="y", speed=1.0, amount=0.0, phase=0.0, lift=0.0):
    obj["anim"] = kind
    obj["axis"] = axis
    obj["speed"] = speed
    obj["amount"] = amount
    obj["phase"] = phase
    obj["lift"] = lift
    return obj


def tree(name, loc, parent, scale=1.0, leaf=LEAF):
    x, y, z = loc
    cylinder(f"{name}-trunk", 0.07 * scale, 0.45 * scale, (x, y, z + 0.22 * scale), TRUNK, parent, vertices=6)
    ball(f"{name}-crown", 0.36 * scale, (x, y, z + 0.7 * scale), leaf, parent)


SCREEN_DARK = ("screen-dark", "#1b2238")


def build_frontend(root, accent):
    accent_mat = ("frontend-accent", accent)
    towers = [((1.2, 0.8, 2.4), (-1.1, 0.9)), ((1.0, 0.8, 1.6), (0.3, 1.3))]
    for index, (size, (x, y)) in enumerate(towers):
        box(f"frontend-tower-{index}", size, (x, y, 0), WALL, root)
        box(f"frontend-window-{index}", (size[0] * 0.8, 0.04, size[2] * 0.62),
            (x, y - size[1] / 2 - 0.02, size[2] * 0.15), accent_mat, root)
    # A big display on a stand playing a short stylised clip: a loading bar, a bar chart that
    # rises and falls, and a highlight sweeping across, all in front of a dark panel.
    for x in (0.0, 1.6):
        box(f"frontend-display-leg-{x}", (0.1, 0.1, 0.55), (x, -0.6, 0), ROOF, root)
    box("frontend-display-frame", (2.0, 0.12, 1.25), (0.8, -0.6, 0.55), ROOF, root)
    face = -0.6 - 0.07
    box("frontend-display-panel", (1.85, 0.02, 1.1), (0.8, face, 0.62), SCREEN_DARK, root)
    box("frontend-display-header", (1.7, 0.02, 0.1), (0.8, face - 0.01, 1.52), accent_mat, root)
    loader = empty("frontend-display-loader", (0.0, face - 0.015, 0.7), root)
    box("frontend-display-loader-bar", (1.6, 0.01, 0.05), (0.8, 0, -0.025), GLASS, loader)
    anim(loader, "grow", axis="x", speed=0.3)
    for index in range(5):
        bar = empty(f"frontend-display-bar-{index}", (0.15 + index * 0.3, face - 0.015, 0.82), root)
        box(f"frontend-display-bar-box-{index}", (0.18, 0.01, 0.55), (0, 0, 0), accent_mat, bar)
        anim(bar, "stretch", axis="y", speed=2.2, amount=0.6, phase=index / 5)
    sweep = empty("frontend-display-sweep", (0.0, face - 0.02, 0.85), root)
    box("frontend-display-sweep-box", (0.12, 0.01, 0.55), (0, 0, 0), GLASS, sweep)
    anim(sweep, "slide", axis="x", speed=0.5, amount=1.6)
    for index, (x, y, z) in enumerate([(-1.6, -1.2, 0), (-1.15, -1.2, 0), (-1.38, -1.2, 0.4)]):
        box(f"frontend-component-{index}", (0.4, 0.4, 0.4), (x, y, z), accent_mat, root)


def build_ci(root, accent):
    accent_mat = ("ci-accent", accent)
    box("ci-hall", (3.0, 1.6, 1.0), (0, 0.8, 0), WALL, root)
    for index in range(4):
        prism(f"ci-roof-{index}", 1.6, 0.45, 0.75, (-1.12 + index * 0.75, 0.8, 1.0), ROOF, root, along_x=False)
    cylinder("ci-chimney", 0.22, 2.4, (1.2, 1.3, 1.2), WALL_DARK, root, vertices=10)
    for index in range(3):
        puff = empty(f"ci-smoke-{index}", (1.2, 1.3, 2.5), root)
        ball(f"ci-smoke-puff-{index}", 0.22, (0, 0, 0), SMOKE, puff)
        anim(puff, "puff", axis="y", speed=0.45, amount=1.4, phase=index / 3)
    for index, x in enumerate((-1.5, 1.5)):
        cylinder(f"ci-silo-{index}", 0.32, 1.3, (x * 1.15, -0.25, 0.65), WALL_DARK, root, vertices=10)
        cone(f"ci-silo-cap-{index}", 0.34, 0.25, (x * 1.15, -0.25, 1.42), ROOF, root, vertices=10)
    for x in (-1.6, 1.6):
        box(f"ci-belt-leg-{x}", (0.1, 0.4, 0.3), (x, -1.15, 0), ROOF, root)
    box("ci-belt", (3.4, 0.5, 0.12), (0, -1.15, 0.3), ROOF, root)
    # The belt runs into the open back of a truck, which swallows every package it carries.
    box("ci-truck-body", (0.95, 0.66, 0.66), (2.2, -1.15, 0.12), WALL, root)
    box("ci-truck-cab", (0.4, 0.62, 0.45), (2.88, -1.15, 0.12), accent_mat, root)
    box("ci-truck-windscreen", (0.03, 0.5, 0.18), (3.09, -1.15, 0.36), GLASS, root)
    for x in (1.95, 2.75):
        cylinder(f"ci-truck-wheel-{x}", 0.12, 0.7, (x, -1.15, 0.12), ROOF, root, vertices=8, rot=(math.pi / 2, 0, 0))
    for index in range(5):
        package = empty(f"ci-package-{index}", (-1.6, -1.15, 0.42), root)
        box(f"ci-package-box-{index}", (0.3, 0.3, 0.28), (0, 0, 0), accent_mat, package)
        anim(package, "slide", axis="x", speed=0.16, amount=3.8, phase=index / 5)
    cylinder("ci-signal-post", 0.04, 0.9, (1.85, -0.6, 0.45), ROOF, root, vertices=6)
    signal = empty("ci-signal", (1.85, -0.6, 0.98), root)
    ball("ci-signal-light", 0.12, (0, 0, 0), SIGNAL, signal)
    anim(signal, "pulse", speed=3.0, amount=0.25)


def robot(root, x, y, accent_mat, prefix):
    """A friendly robot that looks around and waves."""
    for side in (-0.13, 0.13):
        box(f"{prefix}-leg-{side}", (0.13, 0.15, 0.4), (x + side, y, 0), ROOF, root)
    box(f"{prefix}-body", (0.6, 0.4, 0.55), (x, y, 0.4), WALL, root)
    box(f"{prefix}-chest", (0.32, 0.02, 0.2), (x, y - 0.21, 0.58), accent_mat, root)
    head = empty(f"{prefix}-head", (x, y, 0.95), root)
    box(f"{prefix}-head-box", (0.42, 0.36, 0.32), (0, 0, 0), WALL, head)
    for side in (-0.1, 0.1):
        box(f"{prefix}-eye-{side}", (0.08, 0.02, 0.08), (side, -0.19, 0.14), SIGNAL, head)
    cylinder(f"{prefix}-antenna", 0.02, 0.18, (0, 0, 0.41), ROOF, head, vertices=5)
    ball(f"{prefix}-antenna-tip", 0.05, (0, 0, 0.52), accent_mat, head)
    anim(head, "swing", axis="y", speed=1.3, amount=0.6)
    box(f"{prefix}-arm-right", (0.12, 0.12, 0.45), (x + 0.37, y, 0.45), ROOF, root)
    shoulder = empty(f"{prefix}-shoulder", (x - 0.37, y, 0.9), root)
    box(f"{prefix}-arm-left", (0.12, 0.12, 0.45), (0, 0, 0), ROOF, shoulder)
    box(f"{prefix}-hand", (0.16, 0.16, 0.12), (0, 0, 0.45), accent_mat, shoulder)
    anim(shoulder, "swing", axis="z", speed=4.0, amount=0.5)


def robot_arm(root, x, y, accent_mat, prefix, phase):
    """An industrial arm: the base turns, the forearm dips and lifts, the gripper follows."""
    cylinder(f"{prefix}-base", 0.2, 0.18, (x, y, 0.09), ROOF, root, vertices=10)
    turret = empty(f"{prefix}-turret", (x, y, 0.18), root)
    anim(turret, "swing", axis="y", speed=1.2, amount=0.9, phase=phase)
    box(f"{prefix}-upper", (0.12, 0.12, 0.7), (0, 0, 0), accent_mat, turret)
    elbow = empty(f"{prefix}-elbow", (0, 0, 0.7), turret)
    anim(elbow, "swing", axis="z", speed=1.2, amount=0.5, phase=phase + 0.25)
    box(f"{prefix}-forearm", (0.55, 0.1, 0.1), (0.27, 0, -0.05), WALL, elbow)
    box(f"{prefix}-gripper", (0.1, 0.18, 0.16), (0.58, 0, -0.14), ROOF, elbow)


def build_ai(root, accent):
    accent_mat = ("ai-accent", accent)
    # A robot factory: the hall with roof lights, two arms at a work table and a cart shuttling parts.
    box("ai-hall", (2.8, 1.3, 1.1), (0, 1.0, 0), WALL_DARK, root)
    for index in range(3):
        box(f"ai-skylight-{index}", (0.5, 0.9, 0.12), (-0.9 + index * 0.9, 1.0, 1.1), GLASS, root)
    box("ai-hall-door", (0.9, 0.04, 0.7), (0.6, 0.33, 0), ROOF, root)
    box("ai-table", (1.9, 0.5, 0.35), (-0.3, -0.8, 0), WALL, root)
    for index, x in enumerate((-0.95, -0.4, 0.15)):
        box(f"ai-part-{index}", (0.22, 0.22, 0.18), (x, -0.8, 0.35), accent_mat, root)
    robot_arm(root, -0.9, -0.2, accent_mat, "ai-arm-left", 0.0)
    robot_arm(root, 0.4, -0.2, accent_mat, "ai-arm-right", 0.5)
    robot(root, 1.5, -0.7, accent_mat, "ai-robot")
    cart = empty("ai-cart", (-0.3, -1.55, 0), root)
    box("ai-cart-base", (0.5, 0.35, 0.14), (0, 0, 0.04), ROOF, cart)
    box("ai-cart-load", (0.3, 0.25, 0.2), (0, 0, 0.18), accent_mat, cart)
    anim(cart, "bob", axis="x", speed=0.9, amount=0.8)


def build_mentoring(root, accent):
    accent_mat = ("mentoring-accent", accent)
    cylinder("mentoring-tower", 0.7, 2.6, (0.7, 0.8, 1.3), WALL, root, vertices=14)
    for index, z in enumerate((0.65, 1.3, 1.95)):
        cylinder(f"mentoring-ring-{index}", 0.73, 0.12, (0.7, 0.8, z), accent_mat, root, vertices=14)
    ball("mentoring-dome", 0.7, (0.7, 0.8, 2.6), GLASS, root, squash=0.6)
    cylinder("mentoring-antenna", 0.04, 0.8, (0.7, 0.8, 3.3), ROOF, root, vertices=6)
    tip = empty("mentoring-antenna-tip", (0.7, 0.8, 3.72), root)
    ball("mentoring-antenna-light", 0.1, (0, 0, 0), accent_mat, tip)
    anim(tip, "pulse", speed=4.0, amount=0.45)
    orbit = empty("mentoring-orbit", (0.7, 0.8, 1.7), root)
    box("mentoring-orbit-packet", (0.2, 0.2, 0.2), (1.05, 0, -0.1), GLASS, orbit)
    box("mentoring-orbit-packet-2", (0.16, 0.16, 0.16), (-1.05, 0, -0.08), accent_mat, orbit)
    anim(orbit, "spin", axis="y", speed=1.1)
    for index in range(2):
        y = -1.4 + index * 0.45
        box(f"mentoring-rack-{index}", (0.45, 0.35, 0.75), (1.4, y, 0), ROOF, root)
        light = empty(f"mentoring-rack-light-{index}", (1.4, y - 0.18, 0.55), root)
        box(f"mentoring-rack-led-{index}", (0.3, 0.02, 0.05), (0, 0, 0), SIGNAL, light)
        anim(light, "pulse", speed=5.0 + index, amount=0.4, phase=index * 0.3)


def build_ux(root, accent):
    leaf = ("ux-accent", accent)
    for index, (x, y, scale) in enumerate([(-1.4, 1.1, 1.0), (-0.5, 1.5, 0.8), (1.3, 1.2, 1.0),
                                          (1.5, -0.3, 0.85), (-1.6, 0.0, 0.8)]):
        tree(f"ux-tree-{index}", (x, y, 0), root, scale, leaf)
    cylinder("ux-pavilion-floor", 0.7, 0.12, (0.3, 0.3, 0.06), WALL, root, vertices=12)
    for index in range(6):
        angle = index / 6 * math.tau
        cylinder(f"ux-pillar-{index}", 0.05, 0.75, (0.3 + math.cos(angle) * 0.55, 0.3 + math.sin(angle) * 0.55, 0.5),
                 WALL, root, vertices=6)
    cone("ux-pavilion-roof", 0.8, 0.55, (0.3, 0.3, 1.15), ROOF, root, vertices=12)
    box("ux-path", (0.45, 1.4, 0.02), (0.3, -0.85, 0), WALL, root)
    # A classic fountain: a still column, and water arcing out of the top bowl into the pool.
    fx, fy = -0.9, -0.9
    cylinder("ux-fountain-basin", 0.55, 0.18, (fx, fy, 0.09), WALL, root, vertices=14)
    cylinder("ux-fountain-pool", 0.48, 0.04, (fx, fy, 0.18), WATER, root, vertices=14)
    cylinder("ux-fountain-column", 0.06, 0.45, (fx, fy, 0.4), WALL, root, vertices=8)
    cone("ux-fountain-bowl", 0.18, 0.08, (fx, fy, 0.64), WALL, root, vertices=10, rot=(math.pi, 0, 0))
    ball("ux-fountain-crown", 0.07, (fx, fy, 0.7), WATER, root)
    for index in range(12):
        angle = (index % 6) / 6 * math.tau
        spout = empty(f"ux-fountain-spout-{index}", (fx, fy, 0.68), root, rot=(0, 0, angle))
        drop = empty(f"ux-fountain-drop-{index}", (0, 0, 0), spout)
        ball(f"ux-fountain-drop-ball-{index}", 0.045, (0, 0, 0), WATER, drop)
        anim(drop, "arc", axis="x", speed=1.1, amount=0.4, phase=(index // 6) * 0.5 + (index % 6) / 12, lift=0.22)
    for index, (x, y, rot) in enumerate([(-0.9, -1.75, 0), (-1.8, -0.9, math.pi / 2)]):
        box(f"ux-bench-{index}", (0.6, 0.18, 0.08), (x, y, 0.15), WALL_DARK, root, rot_z=rot)
        box(f"ux-bench-back-{index}", (0.6, 0.05, 0.2), (x, y, 0.23), WALL_DARK, root, rot_z=rot)
    for index, (x, y) in enumerate([(1.0, -1.2), (1.3, -0.9), (0.85, -0.75)]):
        ball(f"ux-flower-{index}", 0.15, (x, y, 0.08), [("ux-flower-rose", "#e8a8b8"), ("ux-flower-cream", "#f2d49b")][index % 2],
             root, squash=0.6)


def build_k8s(root, accent):
    colors = [("k8s-accent", accent), ("k8s-cream", "#f2d49b"), ("k8s-blue", "#9fc9e8"), WALL_DARK]
    stacks = [(0.3, -1.1, 3), (1.3, -1.1, 2), (0.3, -0.4, 2), (1.3, -0.4, 3), (0.3, 0.3, 1), (1.3, 0.3, 2)]
    for index, (x, y, height) in enumerate(stacks):
        for level in range(height):
            box(f"k8s-container-{index}-{level}", (0.9, 0.4, 0.4), (x, y, level * 0.42),
                colors[(index + level) % len(colors)], root)
    # Yard gantry over the stacks.
    for x in (-0.3, 1.9):
        box(f"k8s-gantry-leg-{x}", (0.12, 0.12, 1.9), (x, 1.1, 0), ROOF, root)
    box("k8s-gantry-beam", (2.4, 0.18, 0.18), (0.8, 1.1, 1.9), ROOF, root)
    trolley = empty("k8s-gantry-trolley", (0.8, 1.1, 0), root)
    box("k8s-gantry-cab", (0.35, 0.3, 0.3), (0, 0, 1.6), ("k8s-accent", accent), trolley)
    cylinder("k8s-gantry-cable", 0.02, 0.6, (0, 0, 1.3), ROOF, trolley, vertices=4)
    box("k8s-gantry-load", (0.9, 0.4, 0.4), (0, 0, 0.6), ("k8s-blue", "#9fc9e8"), trolley)
    anim(trolley, "bob", axis="x", speed=0.7, amount=0.85)
    # A quay crane on the waterfront side: tall legs, a long boom and a spreader that travels.
    for x in (-1.9, -1.1):
        for y in (-0.9, 0.5):
            box(f"k8s-quay-leg-{x}-{y}", (0.1, 0.1, 2.2), (x, y, 0), ("k8s-quay", "#e8a8b8"), root)
    box("k8s-quay-cross", (0.9, 0.12, 0.12), (-1.5, -0.2, 1.0), ("k8s-quay", "#e8a8b8"), root)
    box("k8s-quay-boom", (0.14, 1.9, 0.16), (-1.5, -0.2, 2.2), ("k8s-quay", "#e8a8b8"), root)
    box("k8s-quay-machinery", (0.5, 0.5, 0.35), (-1.5, 0.5, 2.35), WALL, root)
    spreader = empty("k8s-quay-spreader", (-1.5, -0.2, 0), root)
    box("k8s-quay-trolley", (0.3, 0.3, 0.12), (0, 0, 2.05), ROOF, spreader)
    cylinder("k8s-quay-cable", 0.015, 0.75, (0, 0, 1.65), ROOF, spreader, vertices=4)
    box("k8s-quay-container", (0.4, 0.85, 0.36), (0, 0, 0.95), ("k8s-cream", "#f2d49b"), spreader)
    anim(spreader, "bob", axis="z", speed=0.6, amount=0.55)


PAPER = ("paper", "#f4f6fb")


def build_nlg(root, accent):
    accent_mat = ("nlg-accent", accent)
    box("nlg-steps", (2.8, 1.9, 0.2), (-0.2, -0.4, 0), WALL_DARK, root)
    box("nlg-hall", (2.4, 1.4, 1.1), (-0.2, -0.2, 0.2), WALL, root)
    for index in range(5):
        cylinder(f"nlg-column-{index}", 0.08, 1.1, (-1.15 + index * 0.48, -1.1, 0.75), WALL, root, vertices=8)
    box("nlg-entablature", (2.6, 0.45, 0.15), (-0.2, -1.0, 1.3), WALL, root)
    prism("nlg-pediment", 1.85, 0.5, 2.6, (-0.2, -0.35, 1.45), accent_mat, root, along_x=True)
    for index in range(5):
        box(f"nlg-book-{index}", (0.7 - index * 0.05, 0.5, 0.15), (1.3, 1.2, index * 0.16),
            [accent_mat, ROOF, WALL_DARK][index % 3], root, rot_z=(index % 3 - 1) * 0.18)
    box("nlg-lectern", (0.45, 0.4, 0.6), (-1.2, 1.2, 0), WALL_DARK, root)
    box("nlg-book-open", (0.55, 0.38, 0.04), (-1.2, 1.2, 0.6), PAPER, root)
    # Behind the library, pages lift off the lectern and the book stack, turning as they rise and
    # fading away; the library stands at the front so its roof hides no district behind it.
    for index, (x, y, z) in enumerate([(-1.2, 1.2, 0.7), (-1.0, 1.3, 0.7), (1.3, 1.2, 0.85),
                                       (1.1, 1.4, 0.85), (0.1, 1.0, 0.3)]):
        page = empty(f"nlg-paper-{index}", (x, y, z), root)
        sheet = empty(f"nlg-paper-sheet-{index}", (0, 0, 0), page)
        box(f"nlg-paper-box-{index}", (0.22, 0.3, 0.01), (0, 0, 0), PAPER, sheet)
        anim(page, "puff", axis="y", speed=0.28, amount=1.5, phase=index / 5)
        anim(sheet, "spin", axis="y", speed=1.4 + index * 0.2)
    cylinder("nlg-globe-stand", 0.06, 0.6, (1.55, -0.5, 0.3), ROOF, root, vertices=6)
    globe = empty("nlg-globe", (1.55, -0.5, 0.85), root)
    ball("nlg-globe-ball", 0.28, (0, 0, 0), ("nlg-globe-blue", "#9fc9e8"), globe)
    torus("nlg-globe-ring", 0.34, 0.025, (0, 0, 0), accent_mat, globe)
    anim(globe, "spin", axis="y", speed=0.9)


def build_architecture(root, accent):
    accent_mat = ("architecture-accent", accent)
    # A twisting glass tower, each floor turned a little further than the one below.
    floors = 14
    for index in range(floors):
        size = 1.1 - index * 0.025
        box(f"architecture-floor-{index}", (size, size, 0.2), (-0.5, 0.5, index * 0.21),
            accent_mat if index % 2 else GLASS, root, rot_z=index * math.radians(6.5))
    cone("architecture-spire", 0.25, 0.9, (-0.5, 0.5, floors * 0.21 + 0.45), WALL, root, vertices=4,
         rot=(0, 0, math.radians(6.5 * floors)))
    # A glass dome pavilion and an arched gate.
    ball("architecture-dome", 0.7, (1.1, 0.8, 0.0), GLASS, root, squash=0.8)
    cylinder("architecture-dome-ring", 0.72, 0.08, (1.1, 0.8, 0.04), WALL, root, vertices=14)
    torus("architecture-arch", 0.55, 0.07, (1.0, -1.1, 0.0), WALL, root).rotation_euler[0] = math.pi / 2
    # A reflecting pool with a slowly turning ring sculpture over it.
    box("architecture-pool", (1.2, 0.7, 0.03), (-0.6, -1.2, 0), WATER, root)
    sculpture = empty("architecture-sculpture", (-0.6, -1.2, 0.75), root)
    torus("architecture-sculpture-ring", 0.32, 0.04, (0, 0, 0), accent_mat, sculpture).rotation_euler[0] = math.pi / 2
    torus("architecture-sculpture-ring-2", 0.22, 0.035, (0, 0, 0), WALL, sculpture)
    anim(sculpture, "spin", axis="y", speed=0.5)
    cylinder("architecture-sculpture-post", 0.03, 0.4, (-0.6, -1.2, 0.2), ROOF, root, vertices=6)

DISTRICTS = [
    ("frontend", "#8fb0ff", build_frontend),
    ("ci", "#9fd9c3", build_ci),
    ("ai", "#c5b3f0", build_ai),
    ("ux", "#a8d8a8", build_ux),
    ("k8s", "#e8a8b8", build_k8s),
    ("nlg", "#f0dcb0", build_nlg),
    ("mentoring", "#e8b8a0", build_mentoring),
    ("architecture", "#8fa8e8", build_architecture),
]

AREA_HEIGHT = 0.05
ROAD_HEIGHT = 0.02
STREET_WIDTH = 0.34
CITY_SCALE = 0.84
TEXT_BAND = 0.7
SIGN_CLEARANCE = 0.45
TEXT_MAX_WIDTH = 0.92
TEXT_MIN_ROOM = 3.6
LAND = ("land", "#2f3a4f")
SIGN_TEXT = ("sign-text", "#f4f6fb")
SIGN_BOARD = ("sign-board", "#1b2238")
SIGN_METAL = ("sign-metal", "#9aaac6")
SIGN_FRAME = 0.06
TITLE_TEXT = "What I work on"
TREE_GRID = 0.45
TREE_SPACING = 0.68
TREE_SHORE = 0.96
TREE_DENSITY = 0.85
TREE_CLEAR_HEIGHT = 0.1
TITLE_SUMMARY = "15+ years building, from startup to enterprise."
TITLE_SIZE = 1.05
TITLE_SUMMARY_SIZE = 0.56
TITLE_SIGN_DEPTH = 9.75
TITLE_POST_HEIGHT = 1.9
TITLE_WIDTH = 13.0
SIGN_TEXT_SIZE = 0.66
SIGN_PADDING = 0.18
SIGN_POST_HEIGHT = 0.75
SIGN_FONTS = [
    "/System/Library/Fonts/Supplemental/DIN Alternate Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
GROUND_LABELS = {
    "frontend": "Frontend", "ci": "CI automation", "ai": "AI automations", "ux": "UX",
    "k8s": "Kubernetes", "nlg": "NLG and NLU", "mentoring": "Mentoring", "architecture": "Architecture",
}
SLAB_HEIGHT = 0.35
SPREAD = 1.1
FIT_MARGIN = 0.92
MIN_FIT_SCALE = 0.5
COAST = -10.0
SEA_WEST = 15.2
SEA_EAST = 14.0
SEA_DEPTH = 12.2
ROAD = ("road", "#262f40")
WATER_DEEP = ("water-deep", "#3b5f8f")
AREA_TINT = 0.18

# The camera looks from the front right, so screen right and screen depth are the ground axes
# turned by its azimuth. Districts are planned in that screen frame, in staggered rows, so each
# one gets its own clear spot on screen and its name reads left to right along its front edge.
SCREEN_RIGHT = (0.819, 0.573)
SCREEN_DEPTH = (-0.573, 0.819)
SCREEN_ANGLE = math.atan2(SCREEN_RIGHT[1], SCREEN_RIGHT[0])


def blend(base, accent, share):
    channels = [round(int(base[i:i + 2], 16) * (1 - share) + int(accent[i:i + 2], 16) * share)
                for i in (1, 3, 5)]
    return "#" + "".join(f"{channel:02x}" for channel in channels)


def from_screen(right, depth):
    return (right * SCREEN_RIGHT[0] + depth * SCREEN_DEPTH[0], right * SCREEN_RIGHT[1] + depth * SCREEN_DEPTH[1])


def to_screen(x, y):
    return (x * SCREEN_RIGHT[0] + y * SCREEN_RIGHT[1], x * SCREEN_DEPTH[0] + y * SCREEN_DEPTH[1])


def build_houses(root, accent):
    roofs = [("house-rose", "#e8a8b8"), ("house-cream", "#f2d49b"), ("house-mint", "#9fd9c3"), ROOF]
    spots = [(-1.3, -1.0), (0.1, -1.3), (1.4, -0.8), (-1.2, 0.6), (0.3, 0.4), (1.5, 0.8), (-0.4, 1.7)]
    for index, (x, y) in enumerate(spots):
        height = 0.6 + (index % 3) * 0.2
        box(f"house-{index}", (0.9, 0.75, height), (x, y, 0), WALL, root, rot_z=(index % 2) * math.pi / 2)
        prism(f"house-roof-{index}", 0.95 if index % 2 == 0 else 1.05, 0.4, 1.05 if index % 2 == 0 else 0.95,
              (x, y, height), roofs[index % len(roofs)], root, along_x=index % 2 == 0)
    for index, (x, y) in enumerate([(-0.5, -0.2), (0.9, -0.1), (-1.6, 1.6)]):
        tree(f"house-tree-{index}", (x, y, 0), root, 0.7)


def build_warehouses(root, accent):
    for index, (x, y) in enumerate([(-0.6, 0.9), (-0.6, -0.6)]):
        box(f"warehouse-{index}", (2.4, 1.0, 0.8), (x, y, 0), WALL_DARK, root)
        prism(f"warehouse-roof-{index}", 1.05, 0.3, 2.5, (x, y, 0.8), ROOF, root, along_x=True)
    for index, (x, y) in enumerate([(1.4, 0.9), (1.5, -0.6)]):
        box(f"truck-body-{index}", (0.8, 0.4, 0.4), (x, y, 0), ("truck", "#f2d49b"), root)
        box(f"truck-cab-{index}", (0.3, 0.38, 0.3), (x + 0.55, y, 0), WALL, root)
    box("warehouse-crates", (0.5, 0.5, 0.4), (0.3, -1.7, 0), ("crate", "#9fc9e8"), root)


def build_tanks(root, accent):
    for index, (x, y, radius) in enumerate([(-0.9, 0.7, 0.7), (0.8, 0.9, 0.55), (0.0, -0.8, 0.8)]):
        cylinder(f"tank-{index}", radius, 1.1, (x, y, 0.55), WALL, root, vertices=14)
        ball(f"tank-dome-{index}", radius, (x, y, 1.1), WALL_DARK, root, squash=0.35)
    box("tank-pipe", (2.2, 0.08, 0.08), (0, 0.1, 0.4), ROOF, root, rot_z=0.6)


FILLERS = [("houses", "#c9b8e8", build_houses), ("warehouses", "#9aaac6", build_warehouses),
           ("tanks", "#9aaac6", build_tanks)]

# Industrial quarter in the west along the harbour, downtown in the middle, homes in the east.
SLOTS = {
    "ci": (-4.4, 4.8), "ai": (1.0, 5.4), "frontend": (6.6, 4.7),
    "k8s": (-7.8, -0.4), "nlg": (0.6, -0.1), "houses-1": (5.0, 0.2), "houses-2": (9.4, 0.0),
    "architecture": (-3.8, -5.0), "ux": (1.4, -5.6), "mentoring": (6.8, -4.8),
    "warehouses": (-8.4, 5.2), "tanks": (-8.2, -5.6),
}
FILLER_OF = {"houses-1": 0, "houses-2": 0, "warehouses": 1, "tanks": 2}

city = bpy.data.objects.new("skills-city", None)
scene.collection.objects.link(city)
ground = empty("ground", (0, 0, 0), city)

# The island: an organic outline, cut straight along the western coast where the harbour is.
island_rng = random.Random(11)
island_sides = 32
island = []
for index in range(island_sides):
    angle = index / island_sides * math.tau
    wobble = 0.95 + 0.08 * island_rng.random()
    right, depth = math.cos(angle) * 12.6 * wobble, math.sin(angle) * 10.6 * wobble
    island.append(from_screen(max(right, COAST), depth))


def slab(name, outline, top, bottom, material, parent):
    count = len(outline)
    verts = [(x, y, top) for x, y in outline] + [(x, y, bottom) for x, y in outline]
    faces = [tuple(range(count)), tuple(range(count, 2 * count))[::-1]]
    faces += [(i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count)]
    return mesh_object(name, verts, faces, (0, 0, 0), material, parent)


slab("ground-island", island, 0, -SLAB_HEIGHT, LAND, ground)
# The districts keep to the middle of the island; the land around them, and the houses,
# warehouses and tanks on it, are one continuous piece with no streets of their own.
city_limit = []
for index in range(island_sides):
    angle = index / island_sides * math.tau
    right, depth = math.cos(angle) * 12.6 * CITY_SCALE, math.sin(angle) * 10.6 * CITY_SCALE
    city_limit.append(from_screen(max(right, COAST), depth))
# The sea all around the island, wider on the west where it opens into the harbour bay, so the
# harbour sits on a real coastline instead of a pool beside the land.
water_rng = random.Random(5)
water = []
for index in range(36):
    angle = index / 36 * math.tau
    wobble = 0.96 + 0.06 * water_rng.random()
    reach = SEA_WEST if math.cos(angle) < 0 else SEA_EAST
    water.append(from_screen(math.cos(angle) * reach * wobble, math.sin(angle) * SEA_DEPTH * wobble))
slab("ground-water", water, -0.14, -SLAB_HEIGHT, WATER_DEEP, ground)


def clip(polygon, normal, offset):
    """Keeps the part of a polygon where dot(point, normal) <= offset."""
    result = []
    for index, current in enumerate(polygon):
        following = polygon[(index + 1) % len(polygon)]
        current_side = current[0] * normal[0] + current[1] * normal[1] - offset
        following_side = following[0] * normal[0] + following[1] * normal[1] - offset
        if current_side <= 0:
            result.append(current)
        if current_side * following_side < 0:
            share = current_side / (current_side - following_side)
            result.append((current[0] + (following[0] - current[0]) * share,
                           current[1] + (following[1] - current[1]) * share))
    return result


def cell(key, sites, boundary):
    """The part of the boundary closer to this site than to any other, around the site."""
    cx, cy = sites[key]
    area = list(boundary)
    for other, (ox, oy) in sites.items():
        if other == key:
            continue
        length = math.dist((cx, cy), (ox, oy))
        normal = ((ox - cx) / length, (oy - cy) / length)
        middle = ((cx + ox) / 2, (cy + oy) / 2)
        area = clip(area, normal, middle[0] * normal[0] + middle[1] * normal[1])
    return [(x - cx, y - cy) for x, y in area]


def inset(polygon, distance):
    """Moves every edge of a convex polygon inwards by a distance."""
    orientation = 1 if sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1])) > 0 else -1
    result = list(polygon)
    for (x1, y1), (x2, y2) in zip(polygon, polygon[1:] + polygon[:1]):
        length = math.dist((x1, y1), (x2, y2))
        if length < 1e-6:
            continue
        outward = (orientation * (y2 - y1) / length, -orientation * (x2 - x1) / length)
        result = clip(result, outward, x1 * outward[0] + y1 * outward[1] - distance)
    return result


def chord(screen, depth):
    """Where a line across the screen at a given depth enters and leaves the polygon."""
    crossings = []
    for (r1, d1), (r2, d2) in zip(screen, screen[1:] + screen[:1]):
        if (d1 - depth) * (d2 - depth) < 0:
            crossings.append(r1 + (depth - d1) * (r2 - r1) / (d2 - d1))
    return (min(crossings), max(crossings)) if len(crossings) >= 2 else (0.0, 0.0)


def text_line(polygon):
    """The depth for the district's name: the first line behind the front edge wide enough for it."""
    screen = [to_screen(x, y) for x, y in polygon]
    front = min(depth for _, depth in screen)
    depth = front + SIGN_TEXT_SIZE
    while depth < front + TEXT_BAND * 2:
        left, right = chord(screen, depth)
        if right - left > TEXT_MIN_ROOM:
            return depth, left, right
        depth += 0.08
    left, right = chord(screen, depth)
    return depth, left, right


def without_front_band(polygon, depth):
    """The polygon minus everything in front of the line behind the name, kept clear for it."""
    return clip(polygon, (-SCREEN_DEPTH[0], -SCREEN_DEPTH[1]), -(depth + SIGN_CLEARANCE))


def sign_font():
    """A bold font for the signs: the first one this machine has, else Blender's own."""
    for path in SIGN_FONTS:
        if os.path.exists(path):
            return bpy.data.fonts.load(path, check_existing=True)
    return None


def sign_text(name, text, size, widest):
    """One line of bold text as a mesh, shrunk if it would be wider than the room it has."""
    bpy.ops.object.text_add(location=(0, 0, 0))
    label = bpy.context.active_object
    font = sign_font()
    if font:
        label.data.font = font
    label.data.body = text
    label.data.size = size
    label.data.align_x = "CENTER"
    label.data.align_y = "CENTER"
    label.data.resolution_u = 1
    bpy.ops.object.convert(target="MESH")
    label = bpy.context.active_object
    label.name = name
    if label.dimensions.x > widest:
        label.scale = (widest / label.dimensions.x,) * 3
        bpy.ops.object.transform_apply(scale=True, rotation=False, location=False)
    return label


def signboard(name, lines, x, y, parent, post_height, widest):
    """A signboard in a metal frame, standing up and facing the camera, with one or more lines
    of text: the legs run up the board's sides to its top and rails close its top and bottom
    edges, so the board is held by the frame rather than floating on two sticks."""
    labels = [sign_text(f"{name}-text-{index}", text, size, widest - SIGN_PADDING * 2)
              for index, (text, size) in enumerate(lines)]
    gap = SIGN_PADDING * 0.5
    width = max(label.dimensions.x for label in labels) + SIGN_PADDING * 2
    height = sum(label.dimensions.y for label in labels) + gap * (len(labels) - 1) + SIGN_PADDING * 1.4
    sign = empty(f"{name}-sign", (x, y, AREA_HEIGHT), parent, rot=(0, 0, SCREEN_ANGLE))
    bottom, top = post_height - height / 2, post_height + height / 2
    for side in (-1, 1):
        box(f"{name}-sign-leg-{side}", (SIGN_FRAME, SIGN_FRAME, top + SIGN_FRAME),
            (side * (width / 2 + SIGN_FRAME / 2), 0, 0), SIGN_METAL, sign)
    for edge, z in (("top", top), ("bottom", bottom - SIGN_FRAME)):
        box(f"{name}-sign-rail-{edge}", (width + SIGN_FRAME * 2, SIGN_FRAME, SIGN_FRAME), (0, 0, z), SIGN_METAL, sign)
    box(f"{name}-sign-board", (width, 0.05, height), (0, 0, bottom), SIGN_BOARD, sign)
    line_top = top - SIGN_PADDING * 0.7
    for label in labels:
        label.parent = sign
        label.location = (0, -0.04, line_top - label.dimensions.y / 2)
        label.rotation_euler = (math.pi / 2, 0, 0)
        finish(label, SIGN_TEXT, sign)
        line_top -= label.dimensions.y + gap
    return sign


def district_sign(name, text, polygon, parent):
    """The district's name on a signboard planted on its front edge, like a street sign."""
    depth, left, right = text_line(polygon)
    x, y = from_screen((left + right) / 2, depth)
    signboard(name, [(text, SIGN_TEXT_SIZE)], x, y, parent, SIGN_POST_HEIGHT, (right - left) * TEXT_MAX_WIDTH)
    return depth


def inside(point, polygon):
    x, y = point
    crossings = 0
    for index, (x1, y1) in enumerate(polygon):
        x2, y2 = polygon[(index + 1) % len(polygon)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            crossings += 1
    return crossings % 2 == 1


def keep_inside(buildings, outline):
    """Shrinks a district's buildings until every vertex sits inside its own area, a margin in
    from the street, so nothing spills over into the street or a neighbour."""
    area = buildings.parent
    # Centre the group on the area itself rather than on its site, which sits off centre in
    # areas cut short by the coast or the island's edge.
    twice_area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(outline, outline[1:] + outline[:1]))
    centre_x = sum((x1 + x2) * (x1 * y2 - x2 * y1) for (x1, y1), (x2, y2) in zip(outline, outline[1:] + outline[:1])) / (3 * twice_area)
    centre_y = sum((y1 + y2) * (x1 * y2 - x2 * y1) for (x1, y1), (x2, y2) in zip(outline, outline[1:] + outline[:1])) / (3 * twice_area)
    buildings.location.x, buildings.location.y = centre_x, centre_y
    margin = [(centre_x + (x - centre_x) * FIT_MARGIN, centre_y + (y - centre_y) * FIT_MARGIN) for x, y in outline]
    scale = 1.0
    while scale > MIN_FIT_SCALE:
        buildings.scale = (scale, scale, scale)
        bpy.context.view_layer.update()
        to_area = area.matrix_world.inverted()
        meshes = [o for o in buildings.children_recursive if o.type == "MESH"]
        if all(inside(((to_area @ (o.matrix_world @ v.co)).x, (to_area @ (o.matrix_world @ v.co)).y), margin)
               for o in meshes for v in o.data.vertices):
            return scale
        scale -= 0.03
    print(f"WARNING {buildings.name} still spills over at scale {scale:.2f}")
    return scale


sites = {key: from_screen(*slot) for key, slot in SLOTS.items()}
accents = {key: accent for key, accent, _ in DISTRICTS}
builders = {key: build for key, _, build in DISTRICTS}
for key, filler_index in FILLER_OF.items():
    _, accents[key], builders[key] = FILLERS[filler_index]

district_roads = []
for index, key in enumerate(SLOTS):
    is_district = key not in FILLER_OF
    area = bpy.data.objects.new(f"district-{key}" if is_district else f"block-{key}", None)
    scene.collection.objects.link(area)
    area.parent = city
    area.location = (*sites[key], 0)
    buildings = empty(f"{key}-buildings", (0, 0, AREA_HEIGHT if is_district else 0), area)
    builders[key](buildings, accents[key])
    for child in buildings.children:
        child.location.x *= SPREAD
        child.location.y *= SPREAD
    if not is_district:
        keep_inside(buildings, cell(key, sites, island))
        continue
    # A district is a raised tile with a ring of road around it; neighbouring rings meet into
    # the streets between districts, and the land beyond the outer ring stays one piece.
    road = cell(key, sites, city_limit)
    district_roads.append([(x + sites[key][0], y + sites[key][1]) for x, y in road])
    tile = inset(road, STREET_WIDTH)
    slab(f"{key}-road", road, ROAD_HEIGHT, 0.0, ROAD, area)
    tint = LAWN if key == "ux" else (f"{key}-area", blend("#34405a", accents[key], AREA_TINT))
    slab(f"{key}-area", tile, AREA_HEIGHT, 0.0, tint, area)
    for corner_index, (x, y) in enumerate(tile[::2]):
        lamp_x, lamp_y = x * 0.95, y * 0.95
        cylinder(f"{key}-lamp-{corner_index}", 0.03, 0.75, (lamp_x, lamp_y, 0.4), ROOF, area, vertices=5)
        box(f"{key}-lamp-head-{corner_index}", (0.12, 0.12, 0.06), (lamp_x, lamp_y, 0.78), GLASS, area)
    name_depth = district_sign(f"{key}-name", GROUND_LABELS[key], tile, area)
    keep_inside(buildings, without_front_band(tile, name_depth))

# The harbour: piers from the quay out into the water and a boat rocking beside them.
for index, depth in enumerate((-2.2, -0.6, 1.0)):
    x, y = from_screen(COAST - 0.9, depth)
    box(f"pier-{index}", (1.9, 0.4, 0.1), (x, y, -0.12), WALL_DARK, ground, rot_z=SCREEN_ANGLE)
boat_x, boat_y = from_screen(COAST - 2.4, -1.4)
boat = empty("harbour-boat", (boat_x, boat_y, -0.1), city)
box("harbour-boat-hull", (1.8, 0.65, 0.28), (0, 0, 0), ("k8s-accent", "#e8a8b8"), boat, rot_z=SCREEN_ANGLE)
box("harbour-boat-cabin", (0.6, 0.48, 0.3), (0.3 * SCREEN_RIGHT[0], 0.3 * SCREEN_RIGHT[1], 0.28), WALL, boat,
    rot_z=SCREEN_ANGLE)
anim(boat, "bob", axis="y", speed=1.4, amount=0.05)

# The section's heading and summary on a big sign planted on the land behind the city.
title_x, title_y = from_screen(0.0, TITLE_SIGN_DEPTH)
signboard("title", [(TITLE_TEXT, TITLE_SIZE), (TITLE_SUMMARY, TITLE_SUMMARY_SIZE)], title_x, title_y, ground,
          TITLE_POST_HEIGHT, TITLE_WIDTH)


def pine(name, loc, parent, scale):
    x, y, z = loc
    cylinder(f"{name}-trunk", 0.06 * scale, 0.3 * scale, (x, y, z + 0.15 * scale), TRUNK, parent, vertices=5)
    cone(f"{name}-crown", 0.32 * scale, 0.9 * scale, (x, y, z + 0.72 * scale), LEAF_DARK, parent, vertices=6)


# Trees wherever the land is still bare: off the districts and their roads, clear of anything
# already standing, and a step in from the shore.
bpy.context.view_layer.update()
occupied = set()
for obj in [o for o in scene.objects if o.type == "MESH"]:
    for vertex in obj.data.vertices:
        point = obj.matrix_world @ vertex.co
        if point.z > TREE_CLEAR_HEIGHT:
            occupied.add((round(point.x / TREE_GRID), round(point.y / TREE_GRID)))
shore = [(x * TREE_SHORE, y * TREE_SHORE) for x, y in island]
tree_rng = random.Random(23)
planted = 0
for column in range(-30, 31):
    for row in range(-26, 27):
        x = column * TREE_SPACING + tree_rng.uniform(-0.3, 0.3)
        y = row * TREE_SPACING + tree_rng.uniform(-0.3, 0.3)
        cell_key = (round(x / TREE_GRID), round(y / TREE_GRID))
        crowded = any((cell_key[0] + dx, cell_key[1] + dy) in occupied for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if crowded or not inside((x, y), shore) or to_screen(x, y)[0] < COAST + 0.6:
            continue
        if any(inside((x, y), road) for road in district_roads) or tree_rng.random() > TREE_DENSITY:
            continue
        scale = tree_rng.uniform(0.55, 0.9)
        if tree_rng.random() < 0.65:
            pine(f"land-pine-{planted}", (x, y, 0), ground, scale)
        else:
            tree(f"land-tree-{planted}", (x, y, 0), ground, scale)
        planted += 1
print(f"TREES {planted}")

bpy.context.view_layer.update()


def is_animated(obj):
    return "anim" in obj.keys()


def has_animated_ancestor(obj):
    parent = obj.parent
    while parent:
        if is_animated(parent):
            return True
        parent = parent.parent
    return False


def join_group(name):
    """Joins a group's still meshes into one object, keeping its moving parts as children."""
    group = bpy.data.objects[name]
    location = group.matrix_world.translation.copy()
    descendants = list(group.children_recursive)
    movers = [o for o in descendants if is_animated(o) and not has_animated_ancestor(o)]
    mover_trees = set(movers)
    for mover in movers:
        mover_trees.update(mover.children_recursive)
    for mover in movers:
        matrix = mover.matrix_world.copy()
        mover.parent = None
        mover.matrix_world = matrix
    still = [o for o in descendants if o.type == "MESH" and o not in mover_trees]
    leftovers = [o for o in descendants if o.type == "EMPTY" and o not in mover_trees]
    bpy.ops.object.select_all(action="DESELECT")
    for part in still:
        part.select_set(True)
    bpy.context.view_layer.objects.active = still[0]
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.join()
    joined = bpy.context.active_object
    for leftover in leftovers:
        bpy.data.objects.remove(leftover)
    bpy.data.objects.remove(group)
    bpy.context.view_layer.update()
    # Pivot on the district centre so it can be lifted as one piece with everything that moves on it.
    offset = location - joined.matrix_world.translation
    joined.data.transform(mathutils.Matrix.Translation(-offset))
    joined.location = location
    joined.parent = city
    joined.name = name
    joined.data.name = name
    bpy.context.view_layer.update()
    for mover in movers:
        matrix = mover.matrix_world.copy()
        mover.parent = joined
        mover.matrix_world = matrix


for key in SLOTS:
    join_group(f"district-{key}" if key not in FILLER_OF else f"block-{key}")
join_group("ground")

bpy.context.view_layer.update()
meshes = [o for o in scene.objects if o.type == "MESH"]
triangles = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)
movers = [o for o in scene.objects if is_animated(o)]
print(f"MESHES {len(meshes)} TRIANGLES {triangles} MOVERS {len(movers)}")

bpy.ops.export_scene.gltf(
    filepath=OUT_GLB,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)

camera_data = bpy.data.cameras.new("preview-camera")
camera_data.type = "ORTHO"
camera_data.ortho_scale = 34
camera = bpy.data.objects.new("preview-camera", camera_data)
scene.collection.objects.link(camera)
camera.location = (14, -20, 18)
camera.rotation_euler = (-camera.location).to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

for engine in ("BLENDER_WORKBENCH", "WORKBENCH"):
    try:
        scene.render.engine = engine
        break
    except TypeError:
        continue
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x = 1400
scene.render.resolution_y = 900
scene.render.filepath = OUT_PNG
bpy.ops.render.render(write_still=True)
print("DONE")
