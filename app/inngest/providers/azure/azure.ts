import {
  BlobSASPermissions,
  BlobServiceClient,
  SASProtocol,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
} from '@azure/storage-blob';
import '@azure/storage-blob';

import { inngest } from '@/inngest/client';
import type { Video } from '@/utils/store';

export const fetchVideo = inngest.createFunction(
  { id: 'fetch-video-azure', name: 'Fetch video - Azure Blob Storage', concurrency: 10 },
  { event: 'truckload/video.fetch' },
  async ({ event }) => {
    const accountName = event.data.encrypted.credentials.publicKey;
    const accountKey = event.data.encrypted.credentials.secretKey!;
    const blobName = event.data.encrypted.video.id;
    const containerName = event.data.encrypted.video.url!;

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
      id: blobName,
      url,
    };

    return video;
  }
);

export const fetchPage = inngest.createFunction(
  { id: 'fetch-page-azure', name: 'Fetch page - Azure Blob Storage', concurrency: 1 },
  { event: 'truckload/migration.fetch-page' },
  async ({ event }) => {
    const accountName = event.data.encrypted.publicKey;
    const accountKey = event.data.encrypted.secretKey!;

    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      sharedKeyCredential
    );

    const videos: Video[] = [];
    let containersIterator = blobServiceClient.listContainers().byPage({ maxPageSize: 25 });
    let containersResponse = (await containersIterator.next()).value;

    while (containersResponse.containerItems) {
      for (const container of containersResponse.containerItems) {
        const containerClient = blobServiceClient.getContainerClient(container.name);
        let blobsIterator = containerClient.listBlobsFlat().byPage({ maxPageSize: 100 });
        let blobsResponse = (await blobsIterator.next()).value;

        while (blobsResponse.segment.blobItems) {
          for (const blob of blobsResponse.segment.blobItems) {
            if (blob.name && /\.(mp4|mov)$/i.test(blob.name) && !/_/.test(blob.name)) {
              videos.push({ id: blob.name, url: container.name });
            }
          }

          if (blobsResponse.continuationToken) {
            blobsIterator = containerClient.listBlobsFlat().byPage({
              continuationToken: blobsResponse.continuationToken,
              maxPageSize: 100,
            });
            blobsResponse = (await blobsIterator.next()).value;
          } else {
            break;
          }
        }
      }

      if (containersResponse.continuationToken) {
        containersIterator = blobServiceClient.listContainers().byPage({
          continuationToken: containersResponse.continuationToken,
          maxPageSize: 25,
        });
        containersResponse = (await containersIterator.next()).value;
      } else {
        break;
      }
    }

    const payload = {
      isTruncated: containersResponse.continuationToken == null,
      cursor: containersResponse.continuationToken,
      videos,
    };
    return payload;
  }
);
