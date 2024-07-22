import { AzureMediaServices } from '@azure/arm-mediaservices';
import { ClientSecretCredential } from '@azure/identity';
import { ContainerClient } from '@azure/storage-blob';
import '@azure/storage-blob';

import { inngest } from '@/inngest/client';
import { getDbInstance } from '@/utils/db';
import { updateJobStatus } from '@/utils/job';
import type { Video } from '@/utils/store';

export const fetchVideo = inngest.createFunction(
  {
    id: 'fetch-video-azure',
    name: 'Fetch video - Azure Blob Storage',
    concurrency: 10,
    retries: 1,
  },
  { event: 'truckload/video.fetch' },
  async ({ event }) => {
    const payloadVideo = event.data.encrypted.video;

    const credentials = new ClientSecretCredential(
      event.data.encrypted.credentials.additionalMetadata!.tenantId,
      event.data.encrypted.credentials.publicKey,
      event.data.encrypted.credentials.secretKey!
    );

    let extIndex = 0;
    const EXTENSIONS = ['.mp4', '.mov', '.MP4', '.MOV', '.webm', '.WEBM', ''];

    const ams = new AzureMediaServices(credentials, process.env.AZURE_SUBSCRIPTION_ID!);
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + 1); // 1 hour of expiration

    const response = await ams.assets.listContainerSas(
      event.data.encrypted.credentials.additionalMetadata!.resourceGroup,
      event.data.encrypted.credentials.additionalMetadata!.accountName,
      `input-${payloadVideo.id}`,
      {
        permissions: 'ReadWrite',
        expiryTime: expirationDate,
      }
    );

    let fileName: string;
    let url: string;
    while (extIndex < EXTENSIONS.length) {
      try {
        fileName = `${payloadVideo.id}${EXTENSIONS[extIndex]}`;
        const containerClient = new ContainerClient(response.assetContainerSasUrls![0]);
        const blockBlobClient = containerClient.getBlockBlobClient(fileName);
        await blockBlobClient.downloadToBuffer(0); // only way to check if file exists
        url = blockBlobClient.url;
        break;
      } catch (e) {
        extIndex++;
      }
    }

    const video: Video = {
      id: payloadVideo.id,
      url: url!,
      title: fileName!,
    };

    return video;
  }
);

export const fetchPage = inngest.createFunction(
  { id: 'fetch-page-azure', name: 'Fetch page - Azure Blob Storage', concurrency: 1 },
  { event: 'truckload/migration.fetch-page' },
  async ({ event }) => {
    const { environment, accountName } = event.data.encrypted.additionalMetadata!;
    const db = getDbInstance(environment);

    const videosFromDb = (await db
      .collection('videos')
      .find({
        muxAsset: { $exists: false },
        deleted: { $ne: true },
        status: 'Processed',
        streamingUrl: { $regex: accountName },
        uuid: { $ne: null },
      })
      .sort({ createdAt: -1 })
      .limit(5000)
      .project({ uuid: 1 })
      .toArray()) as { uuid: string }[];

    return {
      isTruncated: false,
      cursor: null,
      videos: videosFromDb.map((video) => ({ id: video.uuid })),
    };
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

    const updatedVideo = await db
      .collection('videos')
      .findOneAndUpdate({ uuid: sourceVideoId, location: foundVideo.location }, update);

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
