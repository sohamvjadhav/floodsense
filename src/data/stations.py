"""
Station registry — ALL Maharashtra districts (statewide coverage).

Coordinates are district headquarters, used as proxy points for Open-Meteo
grid lookup (documented approximation: rainfall is gridded, not a true
point gauge reading).

Basins: Godavari (incl. Wainganga/Wardha/Pravara/Manjra systems), Krishna,
Tapi (incl. Purna), and coastal Konkan. "Mumbai" merges City + Suburban
(Census 2011 populations summed), matching the boundary file.

upstream_ids encode the approximate river-network adjacency used to build
lagged neighbor features. Direction was assigned by elevation and river
geography (Western Ghats ridge → Godavari/Krishna eastward, Sahyadri crest
→ Konkan rivers westward, Tapi/Purna west→east through Vidarbha belt,
Wainganga/Wardha north through eastern Vidarbha into the Godavari). This
is an APPROXIMATION, not an official CWC catchment map — flagged as such
in the report.

population is Census 2011 district population (rounded to thousands) —
used only for exposure/impact summaries on the dashboard, never as a
model feature.
"""

S = lambda sid, district, basin, lat, lon, elev, pop, ups: {
    "station_id": sid, "district": district, "basin": basin, "lat": lat,
    "lon": lon, "elevation_m": elev, "population": pop, "upstream_ids": ups,
}

STATIONS = [
    # --- Krishna basin (flows east) ---
    S("MH_SAT", "Satara",     "Krishna",  17.693, 74.000, 742, 3004000, []),
    S("MH_KOP", "Kolhapur",   "Krishna",  16.705, 74.243, 569, 3879000, []),
    S("MH_SNG", "Sangli",     "Krishna",  16.852, 74.581, 549, 2820000, ["MH_KOP"]),
    S("MH_PUN", "Pune",       "Krishna",  18.520, 73.856, 560, 9429000, ["MH_SAT"]),
    S("MH_SOL", "Solapur",    "Krishna",  17.659, 75.906, 457, 4316000, ["MH_PUN", "MH_SNG"]),

    # --- Konkan coastal basins (flow west) ---
    S("MH_THA", "Thane",      "Konkan",  19.218, 72.978,   7, 11060000, []),
    S("MH_PGH", "Palghar",    "Konkan",  19.698, 72.771,  10,  2990000, []),
    S("MH_MUM", "Mumbai",     "Konkan",  18.975, 72.826,  11, 12442000, []),  # City+Suburban merged
    S("MH_RAI", "Raigad",     "Konkan",  18.520, 73.181,  15,  2634000, ["MH_PUN"]),
    S("MH_RAT", "Ratnagiri",  "Konkan",  16.990, 73.312,  11,  1615000, []),
    S("MH_SIN", "Sindhudurg", "Konkan",  16.103, 73.687,  22,   849000, ["MH_RAT"]),

    # --- Godavari basin (flows east; incl. Pravara/Manjra/Wainganga/Wardha) ---
    S("MH_NAS", "Nashik",       "Godavari", 19.997, 73.790, 700, 6107000, []),
    S("MH_AHM", "Ahmednagar",   "Godavari", 19.095, 74.736, 640, 4543000, []),   # Pravara
    S("MH_AUR", "Aurangabad",   "Godavari", 19.876, 75.343, 568, 3701000, ["MH_NAS"]),
    S("MH_JLN", "Jalna",        "Godavari", 19.841, 75.876, 535, 1959000, ["MH_AUR"]),
    S("MH_PRB", "Parbhani",     "Godavari", 19.268, 76.770, 358, 1836000, ["MH_JLN"]),
    S("MH_NDD", "Nanded",       "Godavari", 19.138, 77.317, 358, 3361000, ["MH_PRB"]),
    S("MH_LAT", "Latur",        "Godavari", 18.400, 76.580, 640, 2455000, []),   # Manjra
    S("MH_OSM", "Osmanabad",    "Godavari", 18.190, 76.040, 650, 1657000, ["MH_LAT"]),
    S("MH_BED", "Beed",         "Godavari", 18.990, 75.762, 598, 2585000, ["MH_AHM", "MH_OSM"]),
    S("MH_HIN", "Hingoli",      "Godavari", 19.720, 77.150, 520, 1179000, ["MH_PRB"]),
    S("MH_GON", "Gondia",       "Godavari", 21.460, 80.190, 250, 1322000, []),   # Wainganga
    S("MH_BHA", "Bhandara",     "Godavari", 21.170, 79.650, 244, 1200000, ["MH_GON"]),
    S("MH_CHA", "Chandrapur",   "Godavari", 19.970, 79.300, 224, 2204000, ["MH_BHA"]),
    S("MH_GAD", "Gadchiroli",   "Godavari", 20.100, 80.000, 215, 1072000, ["MH_CHA"]),
    S("MH_WAR", "Wardha",       "Godavari", 20.750, 78.600, 280, 1300000, ["MH_CHA"]),
    S("MH_YAV", "Yavatmal",     "Godavari", 20.390, 78.130, 450, 2772000, ["MH_WAR"]),
    S("MH_NAG", "Nagpur",       "Godavari", 21.146, 79.088, 310, 4653000, ["MH_WAR"]),

    # --- Tapi basin (incl. Purna; flows west) ---
    S("MH_NBR", "Nandurbar", "Tapi", 21.370, 74.240, 230, 1648000, []),
    S("MH_DHU", "Dhule",     "Tapi", 20.900, 74.774, 240, 2050000, ["MH_NBR"]),
    S("MH_JLG", "Jalgaon",   "Tapi", 21.010, 75.563, 200, 4229000, ["MH_DHU"]),
    S("MH_BUL", "Buldhana",  "Tapi", 20.536, 76.176, 640, 2586000, []),         # Purna
    S("MH_AKO", "Akola",     "Tapi", 20.700, 77.003, 282, 1813000, ["MH_BUL"]),
    S("MH_AMR", "Amravati",  "Tapi", 20.932, 77.752, 343, 2872000, []),
    S("MH_WAS", "Washim",    "Tapi", 19.960, 77.130, 540, 1197000, ["MH_AMR"]),
]

STATION_BY_ID = {s["station_id"]: s for s in STATIONS}
