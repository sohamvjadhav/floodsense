"""
Station registry for Maharashtra flood-prone districts.

Covers the three target basins: Godavari, Krishna, and coastal Konkan.
Coordinates are district headquarters — used as proxy points for
Open-Meteo grid lookup (documented approximation: rainfall is gridded,
not a true point gauge reading).

upstream_ids encode the approximate river-network adjacency used to build
lagged neighbor features. Direction was assigned by elevation and known
river geography (Western Ghats ridge → Godavari/Krishna eastward flow,
Sahyadri crest → Konkan rivers westward flow). This is an APPROXIMATION,
not an official CWC catchment map — flagged as such in the report.
"""

STATIONS = [
    # --- Godavari basin (flows east) ---
    {"station_id": "MH_NAS", "district": "Nashik",      "basin": "Godavari", "lat": 19.997, "lon": 73.790, "elevation_m": 700,  "upstream_ids": []},
    {"station_id": "MH_AUR", "district": "Aurangabad",  "basin": "Godavari", "lat": 19.876, "lon": 75.343, "elevation_m": 568,  "upstream_ids": ["MH_NAS"]},
    {"station_id": "MH_JLN", "district": "Jalna",       "basin": "Godavari", "lat": 19.841, "lon": 75.876, "elevation_m": 535,  "upstream_ids": ["MH_AUR"]},
    {"station_id": "MH_PRB", "district": "Parbhani",    "basin": "Godavari", "lat": 19.268, "lon": 76.770, "elevation_m": 358,  "upstream_ids": ["MH_JLN"]},
    {"station_id": "MH_NDD", "district": "Nanded",      "basin": "Godavari", "lat": 19.138, "lon": 77.317, "elevation_m": 358,  "upstream_ids": ["MH_PRB"]},

    # --- Krishna basin (flows east) ---
    {"station_id": "MH_SAT", "district": "Satara",      "basin": "Krishna",  "lat": 17.693, "lon": 74.000, "elevation_m": 742,  "upstream_ids": []},
    {"station_id": "MH_KOP", "district": "Kolhapur",    "basin": "Krishna",  "lat": 16.705, "lon": 74.243, "elevation_m": 569,  "upstream_ids": []},
    {"station_id": "MH_SNG", "district": "Sangli",      "basin": "Krishna",  "lat": 16.852, "lon": 74.581, "elevation_m": 549,  "upstream_ids": ["MH_KOP"]},
    {"station_id": "MH_PUN", "district": "Pune",        "basin": "Krishna",  "lat": 18.520, "lon": 73.856, "elevation_m": 560,  "upstream_ids": ["MH_SAT"]},
    {"station_id": "MH_SOL", "district": "Solapur",     "basin": "Krishna",  "lat": 17.659, "lon": 75.906, "elevation_m": 457,  "upstream_ids": ["MH_PUN", "MH_SNG"]},

    # --- Konkan coastal basins (flow west) ---
    {"station_id": "MH_THA", "district": "Thane",       "basin": "Konkan",  "lat": 19.218, "lon": 72.978, "elevation_m": 7,    "upstream_ids": []},
    {"station_id": "MH_RAI", "district": "Raigad",      "basin": "Konkan",  "lat": 18.520, "lon": 73.181, "elevation_m": 15,   "upstream_ids": ["MH_PUN"]},
    {"station_id": "MH_RAT", "district": "Ratnagiri",   "basin": "Konkan",  "lat": 16.990, "lon": 73.312, "elevation_m": 11,   "upstream_ids": []},
    {"station_id": "MH_SIN", "district": "Sindhudurg",  "basin": "Konkan",  "lat": 16.103, "lon": 73.687, "elevation_m": 22,   "upstream_ids": ["MH_RAT"]},
    {"station_id": "MH_KOL", "district": "Kolaba/Alibag","basin": "Konkan", "lat": 18.641, "lon": 72.872, "elevation_m": 8,    "upstream_ids": ["MH_PUN"]},
]

STATION_BY_ID = {s["station_id"]: s for s in STATIONS}
