import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const bucketName = process.env.GCS_BUCKET_NAME!;
const bucket = storage.bucket(bucketName);

export const uploadFile = async (destinationPath: string, buffer: Buffer, contentType: string, contentDisposition?: string): Promise<string> => {
  const file = bucket.file(destinationPath);
  const metadata: { contentType: string; contentDisposition?: string } = {
    contentType,
  };
  if (contentDisposition) {
    metadata.contentDisposition = contentDisposition;
  }
  await file.save(buffer, {
    metadata,
  });
  
  try {
    await file.makePublic();
  } catch (e) {
    console.log('Failed to make public, assuming bucket level uniform access or public by default', e);
  }
  
  return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
};

export const streamUpload = (destinationPath: string, contentType: string) => {
  const file = bucket.file(destinationPath);
  const writeStream = file.createWriteStream({
    metadata: {
      contentType,
    },
    resumable: false, // Stream direct to GCS for speed, disables resumable uploads
  });

  const uploadPromise = new Promise<string>((resolve, reject) => {
    writeStream.on('finish', async () => {
      try {
        await file.makePublic();
      } catch (e) {
        console.log('Failed to make public, assuming bucket level uniform access or public by default', e);
      }
      resolve(`https://storage.googleapis.com/${bucketName}/${destinationPath}`);
    });
    writeStream.on('error', reject);
  });

  return { writeStream, uploadPromise };
};

export const getFileMetadata = async (publicUrl: string): Promise<{ size: number }> => {
  const urlPrefix = `https://storage.googleapis.com/${bucketName}/`;
  if (!publicUrl.startsWith(urlPrefix)) return { size: 0 };
  
  const destinationPath = publicUrl.substring(urlPrefix.length);
  const file = bucket.file(destinationPath);
  
  try {
    const [metadata] = await file.getMetadata();
    return { size: parseInt(String(metadata.size), 10) || 0 };
  } catch (e) {
    console.error('Failed to get file metadata', e);
    return { size: 0 };
  }
};

export const deleteFile = async (publicUrl: string): Promise<void> => {
  try {
    const urlPrefix = `https://storage.googleapis.com/${bucketName}/`;
    if (!publicUrl.startsWith(urlPrefix)) return;
    
    const destinationPath = publicUrl.substring(urlPrefix.length);
    const file = bucket.file(destinationPath);
    
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
    }
  } catch (e) {
    console.error('Failed to delete file from storage', e);
  }
};
