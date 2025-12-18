import trimesh
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import io
import numpy as np

def stl_to_png_bytes(
    stl_content: bytes,
    figsize=(12, 12),
    dpi=200
) -> bytes:
    """
    STL rendering with bg-neutral-800/50 background (Tailwind color)
    """
    try:
        # Load mesh
        mesh = trimesh.load(
            io.BytesIO(stl_content),
            file_type='stl'
        )
        
        # Simplify if needed
        if len(mesh.faces) > 50000:
            mesh = mesh.simplify_quadric_decimation(face_count=50000)
        
        mesh.merge_vertices()
        mesh.fix_normals()
        
        vertices = mesh.vertices
        faces = mesh.faces
        
        # Center mesh
        vertices = vertices - vertices.mean(axis=0)
        
        # Calculate face normals
        face_normals = mesh.face_normals
        
        # Light direction (normalized)
        light_direction = np.array([0.5, 0.5, 0.7])
        light_direction = light_direction / np.linalg.norm(light_direction)
        
        # Calculate shading (dot product with light)
        shading = np.dot(face_normals, light_direction)
        shading = np.clip(shading, 0.3, 1.0)  # Ambient + diffuse
        
        # Base color (yellow #facc15)
        base_color = np.array([250/255, 204/255, 21/255])
        
        # Apply shading to color
        face_colors = shading[:, np.newaxis] * base_color
        face_colors = np.clip(face_colors, 0, 1)
        
        # Tailwind bg-neutral-800/50 = rgba(38, 38, 38, 0.5)
        # For solid background: #262626
        bg_color = '#262626'
        
        # Create figure with neutral-800 background
        fig = plt.figure(figsize=figsize, facecolor=bg_color)
        ax = fig.add_subplot(111, projection='3d')
        ax.set_facecolor(bg_color)
        
        # Build triangles
        triangles = vertices[faces]
        
        # Create collection with per-face colors
        collection = Poly3DCollection(
            triangles,
            facecolors=face_colors,
            edgecolors='none',
            linewidths=0,
            alpha=1.0,
            shade=False
        )
        
        ax.add_collection3d(collection)
        
        # Set limits
        max_range = np.array([
            vertices[:, 0].max() - vertices[:, 0].min(),
            vertices[:, 1].max() - vertices[:, 1].min(),
            vertices[:, 2].max() - vertices[:, 2].min()
        ]).max() / 2.0
        
        mid_x = (vertices[:, 0].max() + vertices[:, 0].min()) * 0.5
        mid_y = (vertices[:, 1].max() + vertices[:, 1].min()) * 0.5
        mid_z = (vertices[:, 2].max() + vertices[:, 2].min()) * 0.5
        
        ax.set_xlim(mid_x - max_range, mid_x + max_range)
        ax.set_ylim(mid_y - max_range, mid_y + max_range)
        ax.set_zlim(mid_z - max_range, mid_z + max_range)
        
        ax.set_box_aspect([1, 1, 1])
        ax.view_init(elev=30, azim=-60)
        ax.set_axis_off()
        ax.grid(False)
        
        plt.tight_layout(pad=0)
        
        # Save with neutral-800 background
        buf = io.BytesIO()
        plt.savefig(
            buf,
            format='png',
            dpi=dpi,
            bbox_inches='tight',
            pad_inches=0,
            facecolor=bg_color,  # Tailwind neutral-800
            transparent=False
        )
        buf.seek(0)
        plt.close(fig)
        
        return buf.read()
        
    except Exception as e:
        print(f"STL rendering error: {e}")
        import traceback
        traceback.print_exc()
        return None