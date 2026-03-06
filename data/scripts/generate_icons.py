"""
Generate tabBar and UI icons for LearnE miniprogram.
WeChat tabBar icons: 81x81px PNG with transparency.
UI icons: 64x64px PNG with transparency.
"""
from PIL import Image, ImageDraw
import math
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'miniprogram', 'images')
os.makedirs(OUTPUT_DIR, exist_ok=True)

COLOR_INACTIVE = (153, 153, 153, 255)   # #999999
COLOR_ACTIVE = (74, 144, 217, 255)      # #4A90D9
COLOR_WHITE = (255, 255, 255, 255)
COLOR_GREEN = (82, 196, 26, 255)        # #52C41A


def draw_home(size=81, color=COLOR_INACTIVE):
    """Home icon: house shape with door."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    # Roof (triangle)
    roof = [(s * 0.5, s * 0.12), (s * 0.12, s * 0.45), (s * 0.88, s * 0.45)]
    d.polygon(roof, fill=color)
    # Body (rectangle)
    d.rectangle([s * 0.2, s * 0.45, s * 0.8, s * 0.85], fill=color)
    # Door (cutout)
    d.rectangle([s * 0.38, s * 0.55, s * 0.62, s * 0.85], fill=(0, 0, 0, 0))
    return img


def draw_stats(size=81, color=COLOR_INACTIVE):
    """Stats icon: bar chart with 3 bars."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    bar_w = s * 0.18
    gap = s * 0.06
    # 3 bars of different heights
    bars = [
        (0.55, 0.18),  # left bar: height ratio, x offset
        (0.35, 0.41),  # middle bar
        (0.7, 0.64),   # right bar (tallest)
    ]
    base_y = s * 0.85
    for height_ratio, x_off in bars:
        x1 = s * x_off
        y1 = base_y - s * height_ratio
        d.rounded_rectangle([x1, y1, x1 + bar_w, base_y], radius=s * 0.04, fill=color)
    return img


def draw_settings(size=81, color=COLOR_INACTIVE):
    """Settings icon: gear shape."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    # Outer gear teeth
    r_outer = size * 0.42
    r_mid = size * 0.34
    r_inner_hole = size * 0.15
    teeth = 8
    points = []
    for i in range(teeth * 2):
        angle = math.pi * 2 * i / (teeth * 2) - math.pi / 2
        r = r_outer if i % 2 == 0 else r_mid
        points.append((cx + r * math.cos(angle), cy + r * math.sin(angle)))
    d.polygon(points, fill=color)
    # Center hole
    d.ellipse([cx - r_inner_hole, cy - r_inner_hole,
               cx + r_inner_hole, cy + r_inner_hole], fill=(0, 0, 0, 0))
    return img


def draw_play(size=64, color=COLOR_ACTIVE):
    """Play icon: triangle pointing right in circle."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    # Circle background
    d.ellipse([s * 0.02, s * 0.02, s * 0.98, s * 0.98], fill=color)
    # Play triangle (white)
    tri = [(s * 0.38, s * 0.22), (s * 0.38, s * 0.78), (s * 0.78, s * 0.5)]
    d.polygon(tri, fill=COLOR_WHITE)
    return img


def draw_pause(size=64, color=COLOR_ACTIVE):
    """Pause icon: two vertical bars in circle."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    # Circle background
    d.ellipse([s * 0.02, s * 0.02, s * 0.98, s * 0.98], fill=color)
    # Two pause bars (white)
    bar_w = s * 0.12
    d.rounded_rectangle([s * 0.3, s * 0.25, s * 0.3 + bar_w, s * 0.75],
                         radius=s * 0.03, fill=COLOR_WHITE)
    d.rounded_rectangle([s * 0.58, s * 0.25, s * 0.58 + bar_w, s * 0.75],
                         radius=s * 0.03, fill=COLOR_WHITE)
    return img


def draw_complete(size=64, color=COLOR_GREEN):
    """Complete icon: checkmark in circle."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    # Circle background
    d.ellipse([s * 0.02, s * 0.02, s * 0.98, s * 0.98], fill=color)
    # Checkmark (white, thick line)
    check_points = [(s * 0.25, s * 0.5), (s * 0.42, s * 0.68), (s * 0.75, s * 0.32)]
    d.line(check_points, fill=COLOR_WHITE, width=max(int(s * 0.1), 3), joint='curve')
    return img


def main():
    icons = {
        'tab_home.png': lambda: draw_home(81, COLOR_INACTIVE),
        'tab_home_active.png': lambda: draw_home(81, COLOR_ACTIVE),
        'tab_stats.png': lambda: draw_stats(81, COLOR_INACTIVE),
        'tab_stats_active.png': lambda: draw_stats(81, COLOR_ACTIVE),
        'tab_settings.png': lambda: draw_settings(81, COLOR_INACTIVE),
        'tab_settings_active.png': lambda: draw_settings(81, COLOR_ACTIVE),
        'icon_play.png': lambda: draw_play(64, COLOR_ACTIVE),
        'icon_pause.png': lambda: draw_pause(64, COLOR_ACTIVE),
        'icon_complete.png': lambda: draw_complete(64, COLOR_GREEN),
    }
    for name, gen_fn in icons.items():
        path = os.path.join(OUTPUT_DIR, name)
        img = gen_fn()
        img.save(path, 'PNG')
        print(f'  Generated: {name} ({img.size[0]}x{img.size[1]})')

    print(f'\nAll {len(icons)} icons saved to {os.path.abspath(OUTPUT_DIR)}')


if __name__ == '__main__':
    main()
