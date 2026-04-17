"""
AfriXplore Geospatial Worker — Entry Point
Runs DBSCAN clustering on a 15-minute schedule
"""

import os
import time
import logging
from clustering import run_clustering_cycle

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s'
)

logger = logging.getLogger(__name__)
INTERVAL_MINUTES = int(os.getenv('CLUSTERING_INTERVAL_MINUTES', '15'))


def main():
    logger.info(f'AfriXplore Geospatial Worker starting (interval: {INTERVAL_MINUTES}m)')

    while True:
        try:
            run_clustering_cycle()
        except Exception as e:
            logger.error(f'Clustering cycle failed: {e}', exc_info=True)

        logger.info(f'Sleeping {INTERVAL_MINUTES} minutes until next cycle...')
        time.sleep(INTERVAL_MINUTES * 60)


if __name__ == '__main__':
    main()
