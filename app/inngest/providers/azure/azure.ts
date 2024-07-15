import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import '@azure/storage-blob';
import { MongoClient } from 'mongodb';

import { inngest } from '@/inngest/client';
import { updateJobStatus } from '@/utils/job';
import type { Video } from '@/utils/store';

const getDbInstance = (env: string) => {
  let mongo: MongoClient;
  switch (env) {
    case 'dev':
      mongo = new MongoClient(process.env.MONGO_URI_DEV!);
      break;
    case 'qa':
      mongo = new MongoClient(process.env.MONGO_URI_QA!);
      break;
    case 'prod':
      mongo = new MongoClient(process.env.MONGO_URI_PROD!);
      break;
    default:
      throw new Error('Invalid environment');
  }

  return mongo.db();
};

export const fetchVideo = inngest.createFunction(
  { id: 'fetch-video-azure', name: 'Fetch video - Azure Blob Storage', concurrency: 10 },
  { event: 'truckload/video.fetch' },
  async ({ event, logger }) => {
    const payloadVideo = event.data.encrypted.video;
    const { environment } = event.data.encrypted.credentials.additionalMetadata!;
    const db = getDbInstance(environment);

    const accountName = event.data.encrypted.credentials.publicKey;
    const accountKey = event.data.encrypted.credentials.secretKey!;
    const blobName = event.data.encrypted.video.title!;
    const containerName = event.data.encrypted.video.url!;

    const foundVideo = await db.collection('videos').findOne({ uuid: payloadVideo.id });

    // double check as i put this in the other function
    if (!foundVideo) {
      logger.warn('Video not found in DB', { uuid: payloadVideo.id, environment });

      await updateJobStatus(event.data.jobId!, 'migration.video.progress', {
        video: {
          id: blobName,
          status: 'skipped',
          progress: 100,
        },
      });

      return null;
    }

    // double check as i put this in the other function
    if (foundVideo.muxAsset) {
      logger.info('Video already on Mux. Skipping', { uuid: payloadVideo.id, environment });

      await updateJobStatus(event.data.jobId!, 'migration.video.progress', {
        video: {
          id: blobName,
          status: 'skipped',
          progress: 100,
        },
      });

      return null;
    }

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const containerClient = blobServiceClient.getContainerClient(containerName);

    const sasOptions = {
      containerName,
      blobName,
      permissions: BlobSASPermissions.parse('r'),
      startsOn: new Date(),
      expiresOn: new Date(new Date().valueOf() + 86400), // 1 day
      protocol: SASProtocol.HttpsAndHttp,
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();
    const url = `${containerClient.url}/${blobName}?${sasToken}`;

    const video: Video = {
      id: payloadVideo.id,
      url,
      title: blobName,
    };

    return video;
  }
);

export const fetchPage = inngest.createFunction(
  { id: 'fetch-page-azure', name: 'Fetch page - Azure Blob Storage', concurrency: 1 },
  { event: 'truckload/migration.fetch-page' },
  async ({ event, logger }) => {
    const { environment } = event.data.encrypted.additionalMetadata!;
    const db = getDbInstance(environment);

    const accountName = event.data.encrypted.publicKey;
    const accountKey = event.data.encrypted.secretKey!;

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const videos: Video[] = [];
    let continuationToken: string | undefined = undefined;

    for await (const containersResponse of blobServiceClient.listContainers().byPage({ maxPageSize: 25 })) {
      for (const container of containersResponse.containerItems) {
        const containerClient = blobServiceClient.getContainerClient(container.name);

        logger.info(`Scanning container ${container.name}`);
        // Iterate through blobs with pagination
        for await (const blobsResponse of containerClient.listBlobsFlat().byPage({ maxPageSize: 50 })) {
          for (const blob of blobsResponse.segment.blobItems) {
            if (blob.name && /\.(mp4|mov)$/i.test(blob.name) && !/_/.test(blob.name)) {
              const blobWithoutExt = blob.name.split('.')[0];
              const foundVideo = await db.collection('videos').findOne({ uuid: blobWithoutExt });

              if (foundVideo && !foundVideo.muxAsset) {
                videos.push({ id: foundVideo.uuid, url: container.name, title: blob.name });
              }
            }
          }
        }
      }

      continuationToken = containersResponse.continuationToken;
      break;
    }

    const payload = {
      isTruncated: continuationToken !== undefined,
      cursor: continuationToken,
      videos,
    };

    return payload;
  }
);

export const handleWebhook = inngest.createFunction(
  { id: 'handle-azure-webhook', name: '[Azure] Update DB on Mux Webhook', concurrency: 5 },
  { event: 'truckload/azure.handle-webhook' },
  async ({ event, logger }) => {
    const passthrough = JSON.parse(event.data.mux.data.passthrough!) as {
      jobId: string;
      sourceVideoId: string;
      environment: string;
      title: string;
    };

    const { jobId, sourceVideoId, environment, title } = passthrough;

    const db = getDbInstance(environment);
    const foundVideo = await db.collection('videos').findOne({ uuid: sourceVideoId });

    // not likely to happen
    if (!foundVideo) {
      logger.warn('Video not found in DB', {
        videoUuid: sourceVideoId,
        environment,
      });
      return { status: 'skipped', reason: 'video not found' };
    }

    const uploadId = event.data.mux.data.id;
    const playbackId = event.data.mux.data.playback_ids![0].id;
    const muxThumbnail = `https://image.mux.com/${playbackId}/thumbnail.jpg`;
    const muxVideoPreviewGIF = `https://image.mux.com/${playbackId}/animated.gif`;
    const muxStreamingUrl = `https://stream.mux.com/${playbackId}.m3u8`;

    const update = {
      $set: {
        muxAsset: uploadId,
        muxStatus: event.data.mux.data.status,
        muxThumbnail,
        muxMMSThumbnail: muxThumbnail,
        muxOverlayedThumbnail: muxThumbnail,
        muxVideoPreviewGIF,
        muxOverlayedGIF: muxVideoPreviewGIF,
        muxVideoGIF: muxVideoPreviewGIF,
        muxPlaybackId: playbackId,
        muxStreamingUrl,
      },
    };

    const updatedVideo = await db.collection('videos').findOneAndUpdate({ uuid: sourceVideoId }, update);

    await updateJobStatus(jobId, 'migration.video.progress', {
      video: {
        id: title,
        status: 'completed',
        progress: 100,
      },
    });

    return { status: 'success', updatedVideo };
  }
);
