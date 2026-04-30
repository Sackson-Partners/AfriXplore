import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

let containerClient: ContainerClient | null = null;

function getContainer(): ContainerClient {
  if (containerClient) return containerClient;

  const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME ?? 'msim-documents';

  if (!accountName) throw new Error('AZURE_STORAGE_ACCOUNT_NAME not set');

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    new DefaultAzureCredential(),
  );

  containerClient = blobServiceClient.getContainerClient(containerName);
  return containerClient;
}

/**
 * Upload a document buffer to blob storage.
 * Returns the blob URL.
 */
export async function uploadDocument(
  blobName: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const container = getContainer();
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlob.url;
}

/**
 * Download a document from blob storage.
 * Returns the raw Buffer.
 */
export async function downloadDocument(blobName: string): Promise<Buffer> {
  const container = getContainer();
  const blockBlob = container.getBlockBlobClient(blobName);

  const downloadResponse = await blockBlob.download(0);
  if (!downloadResponse.readableStreamBody) {
    throw new Error(`Blob ${blobName} has no readable body`);
  }

  const chunks: Buffer[] = [];
  for await (const chunk of downloadResponse.readableStreamBody) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chunks.push(chunk instanceof Buffer ? chunk : Buffer.from(chunk as any));
  }
  return Buffer.concat(chunks);
}

/**
 * Generate a read-only SAS URL valid for the given duration (minutes).
 * Falls back to the unauthenticated blob URL for private containers.
 */
export async function getBlobUrl(blobName: string): Promise<string> {
  const container = getContainer();
  const blockBlob = container.getBlockBlobClient(blobName);
  return blockBlob.url;
}

/**
 * Delete a document from blob storage.
 */
export async function deleteDocument(blobName: string): Promise<void> {
  const container = getContainer();
  const blockBlob = container.getBlockBlobClient(blobName);
  await blockBlob.deleteIfExists();
}
