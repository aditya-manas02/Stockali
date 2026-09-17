import struct
import binascii
from typing import Optional, Tuple
from geoalchemy2.elements import WKBElement, WKTElement


def lat_lng_to_point(latitude: float, longitude: float) -> WKTElement:
    """
    Converts latitude and longitude into a PostGIS Geography POINT(lng lat) with SRID 4326.
    Note: PostGIS WKT convention is POINT(longitude latitude).
    """
    return WKTElement(f"POINT({longitude} {latitude})", srid=4326)


def point_to_lat_lng(point) -> Tuple[Optional[float], Optional[float]]:
    """
    Extracts (latitude, longitude) from a GeoAlchemy2 WKBElement or EWKB hex string.
    Returns (lat, lng) as floats, or (None, None).
    """
    if point is None:
        return None, None
    if isinstance(point, WKBElement):
        data = bytes(point.data)
    elif isinstance(point, (bytes, bytearray, memoryview)):
        data = bytes(point)
    elif isinstance(point, str):
        data = binascii.unhexlify(point)
    else:
        return None, None

    byte_order = "<" if data[0] == 1 else ">"
    geom_type = struct.unpack(f"{byte_order}I", data[1:5])[0]
    if geom_type & 0x20000000:  # EWKB with SRID
        lng, lat = struct.unpack(f"{byte_order}dd", data[9:25])
    else:  # Standard WKB
        lng, lat = struct.unpack(f"{byte_order}dd", data[5:21])
    return lat, lng
