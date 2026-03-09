This file is a merged representation of a subset of the codebase, containing files not matching ignore patterns, combined into a single document by Repomix.

================================================================
File Summary
================================================================

## Purpose:

This file contains a packed representation of the entire repository's contents.
It is designed to be easily consumable by AI systems for analysis, code review,
or other automated processes.

## File Format:

The content is organized as follows:

1. This summary section
2. Repository information
3. Directory structure
4. Multiple file entries, each consisting of:
   a. A separator line (================)
   b. The file path (File: path/to/file)
   c. Another separator line
   d. The full contents of the file
   e. A blank line

## Usage Guidelines:

- This file should be treated as read-only. Any changes should be made to the
  original repository files, not this packed version.
- When processing this file, use the file path to distinguish
  between different files in the repository.
- Be aware that this file may contain sensitive information. Handle it with
  the same level of security as you would the original repository.

## Notes:

- Some files may have been excluded based on .gitignore rules and Repomix's configuration
- Binary files are not included in this packed representation. Please refer to the Repository Structure section for a complete list of file paths, including binary files
- Files matching these patterns are excluded: .github/, CLAUDE.md, AGENTS.md, GEMINI.md
- Files matching patterns in .gitignore are excluded
- Files matching default ignore patterns are excluded

## Additional Info:

================================================================
Directory Structure
================================================================
src/
test/
debug_layout.py
panel_flux_aggregator.py
config.py
layout_compiler.py
main.py
solar_api.py
tif_to_png.py
utils.py
.env.example
.gitignore
README.md
requirements.txt

================================================================
Files
================================================================

================
File: src/test/debug_layout.py
================

# src/test/debug_layout.py

import json
import math
from pathlib import Path
import rasterio
import pyproj

from panel_flux_aggregator import calculate_average_flux_for_panel

# NOTE: Change these constants as needed for different test runs

PANELS_TO_TEST = 63
DATA_FOLDER_TIMESTAMP = "20260302_191246"

def rotate_point(origin, point, angle_rad):
ox, oy = origin; px, py = point
qx = ox + math.cos(angle_rad) _ (px - ox) - math.sin(angle_rad) _ (py - oy)
qy = oy + math.sin(angle_rad) _ (px - ox) + math.cos(angle_rad) _ (py - oy)
return qx, qy

def run_debug():
print("=" _ 80)
print("SOLAR PANEL ENERGY VALIDATION: AREA-AVERAGE METHOD")
print("=" _ 80)

    # Path setup
    base_dir = Path(__file__).resolve().parent.parent.parent
    folder_path = base_dir / "data" / DATA_FOLDER_TIMESTAMP
    insights_path = folder_path / "buildingInsights.json"
    ref_tif_path = folder_path / "rgb.tif"
    if not ref_tif_path.exists(): ref_tif_path = folder_path / "dsm.tif"
    flux_tif_path = folder_path / "annual_flux.tif"

    # Validation
    if not all([insights_path.exists(), ref_tif_path.exists(), flux_tif_path.exists()]):
        print("❌ ERROR: Missing required files (insights, reference TIF, or flux TIF).")
        return

    print(f"✅ Found all necessary files for folder '{DATA_FOLDER_TIMESTAMP}'")

    # Load data
    with open(insights_path) as f: insights = json.load(f)
    with rasterio.open(ref_tif_path) as src: transform, tif_crs = src.transform, src.crs
    with rasterio.open(flux_tif_path) as flux_src: flux_band = flux_src.read(1)

    solar_potential = insights.get("solarPotential", {})
    panels = solar_potential.get("solarPanels", [])
    panel_capacity_watts = solar_potential.get("panelCapacityWatts")
    panel_w_m = solar_potential.get("panelWidthMeters")
    panel_h_m = solar_potential.get("panelHeightMeters")
    segments = solar_potential.get("roofSegmentStats", [])

    transformer = pyproj.Transformer.from_crs("EPSG:4326", tif_crs, always_xy=True)
    pixel_width_m = transform.a
    panel_w_px = panel_w_m / pixel_width_m
    panel_h_px = panel_h_m / pixel_width_m

    sample_count = min(PANELS_TO_TEST, len(panels))
    print(f"Analyzing {sample_count} of {len(panels)} total panels")
    print(f"Panel Capacity: {panel_capacity_watts}W | Dimensions: {panel_w_m:.3f}m × {panel_h_m:.3f}m")
    print("-" * 80)

    differences = []
    absolute_errors = []

    for idx, panel in enumerate(panels[:sample_count], start=1):
        center_lon, center_lat = panel["center"]["longitude"], panel["center"]["latitude"]
        projected_x, projected_y = transformer.transform(center_lon, center_lat)
        row, col = rasterio.transform.rowcol(transform, projected_x, projected_y)
        px, py = col, row

        original_kwh = panel.get("yearlyEnergyDcKwh")

        # Calculate panel polygon with rotation
        orientation = 90 if panel.get("orientation") == "PORTRAIT" else 0
        azimuth = segments[panel["segmentIndex"]].get("azimuthDegrees", 0)
        rotation_rad = math.radians(90 - (azimuth + orientation))
        w_half, h_half = panel_w_px / 2, panel_h_px / 2
        corners = [(-w_half, -h_half), (w_half, -h_half), (w_half, h_half), (-w_half, h_half)]
        rotated_corners = [rotate_point((px, py), (px + x, py + y), rotation_rad) for x, y in corners]

        # Area-average flux calculation
        avg_flux_value = calculate_average_flux_for_panel(rotated_corners, flux_band)
        calculated_kwh = avg_flux_value * (panel_capacity_watts / 1000.0)

        # Calculate error metrics
        abs_diff = calculated_kwh - original_kwh
        pct_diff = (abs(abs_diff) / original_kwh) * 100

        differences.append(pct_diff)
        absolute_errors.append(abs_diff)

        # Compact per-panel output
        sign = "+" if abs_diff > 0 else ""
        print(f"Panel {idx:2d}: JSON={original_kwh:6.2f} kWh | Calculated={calculated_kwh:6.2f} kWh | "
              f"Error={sign}{abs_diff:5.2f} kWh ({pct_diff:5.2f}%)")

    # Calculate summary statistics
    avg_pct_error = sum(differences) / len(differences)
    max_pct_error = max(differences)
    min_pct_error = min(differences)
    avg_abs_error = sum(absolute_errors) / len(absolute_errors)

    print("\n" + "=" * 80)
    print("VALIDATION SUMMARY")
    print("=" * 80)
    print(f"Total Panels Analyzed:        {len(differences)}")
    print(f"Average Percent Error:        {avg_pct_error:.4f}%")
    print(f"Min Percent Error:            {min_pct_error:.4f}%")
    print(f"Max Percent Error:            {max_pct_error:.4f}%")
    print(f"Average Absolute Error:       {avg_abs_error:+.2f} kWh")
    print("-" * 80)

    # Count panels within different error thresholds
    within_1pct = sum(1 for d in differences if d < 1.0)
    within_2pct = sum(1 for d in differences if d < 2.0)
    within_5pct = sum(1 for d in differences if d < 5.0)

    print("ERROR DISTRIBUTION:")
    print(f"  Within 1.0% error:          {within_1pct}/{len(differences)} panels ({within_1pct/len(differences)*100:.1f}%)")
    print(f"  Within 2.0% error:          {within_2pct}/{len(differences)} panels ({within_2pct/len(differences)*100:.1f}%)")
    print(f"  Within 5.0% error:          {within_5pct}/{len(differences)} panels ({within_5pct/len(differences)*100:.1f}%)")
    print("-" * 80)

    # Final verdict
    if avg_pct_error < 0.5:
        print("✅ EXCELLENT: Area-average method matches Google's values with <0.5% error")
    elif avg_pct_error < 1.0:
        print("✅ VERY GOOD: Area-average method achieves <1.0% average error")
    elif avg_pct_error < 2.0:
        print("✅ GOOD: Area-average method achieves <2.0% average error")
    else:
        print("⚠️  REVIEW NEEDED: Average error exceeds 2.0%")

    print("=" * 80)

if **name** == "**main**":
run_debug()

================
File: src/test/panel_flux_aggregator.py
================

# src/test/panel_flux_aggregator.py

import numpy as np

def point_in_polygon(x: float, y: float, polygon: list[tuple[float, float]]) -> bool:
"""
Check if a point is inside a polygon using the Ray Casting algorithm.

    @args: x, y (point coords), polygon (list of corner tuples)
    @return: True if point is inside polygon
    """
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def calculate_average_flux_for_panel(
rotated_corners: list[tuple[float, float]],
flux_band: np.ndarray
) -> float:
"""
Compute the average flux within a panel footprint using integer-pixel sampling.

    @args: rotated_corners (list of pixel coords), flux_band (2D numpy array)
    @return: average flux value (kWh/kW/year)
    """
    # Find the bounding box of the rotated panel
    min_x = int(min(c[0] for c in rotated_corners))
    max_x = int(max(c[0] for c in rotated_corners))
    min_y = int(min(c[1] for c in rotated_corners))
    max_y = int(max(c[1] for c in rotated_corners))

    # Clip the bounding box to the dimensions of the flux map
    map_height, map_width = flux_band.shape
    min_x = max(0, min_x)
    max_x = min(map_width - 1, max_x)
    min_y = max(0, min_y)
    max_y = min(map_height - 1, max_y)

    flux_values = []

    # Iterate through every pixel in the bounding box
    for y in range(min_y, max_y + 1):
        for x in range(min_x, max_x + 1):
            # Check if the pixel center is inside the panel polygon
            if point_in_polygon(x + 0.5, y + 0.5, rotated_corners):
                flux_values.append(flux_band[y, x])

    # Calculate the average of the collected flux values
    if not flux_values:
        return 0.0
    return float(sum(flux_values) / len(flux_values))

================
File: src/config.py
================

# src/config.py

API_BASE = "https://solar.googleapis.com/v1"

VALID_VIEWS = {
"BASIC": "IMAGERY_AND_ANNUAL_FLUX_LAYERS",
"FULL": "FULL_LAYERS",
}

DEFAULT_REQUIRED_QUALITY = "BASE"
DEFAULT_VIEW_INPUT = "BASIC"
DEFAULT_RADIUS_METERS = 120
DEFAULT_PIXEL_SIZE_METERS = None

HTTP_TIMEOUT = 40
HTTP_RETRIES = 2
RETRY_SLEEP = 1.2

URL_FIELDS = {
"dsmUrl": "dsm.tif",
"rgbUrl": "rgb.tif",
"maskUrl": "mask.tif",
"annualFluxUrl": "annual_flux.tif",
"monthlyFluxUrl": "monthly_flux.tif",
}

================
File: src/layout_compiler.py
================

# src/layout_compiler.py

import json
import math
from pathlib import Path

import rasterio
from PIL import Image, ImageDraw
import pyproj

from utils import log

def rotate_point(origin, point, angle_rad):
"""
Rotate a 2D point counterclockwise around an origin by angle_rad.

    @args: origin, point, angle_rad
    @return: rotated (x, y) tuple
    """

    ox, oy = origin
    px, py = point
    qx = ox + math.cos(angle_rad) * (px - ox) - math.sin(angle_rad) * (py - oy)
    qy = oy + math.sin(angle_rad) * (px - ox) + math.cos(angle_rad) * (py - oy)
    return qx, qy

def compile_layout(folder_path: Path):
"""
Overlay predicted solar panel layouts onto PNG tiles in a data folder.

    @args: folder_path (Path)
    @return: None
    """
    insights_path = folder_path / "buildingInsights.json"
    png_dir = folder_path / "png"
    compiled_dir = folder_path / "compiled"

    ref_tif_path = folder_path / "rgb.tif"
    if not ref_tif_path.exists():
        ref_tif_path = folder_path / "dsm.tif"

    if not insights_path.exists():
        log(f"⚠️ buildingInsights.json not found in {folder_path}. Skipping.")
        return
    if not png_dir.exists() or not any(png_dir.iterdir()):
        log(f"⚠️ No PNGs found in {png_dir}. Run TIFF conversion first. Skipping.")
        return
    if not ref_tif_path.exists():
        log(f"⚠️ Reference GeoTIFF (rgb.tif or dsm.tif) not found. Skipping.")
        return

    compiled_dir.mkdir(exist_ok=True)
    log(f"⏳ Outputting compiled images to: {compiled_dir}")

    with open(insights_path) as f:
        insights = json.load(f)

    with rasterio.open(ref_tif_path) as src:
        transform = src.transform
        tif_crs = src.crs

    wgs84_crs = "EPSG:4326"
    transformer = pyproj.Transformer.from_crs(wgs84_crs, tif_crs, always_xy=True)

    solar_potential = insights.get("solarPotential", {})
    panels = solar_potential.get("solarPanels", [])
    if not panels:
        log("⚠️ No solar panel data found in insights file.")
        return

    panel_w_m = solar_potential.get("panelWidthMeters")
    panel_h_m = solar_potential.get("panelHeightMeters")
    pixel_width_m = transform.a
    panel_w_px = panel_w_m / pixel_width_m
    panel_h_px = panel_h_m / pixel_width_m

    all_png_files = sorted(list(png_dir.rglob("*.png")))
    if not all_png_files:
        log(f"⚠️ No PNG files found in {png_dir} or its subdirectories.")
        return

    for png_path in all_png_files:
        relative_path = png_path.relative_to(png_dir)
        output_path = compiled_dir / relative_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        log(f"⏳ Processing {relative_path}...")
        img = Image.open(png_path).convert("RGBA")
        draw = ImageDraw.Draw(img)

        for panel in panels:
            center_lon, center_lat = panel["center"]["longitude"], panel["center"]["latitude"]
            projected_x, projected_y = transformer.transform(center_lon, center_lat)

            # Use the robust rowcol method to get pixel coordinates
            row, col = rasterio.transform.rowcol(transform, projected_x, projected_y)
            px, py = col, row # Convert (row, col) to (x, y) for drawing

            segments = solar_potential.get("roofSegmentStats", [])
            orientation_angle = 90 if panel.get("orientation") == "PORTRAIT" else 0
            azimuth_angle = segments[panel["segmentIndex"]].get("azimuthDegrees", 0)
            total_rotation_deg = 90 - (azimuth_angle + orientation_angle)
            # Negate rotation for image coordinate system (Y-axis inverted)
            total_rotation_rad = math.radians(-total_rotation_deg)

            w_px_half, h_px_half = panel_w_px / 2, panel_h_px / 2
            corners = [
                (-w_px_half, -h_px_half), (w_px_half, -h_px_half),
                (w_px_half, h_px_half), (-w_px_half, h_px_half),
            ]

            rotated_corners = [rotate_point((px, py), (px + x, py + y), total_rotation_rad) for x, y in corners]

            draw.polygon(rotated_corners, fill=(0, 150, 255, 128), outline=(255, 255, 255, 200))

        img.save(output_path)

    log(f"✅ Successfully processed {len(all_png_files)} images.")

================
File: src/main.py
================

# src/main.py

import sys
import json
import math
import textwrap
from pathlib import Path

from config import (
VALID_VIEWS,
DEFAULT_REQUIRED_QUALITY,
DEFAULT_VIEW_INPUT,
DEFAULT_PIXEL_SIZE_METERS,
)
from solar_api import (
read_api_key,
build_datalayers_url,
build_building_insights_url,
http_get_json,
download_geo_tiffs,
geocode_address,
)
from utils import (
log,
now_local_str,
ensure_dir,
prompt_int,
prompt_str,
calculate_haversine_distance,
clear_screen,
)

# Import the new compiler function at the top

try:
from layout_compiler import compile_layout
except ImportError:
compile_layout = None

def display_main_menu():
"""
Display the main menu choices to the user.

    @args: None
    @return: None
    """

    log("=" * 60)
    log("Solar Layout Assessment App")
    log("=" * 60)
    log("1. Find Buildings")
    log("2. Convert TIFF to PNG")
    log("3. Compile Solar Layout")
    log("4. Exit")
    log()

def get_user_input(api_key: str) -> dict:
"""
Prompt the user for a location and related options.

    @args: api_key
    @return: dict with lat, lng, required_quality, view_choice, expanded_cov
    """

    selected_location = None
    while not selected_location:
        try:
            query = prompt_str("Enter a location to search for (or 'exit'): ")
            if query.lower() == 'exit':
                raise KeyboardInterrupt

            locations = geocode_address(query, api_key)

            if not locations:
                log("    No results found. Please try another search term.")
                continue

            log("Please choose a location:")
            for i, loc in enumerate(locations[:8]):
                log(f"  {i+1}. {loc['address']}")

            back_option = len(locations[:8]) + 1
            exit_option = back_option + 1
            log(f"  {back_option}. Search Again")
            log(f"  {exit_option}. Exit")

            choice = prompt_int(f"Enter your choice [1-{exit_option}]: ")

            if 1 <= choice <= len(locations[:8]):
                selected_location = locations[choice - 1]
                break
            elif choice == back_option:
                continue
            elif choice == exit_option:
                raise KeyboardInterrupt
            else:
                log("Invalid choice, please try again.")

        except ValueError:
            log("Invalid input. Please enter a number.")
        except KeyboardInterrupt:
            raise
        except Exception as e:
            log(f"An error occurred during search: {e}")

    log(f"\nSelected: {selected_location['address']}")
    log(f"    Lat: {selected_location['lat']}, Lng: {selected_location['lng']}")

    req_quality = prompt_str(
        "Enter required quality [HIGH/MEDIUM/BASE] (default: BASE): ",
        DEFAULT_REQUIRED_QUALITY,
        {"HIGH", "MEDIUM", "BASE"}
    )

    view_choice = prompt_str(
        "Enter view level [BASIC/FULL] (default: BASIC): ",
        DEFAULT_VIEW_INPUT,
        {"BASIC", "FULL"}
    )

    expanded_cov = prompt_str("Enable expanded coverage? [y/N]: ", "N", {"y", "Y", "n", "N"}) in {"y", "Y"}

    return {
        "lat": selected_location['lat'],
        "lng": selected_location['lng'],
        "required_quality": req_quality,
        "view_choice": view_choice,
        "expanded_cov": expanded_cov,
    }

def find_buildings(api_key: str):
"""
Run the workflow that queries building insights, datalayers, and downloads GeoTIFFs.

    @args: api_key
    @return: None
    """

    out_dir = None
    success = False

    try:
        user = get_user_input(api_key=api_key)
        stamp = now_local_str()
        out_dir = ensure_dir(Path(__file__).resolve().parent.parent / "data" / stamp)
        log("\n" + "=" * 60 + "\n")
        log(f"Output directory: {out_dir}\n")

        bi_url = build_building_insights_url(
            lat=user["lat"],
            lng=user["lng"],
            expanded_cov=user["expanded_cov"],
            required_quality=user["required_quality"],
        )
        log(f"[1/4] Requesting buildingInsights to determine area: {bi_url}")
        bi_json = http_get_json(bi_url, api_key=api_key)
        with open(out_dir / "buildingInsights.json", "w", encoding="utf-8") as f:
            json.dump(bi_json, f, indent=2)
        log("    Saved buildingInsights.json")

        bbox = bi_json.get("boundingBox")
        if not bbox:
            raise RuntimeError("Could not find boundingBox in buildingInsights response.")

        sw = bbox["sw"]
        ne = bbox["ne"]
        diameter = calculate_haversine_distance(sw["latitude"], sw["longitude"], ne["latitude"], ne["longitude"])
        radius_m = math.ceil(diameter / 2) + 10
        log(f"    Dynamically calculated radius: {radius_m}m")

        view_enum = VALID_VIEWS[user["view_choice"]]
        datalayers_url = build_datalayers_url(
            lat=user["lat"],
            lng=user["lng"],
            radius_m=radius_m,
            view_enum=view_enum,
            required_quality=user["required_quality"],
            pixel_size_m=DEFAULT_PIXEL_SIZE_METERS,
            expanded_cov=user["expanded_cov"],
        )

        log(f"[2/4] Requesting dataLayers: {datalayers_url}")
        datalayers_json = http_get_json(datalayers_url, api_key=api_key)
        with open(out_dir / "dataLayers.json", "w", encoding="utf-8") as f:
            json.dump(datalayers_json, f, indent=2)

        log("[3/4] Downloading GeoTIFFs from dataLayers response...")
        download_geo_tiffs(datalayers_json, out_dir, api_key)
        log("    Done.")

        log("[4/4] Summary")
        imgs = [p.name for p in out_dir.glob("*.tif")]
        hrs = [p.name for p in (out_dir / "hourly_shade").glob("*.tif")] if (out_dir / "hourly_shade").exists() else []
        log(f"    TIFFs: {imgs if imgs else 'None'}")
        log(f"    Hourly shade: {len(hrs)} file(s)")
        log("\nAll done!\n")

        success = True

    except KeyboardInterrupt:
        log("\nInterrupted by user.")
    except Exception as e:
        log("\nERROR:")
        log(textwrap.indent(str(e), "  "))
    finally:
        if not success and out_dir and out_dir.exists():
            import shutil
            try:
                shutil.rmtree(out_dir)
                log(f"\n🗑️  Cleaned up empty folder: {out_dir.name}")
            except Exception as cleanup_error:
                log(f"\n⚠️  Could not clean up folder: {cleanup_error}")

def select_and_process_folder(process_function, function_name: str):
"""
Prompt the user to choose a data subfolder and run process_function on it.

    @args: process_function, function_name
    @return: None
    """

    try:
        data_dir = Path(__file__).resolve().parent.parent / "data"

        if not data_dir.exists() or not any(data_dir.iterdir()):
            log(f"\n⚠️  No data folders found. Please run 'Find Buildings' first.\n")
            return

        folders = sorted([f for f in data_dir.iterdir() if f.is_dir()])
        if not folders:
            log(f"\n⚠️  No data folders found. Please run 'Find Buildings' first.\n")
            return

        log("\n" + "=" * 60)
        log(f"Select a folder to {function_name}:")
        log("=" * 60)
        for i, folder in enumerate(folders, 1):
            log(f"{i}. {folder.name}")
        log(f"{len(folders) + 1}. Back")
        log()

        choice = prompt_int(f"Enter your choice [1-{len(folders) + 1}]: ")

        if 1 <= choice <= len(folders):
            selected_folder = folders[choice - 1]
            log(f"\nProcessing folder: {selected_folder.name}\n")
            process_function(selected_folder)
            log(f"\n{function_name.capitalize()} complete!\n")
        elif choice == len(folders) + 1:
            return
        else:
            log("\n⚠️  Invalid choice.\n")

    except Exception as e:
        log("\nERROR:")
        log(textwrap.indent(str(e), "  "))

def main():
"""
Main program loop — present menu and dispatch user choices.

    @args: None
    @return: None
    """

    api_key = None

    while True:
        try:
            clear_screen()
            display_main_menu()

            choice = prompt_int("Enter your choice: ")

            if choice == 1:
                if not api_key:
                    api_key = read_api_key()
                log()
                find_buildings(api_key)
                input("\nPress Enter to continue...")

            elif choice == 2:
                from tif_to_png import process_folder
                select_and_process_folder(process_folder, "convert to PNG")
                input("\nPress Enter to continue...")

            elif choice == 3:
                if compile_layout is None:
                     log("\n⚠️ Could not import layout_compiler. Make sure src/layout_compiler.py exists.\n")
                else:
                    select_and_process_folder(compile_layout, "compile layout")
                input("\nPress Enter to continue...")

            elif choice == 4:
                break

            else:
                log("\n⚠️  Invalid choice. Please select 1, 2, 3, or 4.\n")
                input("Press Enter to continue...")

        except KeyboardInterrupt:
            log("\n\nInterrupted by user. Exiting...")
            break
        except Exception as e:
            log(f"\n⚠️  Unexpected error in main loop: {e}\n")
            input("Press Enter to continue...")

if **name** == "**main**":
main()

================
File: src/solar_api.py
================

# src/solar_api.py

import os
import time
import shutil
from pathlib import Path
from urllib.parse import urlencode, urlparse, parse_qsl, urlunparse

import requests
from dotenv import load_dotenv

from config import (
API_BASE,
HTTP_TIMEOUT,
HTTP_RETRIES,
RETRY_SLEEP,
URL_FIELDS,
)
from utils import log, ensure_dir

\_ENV_PATH = Path(**file**).resolve().parent.parent / ".env"
if \_ENV_PATH.exists():
load_dotenv(dotenv_path=\_ENV_PATH)

def join_query(url: str, extra_params: dict) -> str:
"""
Merge extra_params into the query string of url and return the new URL.

    @args: url, extra_params
    @return: merged URL string
    """

    u = urlparse(url)
    q = dict(parse_qsl(u.query, keep_blank_values=True))
    q.update({k: v for k, v in extra_params.items() if v is not None})
    new_query = urlencode(q, doseq=True)
    return urlunparse((u.scheme, u.netloc, u.path, u.params, new_query, u.fragment))

def http_get_json(url: str, headers=None, api_key: str | None = None) -> dict:
"""
Perform an HTTP GET and return parsed JSON, retrying on failure.

    @args: url, headers, api_key
    @return: parsed JSON dict
    """

    if api_key:
        url = join_query(url, {"key": api_key})
    last = None
    for attempt in range(HTTP_RETRIES + 1):
        try:
            resp = requests.get(url, headers=headers, timeout=HTTP_TIMEOUT)
            if resp.status_code // 100 != 2:
                raise RuntimeError(
                    f"HTTP {resp.status_code} for {url} -> {resp.text[:500]}"
                )
            return resp.json()
        except Exception as e:
            last = e
            if attempt < HTTP_RETRIES:
                time.sleep(RETRY_SLEEP * (attempt + 1))
            else:
                raise
    raise last

def http_download_to_file(url: str, out_path: Path, headers=None, api_key: str | None = None):
"""
Download a URL and stream it to out_path with retries.

    @args: url, out_path, headers, api_key
    @return: None
    """

    if api_key:
        url = join_query(url, {"key": api_key})
    last = None
    for attempt in range(HTTP_RETRIES + 1):
        try:
            with requests.get(url, headers=headers, timeout=HTTP_TIMEOUT, stream=True) as r:
                if r.status_code // 100 != 2:
                    raise RuntimeError(
                        f"HTTP {r.status_code} for {url} -> {r.text[:300]}"
                    )
                with open(out_path, "wb") as f:
                    shutil.copyfileobj(r.raw, f)
            return
        except Exception as e:
            last = e
            if attempt < HTTP_RETRIES:
                time.sleep(RETRY_SLEEP * (attempt + 1))
            else:
                raise
    raise last

def read_api_key() -> str:
"""
Read an API key from environment or prompt the user.

    @args: None
    @return: API key string
    """

    k = os.getenv("GOOGLE_SOLAR_API_KEY") or os.getenv("SOLAR_API_KEY")
    if k:
        k = k.strip()
    if not k:
        log("No API key found in env (GOOGLE_SOLAR_API_KEY or SOLAR_API_KEY).")
        k = input("Enter your Google Solar API key: ").strip()
    if not k:
        raise RuntimeError("API key is required.")
    return k

def build_datalayers_url(
lat: float,
lng: float,
radius_m: int,
view_enum: str,
required_quality: str | None,
pixel_size_m: float | None,
expanded_cov: bool,
):
"""
Build a URL for the dataLayers:get API call with provided parameters.

    @args: lat, lng, radius_m, view_enum, required_quality, pixel_size_m, expanded_cov
    @return: URL string
    """

    params = {
        "location.latitude": lat,
        "location.longitude": lng,
        "radiusMeters": radius_m,
        "view": view_enum,
    }
    if required_quality:
        params["requiredQuality"] = required_quality
    if pixel_size_m is not None:
        params["pixelSizeMeters"] = pixel_size_m
    if expanded_cov:
        params["experiments"] = "EXPANDED_COVERAGE"
    return f"{API_BASE}/dataLayers:get?{urlencode(params)}"

def build_building_insights_url(lat: float, lng: float, expanded_cov: bool, required_quality: str | None = None):
"""
Build a URL for the buildingInsights:findClosest API call.

    @args: lat, lng, expanded_cov, required_quality
    @return: URL string
    """

    params = {
        "location.latitude": lat,
        "location.longitude": lng,
    }
    if required_quality:
        params["requiredQuality"] = required_quality
    if expanded_cov:
        params["experiments"] = "EXPANDED_COVERAGE"
    return f"{API_BASE}/buildingInsights:findClosest?{urlencode(params)}"

def download_geo_tiffs(datalayers_json: dict, out_dir: Path, api_key: str):
"""
Download GeoTIFFs referenced in the datalayers JSON into out_dir.

    @args: datalayers_json, out_dir, api_key
    @return: None
    """

    for field, filename in URL_FIELDS.items():
        url = datalayers_json.get(field)
        if url:
            log(f"    - {field} -> {filename}")
            http_download_to_file(url, out_dir / filename, api_key=api_key)

    hourly = datalayers_json.get("hourlyShadeUrls") or []
    if hourly:
        shades_dir = ensure_dir(out_dir / "hourly_shade")
        for idx, u in enumerate(hourly):
            fname = f"hourly_shade_{idx:02d}.tif"
            log(f"    - hourlyShadeUrls[{idx}] -> {fname}")
            http_download_to_file(u, shades_dir / fname, api_key=api_key)

def geocode_address(query: str, api_key: str) -> list[dict]:
"""
Geocode a query using the Google Geocoding API and return results.

    @args: query, api_key
    @return: list of result dicts
    """
    params = {"address": query, "key": api_key}
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{urlencode(params)}"
    log(f"    Geocoding '{query}'...")
    response = http_get_json(url)

    if response["status"] != "OK":
        log(f"    Geocoding failed: {response['status']}")
        return []

    results = []
    for item in response["results"]:
        results.append(
            {
                "address": item["formatted_address"],
                "lat": item["geometry"]["location"]["lat"],
                "lng": item["geometry"]["location"]["lng"],
            }
        )
    return results

================
File: src/tif_to_png.py
================

# src/tif_to_png.py

import re
import sys
from pathlib import Path
import numpy as np
import rasterio
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance
from scipy.ndimage import zoom

MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def get_colormap(name: str):
"""
Return a matplotlib colormap by name (custom 'flux' gradient supported).

    @args: name (str)
    @return: matplotlib colormap
    """

    if name == "flux":
        colors = [(0, 0, 0), (0.3, 0, 0.3), (0.8, 0, 0), (1, 1, 0), (1, 1, 1)]
        return LinearSegmentedColormap.from_list("flux", colors, N=256)
    return plt.get_cmap("turbo" if name == "rainbow" else name)

def normalize_array(a: np.ndarray, clip_percent: float = 2.0) -> np.ndarray:
"""
Normalize an array to 0..1 by clipping outliers using percentiles.

    @args: a (ndarray), clip_percent (float)
    @return: normalized ndarray (float32)
    """

    mask = np.isfinite(a)
    vals = a[mask]
    if vals.size == 0 or (lo := np.percentile(vals, clip_percent)) == (hi := np.percentile(vals, 100 - clip_percent)):
        return np.zeros_like(a, dtype=np.float32)
    norm = np.clip((a - lo) / (hi - lo), 0, 1)
    norm[~mask] = 0
    return norm.astype(np.float32)

def add_legend_bar(img: np.ndarray, cmap, value_range: tuple[float, float], label: str,
label_range: tuple[str, str] | None = None, bar_height: int = 20,
bar_width: int = 200, margin: int = 15) -> np.ndarray:
"""
Draw a horizontal legend bar on the image showing the colormap range.

    @args: img, cmap, value_range, label, label_range, bar_height, bar_width, margin
    @return: modified image ndarray
    """

    pil_img = Image.fromarray(img)
    draw = ImageDraw.Draw(pil_img)
    bar_x, bar_y = margin, img.shape[0] - bar_height - margin - 30

    for i in range(bar_width):
        color = tuple(int(c * 255) for c in cmap(i / bar_width)[:3])
        draw.rectangle([bar_x + i, bar_y, bar_x + i + 1, bar_y + bar_height], fill=color)

    draw.rectangle([bar_x, bar_y, bar_x + bar_width, bar_y + bar_height], outline=(255, 255, 255), width=2)

    try:
        font = ImageFont.truetype("arial.ttf", 12)
    except Exception:
        font = ImageFont.load_default()

    min_val, max_val = value_range
    min_text = label_range[0] if label_range else f"{min_val:.1f}m"
    max_text = label_range[1] if label_range else f"{max_val:.1f}m"
    text_y = bar_y + bar_height + 5
    text_style = dict(fill=(255, 255, 255), font=font, stroke_width=1, stroke_fill=(0, 0, 0))

    draw.text((bar_x, text_y), min_text, **text_style)
    max_w = draw.textbbox((0, 0), max_text, font=font)[2]
    draw.text((bar_x + bar_width - max_w, text_y), max_text, **text_style)
    label_w = draw.textbbox((0, 0), label, font=font)[2]
    draw.text((bar_x + (bar_width - label_w) // 2, text_y), label, **text_style)

    return np.array(pil_img)

def save_color_png(arr_0_1: np.ndarray, out_path: Path, cmap_name: str = "inferno",
add_legend: bool = False, value_range: tuple[float, float] | None = None,
label: str = "Value", label_range: tuple[str, str] | None = None) -> None:
"""
Save a normalized 0..1 array to a colored PNG using the specified colormap.

    @args: arr_0_1, out_path, cmap_name, add_legend, value_range, label, label_range
    @return: None
    """

    cmap = get_colormap(cmap_name)
    img = (cmap(np.clip(arr_0_1, 0, 1))[:, :, :3] * 255).astype(np.uint8)
    if add_legend and value_range:
        img = add_legend_bar(img, cmap, value_range, label, label_range)
    Image.fromarray(img).save(out_path)
    print(f"✅ Saved {out_path}")

def bitcount_uint32(x: np.ndarray) -> np.ndarray:
"""
Count set bits for unsigned 32-bit integers elementwise.

    @args: x (ndarray)
    @return: float32 ndarray of bit counts
    """

    x = np.clip(x, 0, None).astype(np.uint32)
    count = np.zeros_like(x, dtype=np.uint8)
    while (nz := x != 0).any():
        x[nz] &= x[nz] - 1
        count[nz] += 1
    return count.astype(np.float32)

def is_monthly_flux(src: rasterio.io.DatasetReader, tif_path: Path) -> bool:
"""
Heuristically determine if a GeoTIFF represents monthly flux data.

    @args: src, tif_path
    @return: bool
    """

    return "monthly_flux" in tif_path.stem.lower() or (src.count == 12 and src.dtypes[0].startswith("float"))

def is_hourly_shade(src: rasterio.io.DatasetReader, tif_path: Path) -> bool:
"""
Heuristically determine if a GeoTIFF represents hourly shade (24 bands).

    @args: src, tif_path
    @return: bool
    """

    return tif_path.stem.lower().startswith("hourly_shade") or (src.count == 24 and src.dtypes[0].startswith("int"))

def month_from_filename(tif_path: Path) -> str | None:
"""
Extract a month name from a filename if it contains a two-digit month index.

    @args: tif_path
    @return: month string or None
    """

    if m := re.search(r"(\d{2})", tif_path.stem):
        idx = int(m.group(1))
        return MONTH_NAMES[idx] if 0 <= idx < 12 else None
    return None

def get_value_range(band: np.ndarray) -> tuple[float, float]:
"""
Compute a clamped display range using 2nd and 98th percentiles of finite values.

    @args: band
    @return: (min, max) tuple
    """

    mask = np.isfinite(band)
    return (float(np.percentile(band[mask], 2)), float(np.percentile(band[mask], 98))) if mask.any() else (0.0, 1.0)

def upscale_if_needed(band: np.ndarray, target_shape) -> np.ndarray:
"""
Resize `band` with simple linear interpolation if `target_shape` differs.

    @args: band, target_shape
    @return: resized ndarray
    """

    if target_shape and band.shape != target_shape:
        factors = (target_shape[0] / band.shape[0], target_shape[1] / band.shape[1])
        return zoom(band, factors, order=1)
    return band

def convert_monthly_flux(src: rasterio.io.DatasetReader, tif_path: Path, out_dir: Path, target_shape=None) -> None:
"""
Convert a multi-band monthly flux TIFF into separate monthly PNGs.

    @args: src, tif_path, out_dir, target_shape
    @return: None
    """

    out_dir.mkdir(parents=True, exist_ok=True)
    for i in range(1, src.count + 1):
        band = upscale_if_needed(src.read(i), target_shape)
        month = MONTH_NAMES[i - 1] if i - 1 < len(MONTH_NAMES) else f"M{i:02d}"
        save_color_png(normalize_array(band), out_dir / f"{tif_path.stem}_{i:02d}_{month}.png",
                      "flux", True, get_value_range(band), "Solar Flux", ("Shady", "Sunny"))

def convert_hourly_shade(src: rasterio.io.DatasetReader, tif_path: Path, out_dir: Path, target_shape=None) -> None:
"""
Convert hourly shade TIFF (24 bands) into per-hour PNGs.

    @args: src, tif_path, out_dir, target_shape
    @return: None
    """

    out_dir.mkdir(parents=True, exist_ok=True)
    mon = month_from_filename(tif_path) or "Month"
    for hour in range(1, src.count + 1):
        sunny_days = upscale_if_needed(bitcount_uint32(src.read(hour)), target_shape)
        norm = np.where(sunny_days >= 0, sunny_days / 31.0, 0).astype(np.float32)
        save_color_png(norm, out_dir / f"{tif_path.stem}_H{hour - 1:02d}_{mon}.png")

def convert_rgb(src: rasterio.io.DatasetReader, tif_path: Path, out_dir: Path) -> None:
"""
Convert multi-band RGB-like TIFF to an enhanced PNG.

    @args: src, tif_path, out_dir
    @return: None
    """

    bands = [1, 2, 3] if src.count >= 3 else list(range(1, src.count + 1))
    arr = np.moveaxis(src.read(bands), 0, -1)
    arr = np.nan_to_num(arr, nan=0.0)

    if arr.dtype != np.uint8:
        max_val = np.nanmax(arr) if np.any(np.isfinite(arr)) else 1.0
        arr = (np.clip(arr, 0, 1) * 255 if max_val <= 1.0 else np.clip(arr, 0, 255)).astype(np.uint8)

    pil_img = Image.fromarray(arr)
    pil_img = pil_img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
    pil_img = ImageEnhance.Contrast(pil_img).enhance(1.1)
    pil_img.save(out_dir / f"{tif_path.stem}.png")
    print(f"✅ Saved {out_dir / (tif_path.stem + '.png')} (enhanced)")

def convert_singleband(src: rasterio.io.DatasetReader, tif_path: Path, out_dir: Path) -> None:
"""
Convert a single-band raster to a colored PNG using heuristics for naming.

    @args: src, tif_path, out_dir
    @return: None
    """

    band = src.read(1)
    stem = tif_path.stem.lower()

    if "dsm" in stem:
        cmap, legend, label, label_rng = "rainbow", True, "Altitude", None
    elif "flux" in stem:
        cmap, legend, label, label_rng = "flux", True, "Solar Flux", ("Shady", "Sunny")
    else:
        cmap, legend, label, label_rng = "inferno", False, "Value", None

    val_range = get_value_range(band) if legend else None
    save_color_png(normalize_array(band), out_dir / f"{tif_path.stem}.png", cmap, legend, val_range, label, label_rng)

def tif_to_png(tif_path: Path, out_dir: Path, target_shape=None) -> None:
"""
Determine TIFF type and dispatch to the appropriate conversion routine.

    @args: tif_path, out_dir, target_shape
    @return: None
    """

    with rasterio.open(tif_path) as src:
        if is_monthly_flux(src, tif_path):
            convert_monthly_flux(src, tif_path, out_dir / tif_path.stem, target_shape)
        elif is_hourly_shade(src, tif_path):
            convert_hourly_shade(src, tif_path, out_dir / tif_path.stem, target_shape)
        elif src.count > 1:
            convert_rgb(src, tif_path, out_dir)
        else:
            convert_singleband(src, tif_path, out_dir)

def get_target_shape(tifs: list[Path]) -> tuple[int, int] | None:
"""
Choose a target output shape for resampling based on priority filenames.

    @args: tifs
    @return: (height, width) or None
    """

    for priority in [["rgb"], ["dsm", "annual_flux", "mask"]]:
        for tif in tifs:
            if tif.stem.lower() in priority:
                with rasterio.open(tif) as src:
                    shape = (src.height, src.width)
                    print(f"Using target resolution from {tif.name}: {shape[0]}x{shape[1]}")
                    return shape
    return None

def process_folder(root_dir: Path) -> None:
"""
Convert all GeoTIFFs under `root_dir` into PNGs, placing outputs in `root_dir/png`.

    @args: root_dir
    @return: None
    """

    out_dir = root_dir / "png"
    out_dir.mkdir(exist_ok=True)
    tifs = list(root_dir.rglob("*.tif"))
    if not tifs:
        print(f"⚠️ No .tif files found in {root_dir}")
        return
    print(f"✅ Found {len(tifs)} GeoTIFF files.")
    target_shape = get_target_shape(tifs)
    for tif in tifs:
        try:
            tif_to_png(tif, out_dir, target_shape)
        except Exception as e:
            print(f"⚠️ Failed to convert {tif}: {e}")

def main() -> None:
"""
CLI entrypoint to convert a folder of GeoTIFFs to PNGs.

    @args: None
    @return: None
    """

    if len(sys.argv) < 2:
        print("Usage: python tif_to_png.py /path/to/data_folder")
        sys.exit(1)
    root_dir = Path(sys.argv[1]).expanduser().resolve()
    if not root_dir.exists():
        print(f"⚠️ Directory not found: {root_dir}")
        sys.exit(1)
    process_folder(root_dir)

if **name** == "**main**":
main()

================
File: src/utils.py
================

# src/utils.py

import datetime as dt
import math

from pathlib import Path

def log(msg=""):
print(msg, flush=True)

def now*local_str():
return dt.datetime.now().strftime("%Y%m%d*%H%M%S")

def ensure_dir(p: Path):
p.mkdir(parents=True, exist_ok=True)
return p

def prompt_float(prompt: str, default: float | None = None) -> float:
s = input(prompt).strip()
if not s:
if default is None:
raise ValueError("No default provided and empty input.")
return float(default)
return float(s)

def prompt_int(prompt: str, default: int | None = None) -> int:
s = input(prompt).strip()
if not s:
if default is None:
raise ValueError("No default provided and empty input.")
return int(default)
return int(s)

def prompt_str(prompt: str, default: str | None = None, allowed: set[str] | None = None) -> str:
s = input(prompt).strip()
if not s and default is not None:
s = default
if allowed and s not in allowed:
raise ValueError(f"Value must be one of {sorted(allowed)} (got '{s}')")
return s

def clear_screen():
"""
Clear the terminal screen.

    @args: None
    @return: None
    """
    import os
    os.system('cls' if os.name == 'nt' else 'clear')

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
"""
Calculate the distance between two lat/lon points in meters.

    @args: lat1, lon1, lat2, lon2
    @return: distance in meters (float)
    """
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def get_meters_per_degree(lat: float) -> tuple[float, float]:
"""
Calculate meters per degree for longitude and latitude at a given latitude.

    @args: lat
    @return: (meters_per_deg_lon, meters_per_deg_lat)
    """
    m_per_deg_lat = 111132.954 - 559.822 * math.cos(2 * math.radians(lat)) + 1.175 * math.cos(4 * math.radians(lat))
    m_per_deg_lon = 111320 * math.cos(math.radians(lat))
    return m_per_deg_lon, m_per_deg_lat

================
File: .env.example
================
GOOGLE_SOLAR_API_KEY=your_api_key_here

================
File: .gitignore
================
.env
\*.json
venv/
**pycache**/
data/

================
File: README.md
================

# Solar Layout Assessment Lite

Python CLI tool that downloads solar potential data from the Google Solar API, converts GeoTIFFs to colorized PNGs, and overlays predicted solar panel layouts on those images. Each solar panel object size is fixed at 1.879m x 1.045m (H x W).

## Prerequisites

- Python 3.10+
- Google Solar API key ([get one here](https://developers.google.com/maps/documentation/solar))

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file in the project root:

```env
SOLAR_API_KEY=your_google_solar_api_key_here
```

## Usage

```bash
python3 src/main.py
```

The interactive CLI presents four options:

| Option                  | Description                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| 1. Find Buildings       | Geocode a location, fetch building insights, download GeoTIFF layers |
| 2. Convert TIFF to PNG  | Colorize GeoTIFFs in a selected data folder to PNG                   |
| 3. Compile Solar Layout | Overlay panel placements from `buildingInsights.json` onto PNGs      |
| 4. Exit                 | Quit                                                                 |

**Option 1 prompts:**

- Location string (geocoded via Google Maps API; select from up to 8 candidates)
- Quality: `HIGH` / `MEDIUM` / `BASE` (default: `BASE`)
- View: `BASIC` (RGB + annual flux) or `FULL` (all layers including monthly/hourly) (default: `FULL`)
- Expanded coverage: `y/N` (default: `N`)

Radius is calculated automatically from the building bounding box returned by the API.

> **NOTE:** Expanded coverage can only be used with BASE quality.

## Output Structure (FULL)

```
data/
└── YYYYMMDD_HHMMSS/
    ├── buildingInsights.json   # Panel predictions + bounding box
    ├── dataLayers.json         # Raw Solar API datalayers response
    ├── dsm.tif                 # Digital Surface Model
    ├── rgb.tif                 # Aerial RGB imagery
    ├── mask.tif                # Building mask
    ├── annual_flux.tif
    ├── monthly_flux.tif
    ├── hourly_shade/           # hourly_shade_00.tif … hourly_shade_23.tif
    ├── png/                    # Colorized PNGs (inferno colormap for single-band)
    └── compiled/               # PNGs with panel layout overlays
```

Incomplete runs clean up their timestamped folder automatically.

## Module Overview

| File                                | Role                                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `src/main.py`                       | CLI entry point and workflow orchestration                                             |
| `src/solar_api.py`                  | Google Solar API + Geocoding requests, GeoTIFF downloads                               |
| `src/layout_compiler.py`            | Reads panel predictions, projects WGS84 → pixel coords, draws rotated panel rectangles |
| `src/tif_to_png.py`                 | GeoTIFF → PNG conversion with colormap                                                 |
| `src/utils.py`                      | Logging, prompts, Haversine distance, path helpers                                     |
| `src/config.py`                     | API endpoints, HTTP settings, layer field mappings                                     |
| `src/test/debug_layout.py`          | Smoke test for panel layout logic; validates per-panel energy using area-average flux  |
| `src/test/panel_flux_aggregator.py` | Ray-casting point-in-polygon utility; computes average solar flux over a panel's area  |

## Coordinate Systems

- **Input/output**: WGS84 (EPSG:4326) — lat/lng from the Solar API
- **GeoTIFF CRS**: detected at runtime via rasterio (typically a UTM projection)
- **Transformation**: `pyproj.Transformer` converts WGS84 → GeoTIFF CRS; `rasterio.transform.rowcol()` maps to pixel coords (note: swap to `x, y = col, row` for PIL drawing)

## Troubleshooting

- **HTTP 403/404**: invalid API key, location has no Solar data, or quota exceeded. Try `BASE` quality first.
- **Missing compiled output**: run option 2 (Convert TIFF) before option 3 (Compile Layout). Option 3 requires both `buildingInsights.json` and a populated `png/` directory.
- **GeoTIFF URLs expire**: download immediately after fetching — URLs are valid for ~1 hour.

## Resources

- [Google Solar API](https://developers.google.com/maps/documentation/solar)
- [Rasterio](https://rasterio.readthedocs.io/)
- [pyproj](https://pyproj4.github.io/pyproj/)

================
File: requirements.txt
================
requests==2.31.0
pandas==2.3.3
python-dotenv==1.2.1
rasterio==1.4.3
numpy==2.3.4
pillow==12.0.0
matplotlib==3.10.7
scipy>=1.11.0
pyproj==3.6.1

================================================================
End of Codebase
================================================================
