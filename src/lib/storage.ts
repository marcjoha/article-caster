import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
});

const bucketName = process.env.GCS_BUCKET_NAME!;
const bucket = storage.bucket(bucketName);

export const uploadFile = async (destinationPath: string, buffer: Buffer, contentType: string): Promise<string> => {
  const file = bucket.file(destinationPath);
  await file.save(buffer, {
    metadata: {
      contentType,
    },
    resumable: false,
  });
  
  try {
    await file.makePublic();
  } catch (e) {
    console.log('Failed to make public, assuming bucket level uniform access or public by default', e);
  }
  
  return `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
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
