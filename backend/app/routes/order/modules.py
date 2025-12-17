import trimesh
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D

def stl_to_png_single_view(
    stl_path: str,
    png_path: str,
    figsize=(8, 8),
    dpi=300
):

    mesh = trimesh.load(stl_path)

    vertices = mesh.vertices
    faces = mesh.faces

    fig = plt.figure(figsize=figsize)
    fig.patch.set_facecolor('#2b2b2b') 

    ax = fig.add_subplot(111, projection='3d')
    ax.set_facecolor('#2b2b2b')

    ax.plot_trisurf(
        vertices[:, 0],
        vertices[:, 1],
        faces,
        vertices[:, 2],
        color='darkorange',
        edgecolor='none',
        alpha=1.0,
        shade=True
    )

    ax.view_init(elev=25, azim=-45)

    ax.set_axis_off()

    ax.auto_scale_xyz(
        vertices[:, 0],
        vertices[:, 1],
        vertices[:, 2]
    )

    plt.savefig(
        png_path,
        dpi=dpi,
        bbox_inches='tight',
        pad_inches=0,
        facecolor=fig.get_facecolor()
    )
    plt.close(fig)

    print(f"PNG olarak kaydedildi: {png_path}")

# stl_to_png_single_view("HC-SR04.stl", "model_render.png")
