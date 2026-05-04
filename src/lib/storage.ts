import { Storage } from '@google-cloud/storage';

const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT || 'airy-rock-454920-i5',
});

const bucketName = process.env.GCS_BUCKET_NAME || 'article-caster-media-airy-rock-454920-i5';
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
