"""
AfriXplore Geospatial Worker — DBSCAN Clustering
Clusters mineral reports into anomaly clusters using spatial DBSCAN.
"""

import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from sklearn.cluster import DBSCAN

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL')

# DBSCAN parameters
EPSILON_KM = float(os.getenv('CLUSTER_EPSILON_KM', '5'))      # 5 km radius
MIN_SAMPLES = int(os.getenv('CLUSTER_MIN_SAMPLES', '3'))       # 3 reports minimum
EARTH_RADIUS_KM = 6371.0


def _haversine_matrix(coords_rad: np.ndarray) -> np.ndarray:
    """Return pairwise haversine distance matrix in km."""
    lat = coords_rad[:, 0]
    lon = coords_rad[:, 1]
    dlat = lat[:, None] - lat[None, :]
    dlon = lon[:, None] - lon[None, :]
    a = np.sin(dlat / 2) ** 2 + np.cos(lat[:, None]) * np.cos(lat[None, :]) * np.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_KM * np.arcsin(np.sqrt(np.clip(a, 0, 1)))


def run_clustering_cycle():
    """Fetch recent unclustered reports and update anomaly_clusters table."""
    logger.info('Starting clustering cycle')

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, mineral_type,
                       ST_Y(location::geometry) AS lat,
                       ST_X(location::geometry) AS lon,
                       country
                FROM reports
                WHERE status IN ('submitted', 'under_review')
                  AND location IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 5000
            """)
            rows = cur.fetchall()

        if not rows:
            logger.info('No reports to cluster')
            return

        coords = np.array([[r['lat'], r['lon']] for r in rows])
        coords_rad = np.radians(coords)
        dist_matrix = _haversine_matrix(coords_rad)

        db = DBSCAN(
            eps=EPSILON_KM,
            min_samples=MIN_SAMPLES,
            metric='precomputed'
        )
        labels = db.fit_predict(dist_matrix)

        unique_labels = set(labels) - {-1}
        logger.info(f'Found {len(unique_labels)} clusters from {len(rows)} reports')

        with conn.cursor() as cur:
            for cluster_id in unique_labels:
                mask = labels == cluster_id
                cluster_rows = [rows[i] for i in range(len(rows)) if mask[i]]
                cluster_coords = coords[mask]

                centroid_lat = float(np.mean(cluster_coords[:, 0]))
                centroid_lon = float(np.mean(cluster_coords[:, 1]))

                minerals = [r['mineral_type'] for r in cluster_rows if r['mineral_type']]
                dominant = max(set(minerals), key=minerals.count) if minerals else 'unknown'
                country = cluster_rows[0]['country']

                cur.execute("""
                    INSERT INTO anomaly_clusters
                        (centroid, dominant_mineral, report_count, country, last_updated)
                    VALUES (
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                        %s, %s, %s, NOW()
                    )
                    ON CONFLICT DO NOTHING
                """, (centroid_lon, centroid_lat, dominant, len(cluster_rows), country))

        conn.commit()
        logger.info('Clustering cycle complete')

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
