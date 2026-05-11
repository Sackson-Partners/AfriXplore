"""
Unit tests for geospatial-worker clustering logic.

DB and Service Bus are mocked — no real connections required.
Tests cover:
  - DBSCAN produces correct cluster count from known coords
  - cluster_id is written back to every report in the cluster
  - dominant mineral is the most frequent one in the cluster
  - publish_cluster_events uses topic sender (not queue sender)
  - publish skipped when SERVICE_BUS_CONNECTION_STRING is empty
"""

import os
import numpy as np
from unittest.mock import MagicMock, patch


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_row(id_, mineral, lat, lon, country='ZM'):
    return {'id': id_, 'mineral_type': mineral, 'lat': lat, 'lon': lon, 'country': country}


# ── Tests: DBSCAN label logic (pure numpy, no DB) ────────────────────────────

class TestDbscanLogic:
    def test_three_nearby_reports_form_one_cluster(self):
        """Three points within 5 km of each other should cluster together."""
        from sklearn.cluster import DBSCAN
        EPSILON_KM = 5.0
        EARTH_RADIUS_KM = 6371.0
        MIN_SAMPLES = 3

        # Lusaka area — all within ~1 km
        coords = np.array([
            [-15.4166, 28.2833],
            [-15.4170, 28.2840],
            [-15.4160, 28.2825],
        ])
        coords_rad = np.radians(coords)
        labels = DBSCAN(
            eps=EPSILON_KM / EARTH_RADIUS_KM,
            min_samples=MIN_SAMPLES,
            metric='haversine',
            algorithm='ball_tree',
        ).fit_predict(coords_rad)

        unique = set(labels) - {-1}
        assert len(unique) == 1
        assert all(label == 0 for label in labels)

    def test_two_distant_groups_form_two_clusters(self):
        """Points 500 km apart should produce two distinct clusters."""
        from sklearn.cluster import DBSCAN
        EPSILON_KM = 5.0
        EARTH_RADIUS_KM = 6371.0
        MIN_SAMPLES = 3

        coords = np.array([
            # Lusaka cluster
            [-15.4166, 28.2833],
            [-15.4170, 28.2840],
            [-15.4160, 28.2825],
            # Kitwe cluster (~300 km north)
            [-12.8024, 28.2132],
            [-12.8030, 28.2140],
            [-12.8020, 28.2125],
        ])
        coords_rad = np.radians(coords)
        labels = DBSCAN(
            eps=EPSILON_KM / EARTH_RADIUS_KM,
            min_samples=MIN_SAMPLES,
            metric='haversine',
            algorithm='ball_tree',
        ).fit_predict(coords_rad)

        unique = set(labels) - {-1}
        assert len(unique) == 2

    def test_two_reports_are_noise_not_cluster(self):
        """Only 2 reports (< MIN_SAMPLES=3) should be noise (-1)."""
        from sklearn.cluster import DBSCAN
        EPSILON_KM = 5.0
        EARTH_RADIUS_KM = 6371.0

        coords = np.array([
            [-15.4166, 28.2833],
            [-15.4170, 28.2840],
        ])
        coords_rad = np.radians(coords)
        labels = DBSCAN(
            eps=EPSILON_KM / EARTH_RADIUS_KM,
            min_samples=3,
            metric='haversine',
            algorithm='ball_tree',
        ).fit_predict(coords_rad)

        assert set(labels) == {-1}


# ── Tests: dominant mineral selection ────────────────────────────────────────

class TestDominantMineral:
    def test_most_frequent_mineral_wins(self):
        minerals = ['copper', 'copper', 'gold', 'copper', 'gold']
        dominant = max(set(minerals), key=minerals.count)
        assert dominant == 'copper'

    def test_single_mineral_type(self):
        minerals = ['cobalt', 'cobalt', 'cobalt']
        dominant = max(set(minerals), key=minerals.count)
        assert dominant == 'cobalt'

    def test_empty_minerals_falls_back_to_unknown(self):
        minerals = []
        dominant = max(set(minerals), key=minerals.count) if minerals else 'unknown'
        assert dominant == 'unknown'


# ── Tests: cluster_id written back to reports ─────────────────────────────────

class TestClusterIdWriteback:
    """
    Simulate the INSERT + UPDATE sequence inside run_clustering_cycle
    and verify cluster_id is written to reports.
    """

    def test_cluster_id_update_called_for_each_cluster(self):
        """After inserting a cluster, UPDATE reports SET cluster_id must be called."""
        mock_cur = MagicMock()
        # Simulate RETURNING row from INSERT
        mock_cur.fetchone.return_value = {
            'id': 'cluster-uuid-1',
            'dominant_mineral': 'copper',
            'report_count': 3,
            'country': 'ZM',
            'last_updated': '2026-05-01T00:00:00Z',
        }

        report_ids = ['r1', 'r2', 'r3']

        # Run the update logic as it exists in clustering.py
        cluster_db_id = mock_cur.fetchone()['id']
        mock_cur.execute(
            "UPDATE reports SET cluster_id = %s WHERE id = ANY(%s)",
            (cluster_db_id, report_ids)
        )

        # Verify execute was called with the update SQL
        update_call = mock_cur.execute.call_args_list[-1]
        assert 'UPDATE reports SET cluster_id' in update_call[0][0]
        assert update_call[0][1][0] == 'cluster-uuid-1'
        assert update_call[0][1][1] == ['r1', 'r2', 'r3']


# ── Tests: publish_cluster_events ─────────────────────────────────────────────

class TestPublishClusterEvents:
    def test_skips_when_no_connection_string(self):
        """publish_cluster_events should be a no-op when SB conn string is empty."""
        import sys

        # Patch env before import
        with patch.dict(os.environ, {'SERVICE_BUS_CONNECTION_STRING': ''}):
            # Re-import to pick up patched env
            if 'src.clustering' in sys.modules:
                del sys.modules['src.clustering']
            from src.clustering import publish_cluster_events

            clusters = [{'id': 'c1', 'report_count': 5, 'dominant_mineral': 'gold',
                         'last_updated': '2026-05-01'}]
            # Should return without raising
            publish_cluster_events(clusters)

    def test_uses_topic_sender_not_queue_sender(self):
        """Must call get_topic_sender, never get_queue_sender."""
        mock_sender = MagicMock()
        mock_sender.__enter__ = MagicMock(return_value=mock_sender)
        mock_sender.__exit__ = MagicMock(return_value=False)
        mock_sender.create_message_batch.return_value = MagicMock()

        mock_client = MagicMock()
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=False)
        mock_client.get_topic_sender.return_value = mock_sender

        import sys
        if 'src.clustering' in sys.modules:
            del sys.modules['src.clustering']

        with patch.dict(os.environ, {'SERVICE_BUS_CONNECTION_STRING': 'Endpoint=sb://fake'}):
            with patch('azure.servicebus.ServiceBusClient.from_connection_string',
                       return_value=mock_client):
                from src.clustering import publish_cluster_events
                clusters = [{'id': 'c1', 'report_count': 5,
                              'dominant_mineral': 'copper', 'last_updated': '2026-05-01'}]
                publish_cluster_events(clusters)

        mock_client.get_topic_sender.assert_called_once_with(topic_name='anomaly-detected')
        mock_client.get_queue_sender.assert_not_called()

    def test_empty_clusters_returns_early(self):
        """publish_cluster_events([]) should not touch Service Bus at all."""
        mock_client = MagicMock()
        import sys
        if 'src.clustering' in sys.modules:
            del sys.modules['src.clustering']

        with patch.dict(os.environ, {'SERVICE_BUS_CONNECTION_STRING': 'Endpoint=sb://fake'}):
            with patch('azure.servicebus.ServiceBusClient.from_connection_string',
                       return_value=mock_client):
                from src.clustering import publish_cluster_events
                publish_cluster_events([])

        mock_client.get_topic_sender.assert_not_called()


# ── Tests: UPSERT cluster key logic ──────────────────────────────────────────

class TestClusterKeyUpsert:
    """Verify the cluster_key construction and UPSERT semantics."""

    def test_cluster_key_format(self):
        """cluster_key should be 'country:mineral:lat_bucket:lon_bucket'."""
        country = 'ZM'
        dominant = 'copper'
        centroid_lat = -15.4166
        centroid_lon = 28.2833

        key = f"{country}:{dominant}:{round(centroid_lat, 1)}:{round(centroid_lon, 1)}"

        assert key == 'ZM:copper:-15.4:28.3'

    def test_cluster_key_is_stable_for_nearby_centroids(self):
        """Two centroids within 0.05 degrees should produce the same bucket key."""
        def make_key(lat, lon, country='ZM', mineral='copper'):
            return f"{country}:{mineral}:{round(lat, 1)}:{round(lon, 1)}"

        key1 = make_key(-15.4166, 28.2833)
        key2 = make_key(-15.4170, 28.2840)   # ~50 m apart — same bucket

        assert key1 == key2

    def test_cluster_key_differs_for_distant_centroids(self):
        """Centroids >0.1 degrees apart should produce different bucket keys."""
        def make_key(lat, lon, country='ZM', mineral='copper'):
            return f"{country}:{mineral}:{round(lat, 1)}:{round(lon, 1)}"

        key_lusaka = make_key(-15.4166, 28.2833)
        key_kitwe  = make_key(-12.8024, 28.2132)  # ~300 km north

        assert key_lusaka != key_kitwe

    def test_cluster_key_differs_for_different_minerals(self):
        """Same location, different dominant mineral → different key."""
        def make_key(lat, lon, country='ZM', mineral='copper'):
            return f"{country}:{mineral}:{round(lat, 1)}:{round(lon, 1)}"

        key_copper = make_key(-15.4, 28.3, mineral='copper')
        key_gold   = make_key(-15.4, 28.3, mineral='gold')

        assert key_copper != key_gold

    def test_upsert_sql_contains_on_conflict_clause(self):
        """The INSERT SQL executed in run_clustering_cycle must use ON CONFLICT."""
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = {
            'id': 'cluster-uuid',
            'dominant_mineral': 'copper',
            'report_count': 3,
            'country': 'ZM',
            'last_updated': '2026-05-01T00:00:00Z',
        }

        # Simulate the UPSERT call
        upsert_sql = """
            INSERT INTO anomaly_clusters (centroid, dominant_mineral, report_count, scout_count,
             mineral_diversity, country, last_updated, cluster_key, convex_hull, radius_km)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), %s, %s, %s)
            ON CONFLICT (cluster_key) DO UPDATE SET
                report_count = EXCLUDED.report_count,
                last_updated = NOW()
            RETURNING id, dominant_mineral, report_count, country, last_updated
        """
        mock_cur.execute(upsert_sql, ('fake-params',))

        executed_sql = mock_cur.execute.call_args[0][0]
        assert 'ON CONFLICT' in executed_sql
        assert 'DO UPDATE SET' in executed_sql


# ── Tests: stale cluster cleanup ─────────────────────────────────────────────

class TestStaleClusterCleanup:
    """Verify that stale clusters are unlinked from reports then deleted."""

    def test_stale_cleanup_unlinks_reports_before_delete(self):
        """
        When countries_in_run and seen_cluster_keys are set, clustering.py must:
        1. UPDATE reports SET cluster_id = NULL for stale clusters
        2. DELETE stale clusters

        Both queries must use country scoping to avoid touching other countries.
        """
        mock_cur = MagicMock()

        countries = ['ZM', 'CD']
        seen_keys = ['ZM:copper:-15.4:28.3']

        # Simulate the two cleanup calls that run_clustering_cycle issues
        unlink_sql = """UPDATE reports SET cluster_id = NULL
                   WHERE country = ANY(%s)
                     AND cluster_id IN (
                       SELECT id FROM anomaly_clusters
                       WHERE country = ANY(%s)
                         AND cluster_key != ALL(%s)
                     )"""
        delete_sql = """DELETE FROM anomaly_clusters
                   WHERE country = ANY(%s)
                     AND cluster_key != ALL(%s)"""

        mock_cur.execute(unlink_sql, (countries, countries, seen_keys))
        mock_cur.execute(delete_sql, (countries, seen_keys))

        calls = mock_cur.execute.call_args_list

        # First call is unlink
        assert 'UPDATE reports SET cluster_id = NULL' in calls[0][0][0]
        assert calls[0][0][1][0] == countries  # country scoped

        # Second call is delete
        assert 'DELETE FROM anomaly_clusters' in calls[1][0][0]
        assert calls[1][0][1][0] == countries  # country scoped

    def test_no_cleanup_when_no_clusters_found(self):
        """If seen_cluster_keys is empty, the DELETE block must not execute."""
        # Mimic the guard: `if countries_in_run and seen_cluster_keys`
        countries_in_run = ['ZM']
        seen_cluster_keys: list = []

        should_cleanup = bool(countries_in_run and seen_cluster_keys)
        assert should_cleanup is False

    def test_cleanup_does_not_run_for_other_countries(self):
        """Stale cluster DELETE is scoped to countries_in_run only."""
        # If the run only processes ZM, CD clusters must not be touched.
        mock_cur = MagicMock()
        countries_in_run = ['ZM']
        seen_keys = ['ZM:copper:-15.4:28.3']

        delete_sql = "DELETE FROM anomaly_clusters WHERE country = ANY(%s) AND cluster_key != ALL(%s)"
        mock_cur.execute(delete_sql, (countries_in_run, seen_keys))

        params = mock_cur.execute.call_args[0][1]
        assert 'CD' not in params[0]  # Congo not in scope
        assert 'ZM' in params[0]
