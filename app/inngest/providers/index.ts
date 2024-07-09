import * as ApiVideo from './api-video/api-video';
import * as Azure from './azure/azure';
import * as CloudflareStream from './cloudflare-stream/cloudflare-stream';
import * as Mux from './mux/mux';
import * as S3 from './s3/s3';

const providerFns = {
  'api-video': ApiVideo,
  'cloudflare-stream': CloudflareStream,
  mux: Mux,
  s3: S3,
  azure: Azure,
};

export default providerFns;
