"""Primitives and the shared pastel palette for the homepage's Blender scripts.

Each helper adds one shaded object to the current scene, parented and with its material.
"""
import bpy


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
    bpy.context.scene.collection.objects.link(obj)
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
    bpy.context.scene.collection.objects.link(obj)
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
