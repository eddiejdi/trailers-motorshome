import bpy
import os

# Keep only meshes
for obj in list(bpy.data.objects):
    if obj.type != "MESH":
        bpy.data.objects.remove(obj, do_unlink=True)

bpy.ops.object.select_all(action="DESELECT")
for obj in bpy.data.objects:
    if obj.type == "MESH":
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# Clean materials: single Principled BSDF -> Material Output, force exportable values
for mat in bpy.data.materials:
    if not mat.use_nodes:
        mat.use_nodes = True
    nt = mat.node_tree
    # remove all nodes except keep one of each type we need
    keep = None
    for n in list(nt.nodes):
        if n.type == "BSDF_PRINCIPLED" and keep is None:
            keep = n
        else:
            nt.nodes.remove(n)
    bsdf = keep
    if bsdf is None:
        bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    nt.nodes.active = out
    # force sockets that glTF reads
    bsdf.inputs["Metallic"].default_value = float(bsdf.inputs["Metallic"].default_value)
    bsdf.inputs["Roughness"].default_value = float(bsdf.inputs["Roughness"].default_value)
    # touch Base Color to mark as used
    _ = bsdf.inputs["Base Color"].default_value
    print(
        "mat",
        mat.name,
        "color",
        list(bsdf.inputs["Base Color"].default_value)[:3],
        "metal",
        bsdf.inputs["Metallic"].default_value,
        "rough",
        bsdf.inputs["Roughness"].default_value,
        "nodes",
        [n.type for n in nt.nodes],
    )

out_path = "/home/edenilson/trailers-motorshome/assets/models/hb20.glb"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=out_path,
    export_format="GLB",
    use_selection=False,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_texcoords=True,
    export_normals=True,
    export_tangents=False,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
)
print("EXPORTED", out_path, os.path.getsize(out_path))
