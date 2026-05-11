"""
AfriXplore Geospatial Worker — DBSCAN Clustering
Clusters mineral reports into anomaly clusters using spatial DBSCAN.
"""

import json
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
import numpy as np
from sklearn.cluster import DBSCAN

logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL')

SERVICE_BUS_CONNECTION_STRING = os.getenv('SERVICE_BUS_CONNECTION_STRING', '')
SERVICE_BUS_TOPIC = 'anomaly-detected'

# DBSCAN parameters
EPSILON_KM = float(os.getenv('CLUSTER_EPSILON_KM', '5'))      # 5 km radius
MIN_SAMPLES = int(os.getenv('CLUSTER_MIN_SAMPLES', '3'))       # 3 reports minimum
EARTH_RADIUS_KM = 6371.0


def run_clustering_cycle():
    """Fetch recent unclustered reports and update anomaly_clusters table."""
    logger.info('Starting clustering cycle')

    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, scout_id, mineral_type,
                       ST_Y(location::geometry) AS lat,
                       ST_X(location::geometry) AS lon,
                       country
                FROM reports
                WHERE status IN ('pending', 'processing', 'submitted')
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

        # BallTree + haversine avoids O(n²) precomputed distance matrix.
        # eps must be in radians: km / earth_radius.
        db = DBSCAN(
            eps=EPSILON_KM / EARTH_RADIUS_KM,
            min_samples=MIN_SAMPLES,
            metric='haversine',
            algorithm='ball_tree',
        )
        labels = db.fit_predict(coords_rad)

        unique_labels = set(labels) - {-1}
        logger.info(f'Found {len(unique_labels)} clusters from {len(rows)} reports')

        # Delete existing clusters for the countries we recomputed, then insert fresh.
        countries_in_run = list(set(r['country'] for r in rows if r['country']))

        new_clusters = []
        seen_cluster_keys: list = []

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            for cluster_label in unique_labels:
                mask = labels == cluster_label
                cluster_rows = [rows[i] for i in range(len(rows)) if mask[i]]
                cluster_report_ids = [str(r['id']) for r in cluster_rows]
                cluster_coords = coords[mask]

                centroid_lat = float(np.mean(cluster_coords[:, 0]))
                centroid_lon = float(np.mean(cluster_coords[:, 1]))

                minerals = [r['mineral_type'] for r in cluster_rows if r['mineral_type']]
                dominant = max(set(minerals), key=minerals.count) if minerals else 'unknown'
                country = cluster_rows[0]['country']

                unique_scout_ids = list(set(
                    str(r['scout_id']) for r in cluster_rows if r.get('scout_id')
                ))
                scout_count = len(unique_scout_ids)
                mineral_diversity = len(set(
                    r['mineral_type'] for r in cluster_rows if r.get('mineral_type')
                ))

                # Build a WKT MultiPoint for convex hull + radius calculation
                points_wkt = ', '.join(
                    f'{r["lon"]} {r["lat"]}' for r in cluster_rows
                )

                # Stable key: country:mineral:lat_bucket:lon_bucket (0.1 deg ≈ 11 km)
                cluster_key = (
                    f"{country}:{dominant}"
                    f":{round(centroid_lat, 1)}:{round(centroid_lon, 1)}"
                )
                seen_cluster_keys.append(cluster_key)

                # UPSERT — no DELETE, so subscribers never see an empty map
                cur.execute("""
                    INSERT INTO anomaly_clusters
                        (centroid, dominant_mineral, report_count, scout_count,
                         mineral_diversity, country, last_updated, cluster_key,
                         convex_hull, radius_km)
                    VALUES (
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                        %s, %s, %s, %s, %s, NOW(), %s,
                        ST_ConvexHull(ST_Collect(ST_GeomFromText('MULTIPOINT(' || %s || ')', 4326))),
                        ST_MaxDistance(
                            ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                            ST_ConvexHull(ST_Collect(ST_GeomFromText('MULTIPOINT(' || %s || ')', 4326)))
                        ) * 111.32
                    )
                    ON CONFLICT (cluster_key) DO UPDATE SET
                        centroid          = EXCLUDED.centroid,
                        report_count      = EXCLUDED.report_count,
                        scout_count       = EXCLUDED.scout_count,
                        mineral_diversity = EXCLUDED.mineral_diversity,
                        last_updated      = NOW(),
                        convex_hull       = EXCLUDED.convex_hull,
                        radius_km         = EXCLUDED.radius_km
                    RETURNING id, dominant_mineral, report_count, country, last_updated
                """, (
                    centroid_lon, centroid_lat,
                    dominant, len(cluster_rows), scout_count,
                    mineral_diversity, country, cluster_key,
                    points_wkt,
                    centroid_lon, centroid_lat, points_wkt,
                ))
                row = cur.fetchone()
                if not row:
                    continue

                cluster_db_id = row['id']

                # Write cluster_id back to every report in this cluster
                cur.execute(
                    "UPDATE reports SET cluster_id = %s WHERE id = ANY(%s::uuid[])",
                    (cluster_db_id, cluster_report_ids)
                )

                new_clusters.append({**dict(row), 'report_ids': cluster_report_ids})

            # Remove clusters from this run's countries that are no longer
            # represented — unlink their reports first to avoid FK violations.
            if countries_in_run and seen_cluster_keys:
                cur.execute(
                    """UPDATE reports SET cluster_id = NULL
                       WHERE country = ANY(%s)
                         AND cluster_id IN (
                           SELECT id FROM anomaly_clusters
                           WHERE country = ANY(%s)
                             AND cluster_key != ALL(%s)
                         )""",
                    (countries_in_run, countries_in_run, seen_cluster_keys)
                )
                cur.execute(
                    """DELETE FROM anomaly_clusters
                       WHERE country = ANY(%s)
                         AND cluster_key != ALL(%s)""",
                    (countries_in_run, seen_cluster_keys)
                )

        conn.commit()
        publish_cluster_events(new_clusters)
        logger.info('Clustering cycle complete')

    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def publish_cluster_events(clusters: list) -> None:
    """Publish anomaly-detected events to Azure Service Bus topic."""
    if not SERVICE_BUS_CONNECTION_STRING:
        logger.warning('SERVICE_BUS_CONNECTION_STRING not set — skipping event publish')
        return
    if not clusters:
        return

    try:
        from azure.servicebus import ServiceBusClient, ServiceBusMessage

        client = ServiceBusClient.from_connection_string(SERVICE_BUS_CONNECTION_STRING)
        with client:
            # anomaly-detected is a topic — use get_topic_sender
            sender = client.get_topic_sender(topic_name=SERVICE_BUS_TOPIC)
            with sender:
                messages = []
                for cluster in clusters:
                    # Do NOT include dpiScore here — intelligence-api owns DPI calculation.
                    # The anomaly-detected message signals that a cluster exists; the
                    # notification-service reads the authoritative score from the DB.
                    body = {
                        'clusterId': str(cluster['id']),
                        'dominantMineral': cluster.get('dominant_mineral', 'unknown'),
                        'reportCount': cluster.get('report_count', 0),
                        'timestamp': str(cluster.get('last_updated', '')),
                    }
                    messages.append(ServiceBusMessage(
                        json.dumps(body),
                        content_type='application/json',
                    ))

                # Send in batches of 100
                for i in range(0, len(messages), 100):
                    batch = sender.create_message_batch()
                    for msg in messages[i:i + 100]:
                        try:
                            batch.add_message(msg)
                        except Exception:
                            pass
                    sender.send_messages(batch)

        logger.info(f'Published {len(clusters)} anomaly-detected events to Service Bus')

    except ImportError:
        logger.warning('azure-servicebus not installed — skipping event publish')
    except Exception as e:
        logger.error(f'Failed to publish cluster events: {e}')
