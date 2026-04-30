"""
AfriXplore — ML Retraining Pipeline
Triggered monthly by GitHub Actions
Retrains Custom Vision model with new ground-truth labelled data
"""

import os
import json
import logging
import base64
import shutil
import time
from datetime import datetime
from pathlib import Path
import requests
import psycopg2
from psycopg2.extras import RealDictCursor
from azure.storage.blob import BlobServiceClient

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATABASE_URL = os.getenv('DATABASE_URL')
CUSTOM_VISION_TRAINING_ENDPOINT = os.getenv('CUSTOM_VISION_TRAINING_ENDPOINT')
CUSTOM_VISION_TRAINING_KEY = os.getenv('CUSTOM_VISION_TRAINING_KEY')
CUSTOM_VISION_PROJECT_ID = os.getenv('CUSTOM_VISION_PROJECT_ID')
STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
MINIMUM_ACCURACY_IMPROVEMENT = 0.02


def get_ground_truth_samples(conn, since_days: int = 30) -> list:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT
                r.id,
                r.image_urls,
                r.mineral_type as ground_truth_mineral,
                ma.predictions as ai_predictions,
                ma.confidence as previous_confidence
            FROM reports r
            JOIN mineral_assessments ma ON ma.report_id = r.id
            WHERE r.status = 'processed'
              AND r.created_at > NOW() - INTERVAL '%s days'
              AND r.image_urls IS NOT NULL
              AND array_length(r.image_urls, 1) > 0
            ORDER BY r.created_at DESC
        """, (since_days,))
        return cur.fetchall()


def download_training_images(samples: list, output_dir: Path) -> dict:
    blob_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
    mineral_images = {}
    output_dir.mkdir(parents=True, exist_ok=True)

    for sample in samples:
        mineral = sample['ground_truth_mineral']
        # image_urls is TEXT[] — plain HTTPS URLs, not JSON objects
        image_urls = sample.get('image_urls') or []
        if not image_urls:
            continue
        if mineral not in mineral_images:
            mineral_images[mineral] = []

        mineral_dir = output_dir / mineral
        mineral_dir.mkdir(exist_ok=True)

        for url in image_urls[:2]:
            if not url:
                continue
            try:
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                filename = url.split('/')[-1].split('?')[0] or f"{sample['id']}.jpg"
                image_path = mineral_dir / f"{sample['id']}_{filename}"
                with open(image_path, 'wb') as f:
                    f.write(response.content)
                mineral_images[mineral].append(str(image_path))
            except Exception as e:
                logger.warning(f"Failed to download {url}: {e}")

    return mineral_images


def evaluate_current_model_accuracy(mineral_images: dict) -> float:
    prediction_key = os.getenv('CUSTOM_VISION_PREDICTION_KEY')
    prediction_endpoint = os.getenv('CUSTOM_VISION_PREDICTION_ENDPOINT')
    project_id = CUSTOM_VISION_PROJECT_ID
    published_name = os.getenv('CUSTOM_VISION_PUBLISHED_NAME', 'mineral-id-v1')

    correct = 0
    total = 0

    for mineral, image_paths in mineral_images.items():
        for image_path in image_paths[:10]:
            try:
                with open(image_path, 'rb') as f:
                    response = requests.post(
                        f"{prediction_endpoint}/customvision/v3.0/Prediction/{project_id}/classify/iterations/{published_name}/image",
                        headers={'Prediction-Key': prediction_key, 'Content-Type': 'application/octet-stream'},
                        data=f.read(),
                        timeout=10,
                    )
                if response.status_code == 200:
                    predictions = response.json()['predictions']
                    top = max(predictions, key=lambda x: x['probability'])
                    if top['tagName'].lower() == mineral.lower():
                        correct += 1
                    total += 1
            except Exception as e:
                logger.warning(f"Evaluation error for {image_path}: {e}")

    accuracy = correct / total if total > 0 else 0
    logger.info(f"Current model accuracy: {accuracy:.3f} ({correct}/{total})")
    return accuracy


def upload_new_training_images(mineral_images: dict) -> dict:
    training_key = CUSTOM_VISION_TRAINING_KEY
    training_endpoint = CUSTOM_VISION_TRAINING_ENDPOINT
    project_id = CUSTOM_VISION_PROJECT_ID
    headers = {'Training-Key': training_key, 'Content-Type': 'application/json'}

    tags_response = requests.get(
        f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/tags",
        headers=headers,
    )
    existing_tags = {t['name']: t['id'] for t in tags_response.json()}
    upload_stats = {}

    for mineral, image_paths in mineral_images.items():
        if not image_paths:
            continue

        if mineral not in existing_tags:
            tag_response = requests.post(
                f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/tags",
                headers=headers,
                params={'name': mineral},
            )
            tag_id = tag_response.json()['id']
            existing_tags[mineral] = tag_id
        else:
            tag_id = existing_tags[mineral]

        uploaded = 0
        for i in range(0, len(image_paths), 64):
            batch = image_paths[i:i + 64]
            image_data_list = []
            for path in batch:
                try:
                    with open(path, 'rb') as f:
                        image_data_list.append({
                            'name': Path(path).name,
                            'contents': base64.b64encode(f.read()).decode(),
                            'tagIds': [tag_id],
                        })
                except Exception as e:
                    logger.warning(f"Cannot read {path}: {e}")

            if image_data_list:
                batch_response = requests.post(
                    f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/images/image",
                    headers={**headers, 'Content-Type': 'application/json'},
                    json={'images': image_data_list},
                )
                if batch_response.status_code in (200, 207):
                    uploaded += len(image_data_list)

        upload_stats[mineral] = uploaded
        logger.info(f"Uploaded {uploaded} images for {mineral}")

    return upload_stats


def train_and_evaluate_new_model(current_accuracy: float):
    training_key = CUSTOM_VISION_TRAINING_KEY
    training_endpoint = CUSTOM_VISION_TRAINING_ENDPOINT
    project_id = CUSTOM_VISION_PROJECT_ID
    headers = {'Training-Key': training_key}

    logger.info("Starting Custom Vision model training...")
    train_response = requests.post(
        f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/train",
        headers=headers,
        params={'trainingType': 'Advanced'},
    )

    if train_response.status_code not in (200, 201):
        raise Exception(f"Training failed: {train_response.text}")

    iteration_id = train_response.json()['id']
    logger.info(f"Training started — iteration: {iteration_id}")

    for attempt in range(60):
        time.sleep(30)
        status_response = requests.get(
            f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/iterations/{iteration_id}",
            headers=headers,
        )
        status = status_response.json().get('status')
        logger.info(f"Training status: {status} (attempt {attempt + 1}/60)")

        if status == 'Completed':
            break
        elif status == 'Failed':
            raise Exception(f"Training failed: {status_response.json().get('statusMessage')}")

    perf_response = requests.get(
        f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/iterations/{iteration_id}/performance",
        headers=headers,
        params={'threshold': 0.5},
    )
    perf_data = perf_response.json()
    new_accuracy = perf_data.get('precision', 0)

    logger.info(f"New model precision: {new_accuracy:.3f} (current: {current_accuracy:.3f})")

    should_deploy = new_accuracy >= (current_accuracy + MINIMUM_ACCURACY_IMPROVEMENT)
    return should_deploy, iteration_id, new_accuracy


def publish_new_model(iteration_id: str, version_name: str):
    training_key = CUSTOM_VISION_TRAINING_KEY
    training_endpoint = CUSTOM_VISION_TRAINING_ENDPOINT
    project_id = CUSTOM_VISION_PROJECT_ID

    response = requests.post(
        f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/iterations/{iteration_id}/publish",
        headers={'Training-Key': training_key},
        params={
            'publishName': version_name,
            'predictionId': os.getenv('CUSTOM_VISION_PREDICTION_RESOURCE_ID'),
        },
    )

    if response.status_code not in (200, 201):
        raise Exception(f"Model publish failed: {response.text}")

    logger.info(f"Model published as: {version_name}")


def export_tflite_model(iteration_id: str) -> bytes:
    training_key = CUSTOM_VISION_TRAINING_KEY
    training_endpoint = CUSTOM_VISION_TRAINING_ENDPOINT
    project_id = CUSTOM_VISION_PROJECT_ID
    headers = {'Training-Key': training_key}

    export_response = requests.post(
        f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/iterations/{iteration_id}/export",
        headers=headers,
        params={'platform': 'TensorFlow', 'flavor': 'TFLite'},
    )

    if export_response.status_code not in (200, 202):
        raise Exception(f"Export request failed: {export_response.text}")

    for _ in range(30):
        time.sleep(10)
        exports_response = requests.get(
            f"{training_endpoint}/customvision/v3.3/Training/projects/{project_id}/iterations/{iteration_id}/export",
            headers=headers,
        )
        for export in exports_response.json():
            if export['platform'] == 'TensorFlow' and export['flavor'] == 'TFLite':
                if export['status'] == 'Done' and export.get('downloadUri'):
                    model_response = requests.get(export['downloadUri'])
                    logger.info("TFLite model exported")
                    return model_response.content

    raise Exception("TFLite export timed out")


def upload_tflite_to_blob(model_bytes: bytes, version: str) -> str:
    blob_client = BlobServiceClient.from_connection_string(STORAGE_CONNECTION_STRING)
    container = blob_client.get_container_client('ml-models')

    try:
        container.create_container()
    except Exception:
        pass

    blob_name = f"mineral-id/{version}/mineral_id.tflite"
    container.get_blob_client(blob_name).upload_blob(model_bytes, overwrite=True)
    container.get_blob_client('mineral-id/latest/mineral_id.tflite').upload_blob(model_bytes, overwrite=True)
    container.get_blob_client('mineral-id/current_version.json').upload_blob(
        json.dumps({'version': version, 'updated_at': datetime.now().isoformat(), 'blob_path': blob_name}),
        overwrite=True
    )

    logger.info(f"TFLite model uploaded: {blob_name}")
    return blob_name


def run_ml_pipeline():
    logger.info("AfriXplore ML Retraining Pipeline starting...")

    conn = psycopg2.connect(DATABASE_URL)
    output_dir = Path('/tmp/afrixplore_training_data')

    try:
        samples = get_ground_truth_samples(conn, since_days=30)
        logger.info(f"Found {len(samples)} ground-truth samples")

        if len(samples) < 50:
            logger.info(f"Only {len(samples)} samples — minimum 50 required. Skipping.")
            return

        try:
            mineral_images = download_training_images(samples, output_dir)
        except Exception as e:
            logger.error(f"Image download failed — skipping pipeline run: {e}")
            return

        total_images = sum(len(v) for v in mineral_images.values())
        logger.info(f"Downloaded {total_images} images across {len(mineral_images)} minerals")

        if total_images == 0:
            logger.warning("No images downloaded — skipping pipeline run")
            return

        try:
            current_accuracy = evaluate_current_model_accuracy(mineral_images)
        except Exception as e:
            logger.warning(f"Model evaluation failed — using accuracy=0.0 as baseline: {e}")
            current_accuracy = 0.0

        try:
            upload_stats = upload_new_training_images(mineral_images)
            logger.info(f"Upload stats: {upload_stats}")
        except Exception as e:
            logger.error(f"Training image upload failed — aborting pipeline run: {e}")
            return

        version = f"mineral-id-v{datetime.now().strftime('%Y%m')}"

        try:
            should_deploy, iteration_id, new_accuracy = train_and_evaluate_new_model(current_accuracy)
        except Exception as e:
            logger.error(f"Model training failed — aborting pipeline run: {e}")
            return

        if should_deploy:
            logger.info(f"Deploying improved model ({new_accuracy:.3f} vs {current_accuracy:.3f})...")
            try:
                publish_new_model(iteration_id, version)
                tflite_bytes = export_tflite_model(iteration_id)
                upload_tflite_to_blob(tflite_bytes, version)
                logger.info(f"ML Pipeline SUCCESS — new accuracy: {new_accuracy:.3f}, version: {version}")
            except Exception as e:
                logger.error(f"Model deploy/export failed — iteration {iteration_id} trained but not published: {e}")
                return

            write_pipeline_result(
                version=version,
                deployed=True,
                previous_accuracy=current_accuracy,
                new_accuracy=new_accuracy,
            )
        else:
            logger.info(f"Model not deployed: improvement {new_accuracy - current_accuracy:.3f} below threshold {MINIMUM_ACCURACY_IMPROVEMENT}")
            write_pipeline_result(
                version=version,
                deployed=False,
                previous_accuracy=current_accuracy,
                new_accuracy=new_accuracy,
            )

    finally:
        conn.close()
        if output_dir.exists():
            shutil.rmtree(output_dir)


def write_pipeline_result(
    version: str,
    deployed: bool,
    previous_accuracy: float,
    new_accuracy: float,
) -> None:
    """Write pipeline result JSON for GitHub Actions to read."""
    result = {
        "version": version,
        "deployed": deployed,
        "previous_accuracy": round(previous_accuracy, 4),
        "new_accuracy": round(new_accuracy, 4),
        "timestamp": datetime.now().isoformat(),
    }
    with open("/tmp/ml_pipeline_result.json", "w") as f:
        json.dump(result, f)
    logger.info(f"Pipeline result written: {result}")


if __name__ == '__main__':
    run_ml_pipeline()
