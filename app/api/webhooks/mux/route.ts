import { inngest } from '@/inngest/client';
import { MuxCallBackEvents } from '@/inngest/providers/mux/types';
import { updateJobStatus } from '@/utils/job';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.data.passthrough) {
    // this will happen when a video is uploaded via video upload, and not this migration
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }

  if (body.type === MuxCallBackEvents.ASSET_CREATED) {
    const passthrough = JSON.parse(body.data.passthrough);
    await updateJobStatus(passthrough.jobId, 'migration.video.progress', {
      video: {
        id: passthrough.title,
        status: 'in-progress',
        progress: 50,
      },
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (body.type === MuxCallBackEvents.ASSET_ERRORED) {
    const passthrough = JSON.parse(body.data.passthrough);
    await updateJobStatus(passthrough.jobId, 'migration.video.progress', {
      video: {
        id: passthrough.title,
        status: 'failed',
        progress: 100,
      },
    });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  if (body.type === MuxCallBackEvents.ASSET_READY) {
    await inngest.send({
      name: 'truckload/azure.handle-webhook',
      data: {
        mux: body,
      },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }

  return new Response(JSON.stringify({ ok: false }), { status: 200 });
}
