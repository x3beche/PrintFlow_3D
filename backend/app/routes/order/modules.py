import trimesh
import matplotlib
matplotlib.use('Agg')  # GUI olmadan çalışması için
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import io
from PIL import Image

def stl_to_png_bytes(
    stl_content: bytes,
    figsize=(8, 8),
    dpi=150
) -> bytes:
    """
    Convert STL bytes to PNG bytes for frontend display
    Returns PNG image as bytes
    """
    try:
        # Load mesh from bytes
        mesh = trimesh.load(
            io.BytesIO(stl_content),
            file_type='stl'
        )
        
        vertices = mesh.vertices
        faces = mesh.faces
        
        # Create figure
        fig = plt.figure(figsize=figsize)
        fig.patch.set_facecolor('#171717')  # neutral-900
        ax = fig.add_subplot(111, projection='3d')
        ax.set_facecolor('#171717')
        
        # Plot mesh
        ax.plot_trisurf(
            vertices[:, 0],
            vertices[:, 1],
            faces,
            vertices[:, 2],
            color='#facc15',  # yellow-400 (matches your theme)
            edgecolor='none',
            alpha=1.0,
            shade=True,
            lightsource=matplotlib.colors.LightSource(azdeg=315, altdeg=45)
        )
        
        # Camera angle
        ax.view_init(elev=25, azim=-45)
        ax.set_axis_off()
        
        # Auto scale
        ax.auto_scale_xyz(
            vertices[:, 0],
            vertices[:, 1],
            vertices[:, 2]
        )
        
        # Save to bytes
        buf = io.BytesIO()
        plt.savefig(
            buf,
            format='png',
            dpi=dpi,
            bbox_inches='tight',
            pad_inches=0,
            facecolor=fig.get_facecolor(),
            transparent=False
        )
        buf.seek(0)
        plt.close(fig)
        
        return buf.read()
        
    except Exception as e:
        print(f"STL to PNG conversion error: {e}")
        import traceback
        traceback.print_exc()
        return None