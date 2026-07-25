"""
Genera tutte le icone PNG di Stream8 (PWA + favicon) a partire dallo stesso
design vettoriale usato in icon.svg: sfondo scuro con leggero gradiente,
anello sottile, triangolo "play" in gradiente teal/acquamarina.

Renderizzato direttamente in pixel con Pillow (nessuna dipendenza da
librerie di rasterizzazione SVG come cairo, non sempre disponibili).
"""
import numpy as np
from PIL import Image, ImageDraw

OUT_DIR = "/home/claude/stream8/public/icons"

BG_TOP = (27, 33, 31)      # #1B211F
BG_BOTTOM = (10, 18, 17)   # #0A1211
RING_COLOR = (79, 209, 197)  # #4FD1C5
PLAY_TOP = (140, 229, 219)   # #8CE5DB
PLAY_BOTTOM = (15, 139, 141)  # #0F8B8D

SUPERSAMPLE = 4  # antialiasing: renderizza a risoluzione maggiore poi ridimensiona


def diagonal_gradient(size, color_a, color_b):
    """Gradiente lineare diagonale (in stile CSS linear-gradient 135deg)."""
    h, w = size, size
    y, x = np.mgrid[0:h, 0:w]
    t = (x.astype(np.float32) + y.astype(np.float32)) / (2 * (size - 1))
    t = np.clip(t, 0, 1)[..., None]
    color_a = np.array(color_a, dtype=np.float32)
    color_b = np.array(color_b, dtype=np.float32)
    grad = (color_a * (1 - t) + color_b * t).astype(np.uint8)
    return Image.fromarray(grad, mode="RGB")


def rounded_rect_mask(size, radius_ratio):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    radius = int(size * radius_ratio)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def draw_icon(px, maskable=False, background=True):
    """Disegna l'icona a `px` pixel finali. Se maskable=True, applica il
    padding di sicurezza richiesto dalle icone adattive Android (il
    contenuto deve stare in un cerchio centrale con diametro ~80%)."""
    S = px * SUPERSAMPLE

    bg = diagonal_gradient(S, BG_TOP, BG_BOTTOM).convert("RGBA")

    if background:
        # Icone standard: sfondo "squircle" con angoli arrotondati.
        # Icone maskable: sfondo full-bleed (l'OS applica la propria maschera).
        if not maskable:
            mask = rounded_rect_mask(S, radius_ratio=115 / 512)
            canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
            canvas.paste(bg, (0, 0), mask)
        else:
            canvas = bg
    else:
        canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

    draw = ImageDraw.Draw(canvas)

    # Scala del contenuto (anello + triangolo): ridotta per le maskable per
    # restare nella safe zone centrale richiesta dalle piattaforme Android.
    content_scale = 0.62 if maskable else 1.0
    cx = cy = S / 2

    # Anello sottile
    ring_r = 176 / 512 * S * content_scale
    ring_w = max(1, int(10 / 512 * S * content_scale))
    draw.ellipse(
        [cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
        outline=RING_COLOR + (64,),
        width=ring_w,
    )

    # Triangolo "play" con gradiente verticale, applicato via maschera
    tri_points = np.array([[208, 158], [368, 256], [208, 354]], dtype=np.float32)
    tri_points = (tri_points - 256) * content_scale + 256
    tri_points = tri_points / 512 * S
    tri_points = [tuple(p) for p in tri_points]

    tri_mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(tri_mask).polygon(tri_points, fill=255)
    tri_grad = diagonal_gradient(S, PLAY_TOP, PLAY_BOTTOM).convert("RGBA")
    canvas.paste(tri_grad, (0, 0), tri_mask)

    return canvas.resize((px, px), Image.LANCZOS)


def save(img, name):
    path = f"{OUT_DIR}/{name}"
    img.save(path)
    print("saved", path, img.size)


if __name__ == "__main__":
    # Icone "any" (uso generale: manifest, favicon, apple-touch-icon)
    for size in [16, 32, 48, 72, 96, 128, 144, 152, 180, 192, 384, 512]:
        save(draw_icon(size, maskable=False), f"icon-{size}.png")

    # Icone "maskable" per Android adaptive icons (con safe zone)
    for size in [192, 512]:
        save(draw_icon(size, maskable=True), f"icon-{size}-maskable.png")

    # apple-touch-icon: stessa immagine di icon-180, nome convenzionale,
    # SENZA trasparenza (iOS ignora l'alpha e mostra il nero al suo posto).
    apple = draw_icon(180, maskable=False).convert("RGBA")
    apple_flat = Image.new("RGB", apple.size, BG_TOP)
    apple_flat.paste(apple, (0, 0), apple)
    save(apple_flat, "apple-touch-icon.png")

    # favicon.ico multi-risoluzione (16/32/48), per i browser/tab legacy
    ico_sizes = [16, 32, 48]
    ico_images = [draw_icon(s, maskable=False) for s in ico_sizes]
    ico_images[0].save(
        f"{OUT_DIR}/favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in ico_sizes],
        append_images=ico_images[1:],
    )
    print("saved", f"{OUT_DIR}/favicon.ico")
