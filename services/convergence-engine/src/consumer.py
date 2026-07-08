"""
Service Bus consumers for event-driven convergence score recomputation.

Subscribes to:
  - anomaly-detected       → published by geoswarm-api when a new anomaly is saved
  - archive-document-indexed → published by msim-api when a document is ingested

Each message must carry a `mine_id` field (UUID string). On receipt the
convergence score for that mine is recomputed and persisted.
"""

import asyncio
import json
import logging

from azure.servicebus.aio import ServiceBusClient

from .config import settings
from .routers.score import compute_score

logger = logging.getLogger(__name__)

# (topic, subscription) pairs to consume
_TOPICS: list[tuple[str, str]] = [
    ("anomaly-detected", "convergence-engine"),
    ("archive-document-indexed", "convergence-engine"),
]


async def _handle_message(topic: str, body: dict) -> None:
    mine_id: str | None = body.get("mine_id")
    if not mine_id:
        logger.warning("Received message on %s without mine_id — skipping", topic)
        return
    try:
        score = await compute_score(mine_id, triggered_by=topic)
        logger.info(
            "Score recomputed mine_id=%s score=%.2f certified=%s triggered_by=%s",
            mine_id,
            score.convergence_score,
            score.certified_target,
            topic,
        )
    except Exception as exc:
        logger.warning("Score recompute failed mine_id=%s error=%s", mine_id, exc)
        raise  # re-raise so caller can abandon the message


async def _consume_topic(conn_str: str, topic: str, subscription: str) -> None:
    """Long-running loop: receives messages from one Service Bus subscription."""
    while True:
        try:
            async with ServiceBusClient.from_connection_string(conn_str) as client:
                receiver = client.get_subscription_receiver(
                    topic_name=topic,
                    subscription_name=subscription,
                )
                async with receiver:
                    logger.info("Consumer ready topic=%s subscription=%s", topic, subscription)
                    async for msg in receiver:
                        try:
                            raw = msg.body
                            if not isinstance(raw, bytes):
                                raw = b"".join(raw)
                            body = json.loads(raw)
                            await _handle_message(topic, body)
                            await receiver.complete_message(msg)
                        except Exception as exc:
                            logger.error(
                                "Failed processing message on %s: %s", topic, exc
                            )
                            await receiver.abandon_message(msg)
        except asyncio.CancelledError:
            logger.info("Consumer cancelled topic=%s", topic)
            return
        except Exception as exc:
            logger.error(
                "Consumer error topic=%s — reconnecting in 10s: %s", topic, exc
            )
            await asyncio.sleep(10)


def start_consumers() -> list[asyncio.Task]:
    """
    Spawn one async Task per subscription. Returns the tasks so the caller
    (lifespan) can cancel them on shutdown.
    """
    conn_str = settings.service_bus_connection_string
    if not conn_str:
        logger.warning(
            "SERVICE_BUS_CONNECTION_STRING not configured — convergence consumers disabled"
        )
        return []

    tasks: list[asyncio.Task] = []
    for topic, subscription in _TOPICS:
        task = asyncio.create_task(
            _consume_topic(conn_str, topic, subscription),
            name=f"sb-consumer-{topic}",
        )
        tasks.append(task)

    logger.info("Started %d Service Bus consumer(s)", len(tasks))
    return tasks
