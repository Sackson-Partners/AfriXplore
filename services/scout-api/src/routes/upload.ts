import { Router, Request, Response } from 'express';
import multer from 'multer';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images and audio files are allowed'));
    }
  },
});

const STORAGE_ACCOUNT = process.env.AZURE_STORAGE_ACCOUNT_NAME!;
const CONTAINER = 'uploads';

// POST /api/v1/upload/photo
router.post('/photo', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({
      type: 'https://afrixplore.io/errors/validation',
      title: 'No file uploaded',
      status: 400,
    });
  }

  const userId = (req as any).userId;
  const ext = req.file.originalname.split('.').pop() || 'jpg';
  const blobName = `scouts/${userId}/photos/${uuidv4()}.${ext}`;

  const credential = new DefaultAzureCredential();
  const blobServiceClient = new BlobServiceClient(
    `https://${STORAGE_ACCOUNT}.blob.core.windows.net`,
    credential
  );

  const containerClient = blobServiceClient.getContainerClient(CONTAINER);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.uploadData(req.file.buffer, {
    blobHTTPHeaders: { blobContentType: req.file.mimetype },
    metadata: {
      uploadedBy: userId,
      originalName: req.file.originalname,
    },
  });

  const url = `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${CONTAINER}/${blobName}`;

  return res.status(201).json({
    url,
    blob_path: blobName,
    size: req.file.size,
    content_type: req.file.mimetype,
  });
});

export { router as uploadRouter };

export default router;
