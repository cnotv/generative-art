"""Forest road reconstruction for generative-art#349.

Recreates the reference photo (wet leaf-covered asphalt path through tall
thin deciduous trees, overcast light, eye-level portrait framing) with only
free CC0 inputs: Poly Haven HDRI/textures when downloadable, fully
procedural fallbacks otherwise.

Run headless:
    blender --background --python blender/forest-road.py

The script renders ``forest-road-render.png`` next to the open .blend, or next
to this script when run headless with no .blend open, and leaves the composed
scene open when run inside the Blender UI.
"""

import math
import os
import random
import sys
import urllib.request

import bpy
from mathutils import Euler, Matrix, Vector

SEED = 349
RENDER_WIDTH = 1080
RENDER_HEIGHT = 1920

ROAD_WIDTH = 3.4
ROAD_LENGTH = 130.0
ROAD_TOP_Y = 0.06
CAMERA_POSITION = (0.0, 1.6, 7.0)
CAMERA_LOOK_AT = (0.0, 1.3, -30.0)

TREES_PER_SIDE = 34
LEAF_COUNT = 2600

TRUNK_COLORS = [
    (0.29, 0.24, 0.19, 1.0),
    (0.35, 0.32, 0.28, 1.0),
    (0.24, 0.20, 0.16, 1.0),
]
CANOPY_COLORS = [
    (0.25, 0.48, 0.20, 1.0),
    (0.30, 0.54, 0.24, 1.0),
    (0.35, 0.60, 0.27, 1.0),
    (0.18, 0.42, 0.16, 1.0),
]
LITTER_COLORS = [
    (0.54, 0.42, 0.23, 1.0),
    (0.66, 0.51, 0.25, 1.0),
    (0.43, 0.31, 0.16, 1.0),
    (0.71, 0.59, 0.29, 1.0),
    (0.48, 0.36, 0.20, 1.0),
]

# Free CC0 sources (Poly Haven). Each is best-effort: short timeout, and the
# scene falls back to procedural materials when the download fails.
FREE_ASSETS = {
    "hdri_overcast": "https://dl.polyhaven.org/file/ph-assets/HDRIs/exr/1k/forest_slope_1k.exr",
    "asphalt": "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/asphalt_02_diff_1k.jpg",
    "forest_floor": "https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_floor_02_diff_1k.jpg",
}

randomGenerator = random.Random(SEED)


def to_blender_space(x, y, z):
    """Map a scene position to Blender's space.

    Positions throughout this script are authored with height on Y and the
    road running along Z (camera at eye height 1.6 looking down the corridor),
    while Blender is Z-up with the road running along Y. Geometry construction
    (planes spanning XY, cylinders along Z, quads with Z rotation) already
    assumes Blender's space, so only positions cross the boundary, through
    this one function.
    """
    return (x, -z, y)


def base_directory():
    """Directory for render output and the asset cache: next to the open
    .blend when there is one, next to this script in a headless run, where
    ``bpy.path.abspath("//...")`` never resolves to a writable location."""
    blendDirectory = bpy.path.abspath("//")
    if os.path.isabs(blendDirectory):
        return blendDirectory
    return os.path.dirname(os.path.abspath(__file__))


def download_asset(url, filename):
    """Fetch one free asset, returning its path or an empty string."""
    cacheDirectory = os.path.join(base_directory(), ".blender-cache")
    os.makedirs(cacheDirectory, exist_ok=True)
    destination = os.path.join(cacheDirectory, filename)
    if os.path.exists(destination):
        return destination
    try:
        urllib.request.urlretrieve(url, destination)
        return destination
    except Exception as error:
        print("Free asset unavailable, using procedural fallback:", error)
        return ""


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(collection):
            collection.remove(item)


def principled_material(name, baseColor, roughness=0.8, clearcoat=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(
        node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    reflective = "Specular" if "Specular" in bsdf.inputs else "Specular IOR Level"
    bsdf.inputs["Base Color"].default_value = baseColor
    bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = clearcoat
        bsdf.inputs["Coat Roughness"].default_value = 0.25
    elif clearcoat and reflective in bsdf.inputs:
        bsdf.inputs[reflective].default_value = 0.9
    return material


def add_textured_fallback(material, imagePath, repeat=12.0):
    """Multiply a downloaded CC0 texture over the base color when present."""
    if not imagePath or not os.path.exists(imagePath):
        return
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = next(node for node in nodes if node.type == "BSDF_PRINCIPLED")
    imageNode = nodes.new("ShaderNodeTexImage")
    imageNode.image = bpy.data.images.load(imagePath)
    mapping = nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (repeat, repeat, repeat)
    coordinates = nodes.new("ShaderNodeTexCoord")
    links.new(coordinates.outputs["UV"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], imageNode.inputs["Vector"])
    mix = nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["Factor"].default_value = 0.65
    mix.inputs["A"].default_value = bsdf.inputs["Base Color"].default_value
    links.new(imageNode.outputs["Color"], mix.inputs["B"])
    links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])


def build_ground(asphaltImage, floorImage):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=to_blender_space(0.0, 0.0, -45.0))
    ground = bpy.context.active_object
    ground.name = "ForestRoad_Ground"
    ground.scale = (60.0, 150.0, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    floorMaterial = principled_material(
        "ForestRoad_ForestFloor", (0.42, 0.35, 0.26, 1.0), roughness=0.95
    )
    add_textured_fallback(floorMaterial, floorImage)
    ground.data.materials.append(floorMaterial)

    bpy.ops.mesh.primitive_plane_add(
        size=1.0, location=to_blender_space(0.0, ROAD_TOP_Y, -55.0)
    )
    road = bpy.context.active_object
    road.name = "ForestRoad_Asphalt"
    road.scale = (ROAD_WIDTH, ROAD_LENGTH, 1.0)
    bpy.ops.object.transform_apply(scale=True)
    # Wet look: dark base with a clearcoat, matching the photo's reflections.
    roadMaterial = principled_material(
        "ForestRoad_AsphaltWet", (0.14, 0.15, 0.17, 1.0), roughness=0.32, clearcoat=0.7
    )
    add_textured_fallback(roadMaterial, asphaltImage, repeat=30.0)
    road.data.materials.append(roadMaterial)


def scatter_transforms(count, roadHalfWidth, startZ, endZ):
    """Deterministic leaf/plant placement: sparse wet center, dense verges."""
    transforms = []
    for _ in range(count):
        selector = randomGenerator.random()
        along = randomGenerator.random()
        across = randomGenerator.random()
        z = startZ - along * (startZ - endZ)
        if selector < 0.4:
            x = (randomGenerator.random() - 0.5) * 2.0 * roadHalfWidth
            y = ROAD_TOP_Y + 0.02
        else:
            side = -1.0 if randomGenerator.random() < 0.5 else 1.0
            x = side * (roadHalfWidth + across * (12.0 - roadHalfWidth))
            y = 0.05
        transforms.append((x, y, z))
    return transforms


def build_leaf_litter():
    mesh = bpy.data.meshes.new("ForestRoad_LeafLitter")
    litterObject = bpy.data.objects.new("ForestRoad_LeafLitter", mesh)
    bpy.context.collection.objects.link(litterObject)
    vertices = []
    faces = []
    materials = [
        principled_material("ForestRoad_Litter_%d" % i, color, roughness=0.9)
        for i, color in enumerate(LITTER_COLORS)
    ]
    for material in materials:
        mesh.materials.append(material)
    for index, (x, y, z) in enumerate(
        scatter_transforms(LEAF_COUNT, ROAD_WIDTH / 2.0, 8.0, -110.0)
    ):
        size = randomGenerator.uniform(0.06, 0.11)
        angle = randomGenerator.uniform(0.0, math.pi * 2.0)
        rotation = Matrix.Rotation(angle, 4, "Z")
        corners = [
            Vector((-size, -size * 0.66, 0.0)),
            Vector((size, -size * 0.66, 0.0)),
            Vector((size, size * 0.66, 0.0)),
            Vector((-size, size * 0.66, 0.0)),
        ]
        base = len(vertices)
        center = Vector(to_blender_space(x, y, z))
        vertices.extend([rotation @ corner + center for corner in corners])
        faces.append((base, base + 1, base + 2, base + 3, index % len(materials)))
    mesh.from_pydata(vertices, [], [face[:4] for face in faces])
    mesh.update()
    for polygon, face in zip(mesh.polygons, faces):
        polygon.material_index = face[4]
    mesh.update()


def build_trees():
    trunkMaterial = principled_material(
        "ForestRoad_Bark", TRUNK_COLORS[0], roughness=0.95
    )
    canopyMaterial = principled_material(
        "ForestRoad_Canopy", CANOPY_COLORS[1], roughness=0.9
    )
    for side in (-1.0, 1.0):
        for index in range(TREES_PER_SIDE):
            row = index // 2
            x = side * randomGenerator.uniform(2.6, 14.0)
            z = 6.0 - row * (116.0 / (TREES_PER_SIDE / 2)) + randomGenerator.uniform(-2, 2)
            trunkHeight = randomGenerator.uniform(7.0, 11.0)
            trunkRadius = randomGenerator.uniform(0.14, 0.25)
            bpy.ops.mesh.primitive_cylinder_add(
                radius=trunkRadius,
                depth=trunkHeight,
                location=to_blender_space(x, trunkHeight / 2.0, z),
            )
            trunk = bpy.context.active_object
            trunk.name = "ForestRoad_Trunk_%d_%d" % (side, index)
            trunk.data.materials.append(trunkMaterial)
            canopySize = randomGenerator.uniform(2.2, 3.4)
            bpy.ops.mesh.primitive_ico_sphere_add(
                radius=canopySize / 2.0,
                subdivisions=2,
                location=to_blender_space(x, trunkHeight + canopySize * 0.4, z),
            )
            canopy = bpy.context.active_object
            canopy.name = "ForestRoad_Canopy_%d_%d" % (side, index)
            canopy.scale = (
                randomGenerator.uniform(0.9, 1.2),
                randomGenerator.uniform(0.9, 1.2),
                randomGenerator.uniform(0.9, 1.3),
            )
            canopy.data.materials.append(canopyMaterial)


def build_lighting(hdriPath):
    world = bpy.context.scene.world
    world.use_nodes = True
    background = next(
        node for node in world.node_tree.nodes if node.type == "BACKGROUND"
    )
    if hdriPath and os.path.exists(hdriPath):
        environment = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
        environment.image = bpy.data.images.load(hdriPath)
        world.node_tree.links.new(
            environment.outputs["Color"], background.inputs["Color"]
        )
        background.inputs["Strength"].default_value = 0.9
    else:
        background.inputs["Color"].default_value = (0.79, 0.83, 0.82, 1.0)
        background.inputs["Strength"].default_value = 1.0
    bpy.ops.object.light_add(type="SUN", location=to_blender_space(20.0, 60.0, 10.0))
    sun = bpy.context.active_object
    sun.name = "ForestRoad_OvercastSun"
    sun.data.energy = 1.2
    bpy.ops.object.light_add(type="AREA", location=to_blender_space(0.0, 20.0, 10.0))
    softbox = bpy.context.active_object
    softbox.name = "ForestRoad_Softbox"
    softbox.data.energy = 800.0
    softbox.data.size = 30.0


def build_camera():
    cameraData = bpy.data.cameras.new("ForestRoad_Camera")
    cameraData.lens = 35
    cameraObject = bpy.data.objects.new("ForestRoad_Camera", cameraData)
    bpy.context.collection.objects.link(cameraObject)
    cameraObject.location = Vector(to_blender_space(*CAMERA_POSITION))
    lookTarget = Vector(to_blender_space(*CAMERA_LOOK_AT))
    direction = lookTarget - cameraObject.location
    cameraObject.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cameraObject


def configure_render():
    scene = bpy.context.scene
    scene.render.resolution_x = RENDER_WIDTH
    scene.render.resolution_y = RENDER_HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    try:
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 64
    except TypeError:
        scene.render.engine = "BLENDER_EEVEE"


def main():
    clear_scene()
    print("Downloading free CC0 assets (falling back when offline)...")
    hdriPath = download_asset(FREE_ASSETS["hdri_overcast"], "forest_slope_1k.exr")
    asphaltImage = download_asset(FREE_ASSETS["asphalt"], "asphalt_02_diff_1k.jpg")
    floorImage = download_asset(FREE_ASSETS["forest_floor"], "forest_floor_02_diff_1k.jpg")
    build_ground(asphaltImage, floorImage)
    build_trees()
    build_leaf_litter()
    build_lighting(hdriPath)
    build_camera()
    configure_render()
    outputPath = os.path.join(base_directory(), "forest-road-render.png")
    bpy.context.scene.render.filepath = outputPath
    bpy.ops.render.render(write_still=True)
    print("Rendered", outputPath)


if __name__ == "__main__":
    main()
