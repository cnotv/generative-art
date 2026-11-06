"""Build public/character2-own-rig.glb: the bundled character2 mesh skinned to a humanoid
armature fitted to the mesh itself.

character2.fbx ships with a Mixamo skeleton and Mixamo's skin weights. This script keeps the
mesh and discards both: the armature and the skin weights are deleted on import, and every
joint of the replacement is measured from the geometry alone (silhouette slices, ring fits,
cross-sections). Nothing is read from the imported skeleton, so the example the Model Editor
offers is our own rig rather than a copy of the one the download carried; only the bone
naming convention is shared, so the tooling that matches `mixamorig*` reaches it.

Joints the mesh cannot state on its own fall back to standard anthropometric fractions of
the figure's own measured height, each one noted where it is used: the harem trousers hide
the hip joints and the pelvis is a mass rather than a landmark.

Run headless or from the Blender UI:

    blender --background --python blender/character-rig.py

The build happens in a scratch scene and the open file is left untouched: nothing is saved,
and the scratch scene plus every datablock this script created are removed once the GLB is
written. The output lands in the repository's public/ directory, next to this script.
"""

import os

import bpy
import numpy as np
from mathutils import Vector

MODEL_FILE = "character2.fbx"
OUTPUT_FILE = "character2-own-rig.glb"
SCRATCH_SCENE = "OwnRigBuild"

# The example ships for its rig; the download's textures are 4096 square (12.9 MB for the
# normal map alone), which would put the GLB far past the asset budget for no visible gain.
TEXTURE_SIZE = 1024
JPEG_QUALITY = 90

# The root of the hierarchy the rest of the tooling matches on (packages/rig/src/config.ts):
# Mixamo's naming convention with the colon dropped, so both loaders and every table agree on
# the names without sanitising anything.
ROOT_BONE = "mixamorigHips"


def public_directory():
    """The repository's public/ directory, resolved against this script's own location."""
    scriptDirectory = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(scriptDirectory, "..", "public"))


def create_scratch_scene():
    """A scene of our own to build in, so the open file's own scenes keep their contents."""
    if SCRATCH_SCENE in bpy.data.scenes:
        bpy.data.scenes.remove(bpy.data.scenes[SCRATCH_SCENE])
    scene = bpy.data.scenes.new(SCRATCH_SCENE)
    bpy.context.window.scene = scene
    return scene


def import_stripped_mesh(filepath):
    """Import the FBX and reduce it to the mesh alone.

    The imported armature, its modifier and every one of Mixamo's vertex groups go before
    anything is measured, so the fit that follows cannot see them even by accident. The
    import's 0.01 scale and axis conversion are baked into the vertices, leaving the mesh in
    metres, Z-up, feet on the ground: the space every landmark below is stated in.
    """
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=filepath, use_anim=False)
    imported = [obj for obj in bpy.data.objects if obj not in before]

    mesh = next(obj for obj in imported if obj.type == "MESH")
    world = mesh.matrix_world.copy()
    mesh.parent = None
    mesh.matrix_world = world
    for modifier in list(mesh.modifiers):
        if modifier.type == "ARMATURE":
            mesh.modifiers.remove(modifier)
    mesh.vertex_groups.clear()
    for extra in [obj for obj in imported if obj is not mesh]:
        bpy.data.objects.remove(extra, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    bpy.context.view_layer.objects.active = mesh
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return mesh


def slab(coordinates, low, high, side=0):
    """Vertices inside a horizontal slice, optionally only one side of the centreline."""
    points = coordinates[(coordinates[:, 2] >= low) & (coordinates[:, 2] < high)]
    if side > 0:
        points = points[points[:, 0] > 0]
    if side < 0:
        points = points[points[:, 0] < 0]
    return points


def centre_of(points):
    """A slice's own centre, in x and y, at its median height."""
    return (
        float(points[:, 0].mean()),
        float(points[:, 1].mean()),
        float(np.median(points[:, 2])),
    )


def measure_landmarks(coordinates):
    """Every joint the mesh states about itself, in metres, Z-up, facing -Y.

    Each value is read from the geometry: the boot's narrowest row for the ankle, the foot's
    own heel and toe for the ball, a least-squares fit down the arm's axis for its slope and
    centre, the narrowest section before the hand for the wrist, and so on. The few figures
    that clothing hides are anthropometric fractions of the measured height, said so where
    they appear.
    """
    zmin = float(coordinates[:, 2].min())
    zmax = float(coordinates[:, 2].max())
    height = zmax - zmin

    foot = coordinates[coordinates[:, 2] < zmin + 0.04 * height]
    heelY = float(foot[:, 1].max())
    toeY = float(foot[:, 1].min())
    # The character faces the way the toes stick out from the leg column above them, and
    # every left/right landmark below is stated for a figure facing -y (her left at +x).
    if abs(toeY) <= abs(heelY):
        raise RuntimeError(
            "The mesh faces +y, but every left/right landmark here is fitted for a figure "
            "facing -y (her own left at +x); a character that faces the other way needs "
            "every left and right landmark mirrored before use."
        )

    # The ankle is the narrowest well-populated row of the boot: below it the sole and the
    # heel widen, above it the shaft and its cuff do.
    ankle = None
    for low in np.arange(zmin + 0.03 * height, zmin + 0.13 * height, 0.01):
        row = slab(coordinates, low, low + 0.01)
        if len(row) < 40:
            continue
        width = float(row[:, 0].max() - row[:, 0].min())
        if ankle is None or width < ankle[0]:
            ankle = (width, low + 0.005, row)
    if ankle is None:
        raise RuntimeError("No ankle: no boot row in the scanned range carries enough vertices.")
    ankleX, ankleY, ankleZ = centre_of(ankle[2][ankle[2][:, 0] > 0])
    anklePoint = (ankleX, ankleY, ankleZ)
    # The ball of the foot sits a little over two thirds of the way from the heel to the toe.
    ballPoint = (ankleX, heelY + 0.72 * (toeY - heelY), zmin + 0.03)

    # A least-squares line through the arm's cross-sections gives both its droop and the
    # height every joint along it sits at; its own points give the y it hangs at.
    armBand = slab(coordinates, 0.69 * height, 0.80 * height)
    armBand = armBand[(armBand[:, 0] > 0.11 * height) & (armBand[:, 0] < 0.31 * height)]
    armSlope, armIntercept = np.polyfit(armBand[:, 0], armBand[:, 2], 1)
    armY = float(armBand[:, 1].mean())

    def armHeightAt(x):
        """The centreline's height at x: one plain height for one x, a column for a column."""
        heights = armSlope * np.asarray(x) + armIntercept
        return float(heights) if heights.ndim == 0 else heights

    shoulderZ = armHeightAt(0.0)
    torsoWall = slab(coordinates, shoulderZ - 0.04, shoulderZ + 0.02)
    torsoWallX = float(torsoWall[np.abs(torsoWall[:, 0]) < 0.09 * height][:, 0].max())
    armPoints = coordinates[
        (coordinates[:, 0] > torsoWallX + 0.02)
        & (coordinates[:, 0] < 0.30)
        & (np.abs(coordinates[:, 2] - armHeightAt(np.clip(coordinates[:, 0], 0, 0.5))) < 0.03)
    ]
    # The humerus head sits between the chest wall and the first ring of the arm's surface.
    shoulderX = 0.5 * (torsoWallX + float(armPoints[:, 0].min()))
    shoulderPoint = (shoulderX, armY, armHeightAt(shoulderX))

    # The wrist is where the arm stops narrowing on its way into the hand: the thinnest
    # cross-section between the forearm and the fingers.
    wrist = None
    for low in np.arange(0.25 * height, 0.38 * height, 0.01):
        segment = coordinates[
            (coordinates[:, 0] >= low)
            & (coordinates[:, 0] < low + 0.01)
            & (coordinates[:, 2] > 0.68 * height)
            & (coordinates[:, 2] < 0.81 * height)
        ]
        if len(segment) < 6:
            continue
        span = float(np.ptp(segment[:, 2]))
        if wrist is None or span < wrist[0]:
            wrist = (span, low + 0.005, segment)
    if wrist is None:
        raise RuntimeError("No wrist: no arm cross-section in the scanned range carries enough vertices.")
    wristX = wrist[1]
    wristPoint = (wristX, float(wrist[2][:, 1].mean()), armHeightAt(wristX))
    # The elbow takes the standard share of a shoulder-to-wrist span: 56%.
    elbowX = shoulderX + 0.56 * (wristX - shoulderX)
    elbowPoint = (elbowX, armY, armHeightAt(elbowX))

    tipX = float(coordinates[coordinates[:, 0] > 0][:, 0].max())
    hand = slab(coordinates, 0.68 * height, 0.81 * height, side=1)
    tipPoint = (tipX, float(hand[:, 1].mean()), armHeightAt(tipX))

    # Hip joints: clothes hide them, so they hold the standard height (53% of the figure),
    # checked against the silhouette, whose pelvis is widest at 52%. They sit inboard of the
    # pelvis by about a third of its half width.
    pelvisBand = slab(coordinates, 0.51 * height, 0.55 * height)
    pelvisHalfWidth = float(pelvisBand[:, 0].max())
    hipZ = 0.53 * height
    hipX = 0.68 * pelvisHalfWidth
    hipY = float(pelvisBand[pelvisBand[:, 0] > 0.02][:, 1].mean())
    hipPoint = (hipX, hipY, hipZ)
    # The knee comes halfway between the hip joint and the ankle (the standard knee height),
    # confirmed against the leg's own cross-section there.
    kneeZ = 0.5 * (hipZ + ankleZ)
    kneeX, kneeY, _ = centre_of(slab(coordinates, kneeZ - 0.03, kneeZ + 0.03, side=1))
    kneePoint = (kneeX, kneeY, kneeZ)

    # The hips bone roots the spine where the pelvis carries it, a touch above the joints.
    hipsZ = hipZ + 0.02 * height
    spineZ = armHeightAt(shoulderX) - 0.012
    spinePoint = (0.0, float(pelvisBand[:, 1].mean()), hipsZ)

    # The neck is where the central column first narrows below 6 cm; its bone starts a
    # centimetre lower, where the column leaves the shoulder band.
    neckZ = None
    for low in np.arange(spineZ + 0.03, 0.86 * height, 0.01):
        row = slab(coordinates, low, low + 0.01)
        column = row[np.abs(row[:, 0]) < 0.06 * height]
        if len(column) > 10 and float(np.ptp(column[:, 0])) < 0.06:
            neckZ = low - 0.01 * height
            break
    if neckZ is None:
        raise RuntimeError("No neck: the column below the crown never narrows within the scanned range.")
    neckY = float(slab(coordinates, neckZ, neckZ + 0.02)[:, 1].mean())
    headZ = neckZ + 0.03 * height
    headY = float(slab(coordinates, headZ, headZ + 0.02)[:, 1].mean())

    crown = coordinates[coordinates[:, 2] > zmax - 0.01]
    crownPoint = (0.0, float(crown[:, 1].mean()), zmax)

    return {
        "height": height,
        "hips": (spinePoint[0], spinePoint[1], hipsZ),
        "spineTop": spineZ,
        "pelvisY": float(pelvisBand[:, 1].mean()),
        "neckZ": neckZ,
        "neckY": neckY,
        "headZ": headZ,
        "headY": headY,
        "crown": crownPoint,
        "shoulder": shoulderPoint,
        "elbow": elbowPoint,
        "wrist": wristPoint,
        "tip": tipPoint,
        "hip": hipPoint,
        "knee": kneePoint,
        "ankle": anklePoint,
        "ball": ballPoint,
    }


def bone_layout(landmarks):
    """Every bone's head and tail, in build order, from the measured landmarks.

    The chain is the canonical humanoid set the tooling expects: hips, three spine joints,
    neck, head and head top, then a shoulder, arm, forearm and hand and an up-leg, leg and
    foot per side. Left is +x, the side the character's own left falls on when she faces -y.
    """
    height = landmarks["height"]
    spineTop = landmarks["spineTop"]
    hips = landmarks["hips"]
    neckZ, neckY = landmarks["neckZ"], landmarks["neckY"]
    headZ, headY = landmarks["headZ"], landmarks["headY"]
    crown = landmarks["crown"]
    shoulder, elbow, wrist, tip = (
        landmarks["shoulder"],
        landmarks["elbow"],
        landmarks["wrist"],
        landmarks["tip"],
    )
    hip, knee, ankle, ball = (
        landmarks["hip"],
        landmarks["knee"],
        landmarks["ankle"],
        landmarks["ball"],
    )

    # The spine divides the hips-to-shoulder-top span into three even steps.
    spineZs = [hips[2] + (spineTop - hips[2]) * step / 3 for step in (1, 2, 3)]
    spineYs = [landmarks["pelvisY"] * (1 - step / 3) + landmarks["neckY"] * (step / 3) for step in (0, 1, 2)]

    layout = [
        (ROOT_BONE, hips, (0.0, spineYs[0], spineZs[0]), None, True),
        ("mixamorigSpine", (0.0, spineYs[0], spineZs[0]), (0.0, spineYs[1], spineZs[1]), ROOT_BONE, True),
        ("mixamorigSpine1", (0.0, spineYs[1], spineZs[1]), (0.0, spineYs[2], spineZs[2]), "mixamorigSpine", True),
        ("mixamorigSpine2", (0.0, spineYs[2], spineZs[2]), (0.0, neckY, neckZ), "mixamorigSpine1", True),
        ("mixamorigNeck", (0.0, neckY, neckZ), (0.0, headY, headZ), "mixamorigSpine2", True),
        ("mixamorigHead", (0.0, headY, headZ), crown, "mixamorigNeck", True),
        ("mixamorigHeadTop_End", crown, (crown[0], crown[1], crown[2] + 0.015), "mixamorigHead", True),
    ]
    for side, sign in (("Left", 1.0), ("Right", -1.0)):
        mirror = lambda point: (sign * point[0], point[1], point[2])
        # The clavicle spans from just off the centreline at the chest top, a fifth of the
        # shoulder joint's reach, out to the humerus head.
        clavicleHead = (sign * shoulder[0] * 0.25, landmarks["pelvisY"], spineTop)
        layout += [
            (f"mixamorig{side}Shoulder", clavicleHead, mirror(shoulder), "mixamorigSpine2", False),
            (f"mixamorig{side}Arm", mirror(shoulder), mirror(elbow), f"mixamorig{side}Shoulder", True),
            (f"mixamorig{side}ForeArm", mirror(elbow), mirror(wrist), f"mixamorig{side}Arm", True),
            (f"mixamorig{side}Hand", mirror(wrist), mirror(tip), f"mixamorig{side}ForeArm", True),
            (f"mixamorig{side}UpLeg", mirror(hip), mirror(knee), ROOT_BONE, False),
            (f"mixamorig{side}Leg", mirror(knee), mirror(ankle), f"mixamorig{side}UpLeg", True),
            (f"mixamorig{side}Foot", mirror(ankle), mirror(ball), f"mixamorig{side}Leg", True),
        ]
    return layout


def build_armature(layout, scene):
    """Create the armature object and every bone in it, with rolls that face each limb's
    bend the way a humanoid rig's do: spine and legs roll their z forward, arms and feet up.
    """
    armatureData = bpy.data.armatures.new("OwnRig")
    armature = bpy.data.objects.new("OwnRig", armatureData)
    scene.collection.objects.link(armature)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    for name, head, tail, parent, connect in layout:
        bone = armatureData.edit_bones.new(name)
        bone.head = Vector(head)
        bone.tail = Vector(tail)
        upright = name.endswith(("Shoulder", "Arm", "ForeArm", "Hand", "Foot", "HeadTop_End"))
        bone.align_roll(Vector((0.0, 0.0, 1.0)) if upright else Vector((0.0, -1.0, 0.0)))
        if parent is not None:
            bone.parent = armatureData.edit_bones[parent]
            bone.use_connect = connect
    bpy.ops.object.mode_set(mode="OBJECT")
    return armature


def skin(mesh, armature):
    """Bind the mesh with Blender's automatic weights, then hand any vertex the heat never
    reached its nearest bone: the glasses frame is a separate island in front of the face,
    disconnected from the skin the weights diffuse across, and would stay behind when the
    head turns. The fallback is the same nearest-segment rule the rig package uses.
    """
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")

    def distance_to_segment(point, head, tail):
        direction = tail - head
        lengthSquared = direction.length_squared
        if lengthSquared < 1e-12:
            return (point - head).length
        t = max(0.0, min(1.0, (point - head).dot(direction) / lengthSquared))
        return (point - (head + direction * t)).length

    segments = [(bone.name, bone.head_local.copy(), bone.tail_local.copy()) for bone in armature.data.bones]
    strays = [vertex for vertex in mesh.data.vertices if not vertex.groups]
    for vertex in strays:
        nearest = min(segments, key=lambda segment: distance_to_segment(vertex.co, segment[1], segment[2]))
        group = mesh.vertex_groups.get(nearest[0]) or mesh.vertex_groups.new(name=nearest[0])
        group.add([vertex.index], 1.0, "REPLACE")
    if strays:
        print(f"Bound {len(strays)} strays (glasses islands) to their nearest bone")


def downscale_textures(mesh):
    """Shrink the imported textures before they travel into the GLB."""
    images = {
        node.image
        for material in mesh.data.materials
        if material and material.use_nodes
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image
    }
    for image in images:
        if max(image.size) > TEXTURE_SIZE:
            image.scale(TEXTURE_SIZE, TEXTURE_SIZE)


def export_glb(mesh, armature, outputPath):
    """Write the rigged model. Every scene's selection is cleared first: a selection in
    another scene of an open file travels into the export and drags that scene's objects
    into the GLB, which for a live Blender session is somebody else's work.
    """
    previousScene = bpy.context.window.scene
    for scene in bpy.data.scenes:
        bpy.context.window.scene = scene
        bpy.ops.object.select_all(action="DESELECT")
    bpy.context.window.scene = previousScene

    mesh.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=outputPath,
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_skins=True,
        export_yup=True,
        export_apply=False,
        export_image_format="JPEG",
        export_jpeg_quality=JPEG_QUALITY,
    )


def discard_build(scene, mesh, armature):
    """Remove the scratch scene and everything the build created, leaving no trace in the
    open file: the scene first (its objects go with it), then the datablocks behind them,
    looked up by name because removing the scene retires the Python references.
    """
    materialNames = {material.name for material in mesh.data.materials if material}
    imageNames = {
        node.image.name
        for material in mesh.data.materials
        if material and material.use_nodes
        for node in material.node_tree.nodes
        if node.type == "TEX_IMAGE" and node.image
    }
    meshDataName, armatureDataName = mesh.data.name, armature.data.name

    bpy.data.scenes.remove(scene)
    bpy.data.meshes.remove(bpy.data.meshes[meshDataName])
    bpy.data.armatures.remove(bpy.data.armatures[armatureDataName])
    for name in materialNames:
        bpy.data.materials.remove(bpy.data.materials[name])
    for name in imageNames:
        bpy.data.images.remove(bpy.data.images[name])


def main():
    publicPath = public_directory()
    modelPath = os.path.join(publicPath, MODEL_FILE)
    outputPath = os.path.join(publicPath, OUTPUT_FILE)

    previousScene = bpy.context.window.scene
    scene = create_scratch_scene()

    mesh = import_stripped_mesh(modelPath)
    coordinates = np.array([vertex.co[:] for vertex in mesh.data.vertices])
    landmarks = measure_landmarks(coordinates)

    print(f"Measured landmarks for a {landmarks['height']:.4f} m figure (metres, Z-up, facing -y):")
    for name in ("hips", "shoulder", "elbow", "wrist", "tip", "hip", "knee", "ankle", "ball"):
        point = landmarks[name]
        print(f"  {name:9s} x={point[0]:+.4f}  y={point[1]:+.4f}  z={point[2]:+.4f}")

    armature = build_armature(bone_layout(landmarks), scene)
    skin(mesh, armature)
    downscale_textures(mesh)
    export_glb(mesh, armature, outputPath)
    print(f"Wrote {outputPath} ({os.path.getsize(outputPath) / 1e6:.2f} MB)")

    discard_build(scene, mesh, armature)
    bpy.context.window.scene = previousScene


if __name__ == "__main__":
    main()
