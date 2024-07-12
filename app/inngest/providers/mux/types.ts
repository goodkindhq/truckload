export enum MuxCallBackEvents {
  ASSET_CREATED = 'video.asset.created',
  ASSET_READY = 'video.asset.ready',
  ASSET_ERRORED = 'video.asset.errored',
}

export enum MuxObjectType {
  ASSET = 'asset',
}

export enum MuxStatus {
  WAITING = 'waiting',
  ASSET_CREATED = 'asset_created',
  PREPARING = 'preparing',
  READY = 'ready',
  DELETED = 'deleted',
  ERRORED = 'errored',
}

export type MuxCallbackData = {
  type: MuxCallBackEvents;
  object: { type: MuxObjectType; id: string };
  environment: { name: 'Development' | 'Production' | 'Qa' };
  data: {
    status: MuxStatus;
    id: string;
    playback_ids?: { id: string }[];
    master?: {
      status: MuxStatus;
      url?: string;
    };
    passthrough?: string; // JSON stringified object
  };
};
