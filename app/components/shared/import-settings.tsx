import useMigrationStore from '@/utils/store';
import type { PlatformConfig } from '@/utils/store';
import Heading from '../heading';

const PLATFORM_METADATA_FIELDS = [
  {
    id: 'mux',
    fields: [
      {
        label: 'Encoding tier',
        description: 'The encoding tier informs the cost, quality, and available platform features for the asset.',
        docsUrl: 'https://docs.mux.com/guides/use-encoding-tiers',
        name: 'encodingTier',
        type: 'select',
        values: ['baseline', 'smart'],
      },
      {
        label: 'Max resolution tier',
        description:
          'This field controls the maximum resolution that Mux will encode, store, and deliver your media in. Mux does not to automatically ingest content at 4K so that you can avoid unexpectedly high ingest bills',
        docsUrl: 'https://docs.mux.com/guides/stream-videos-in-4k',
        name: 'maxResolutionTier',
        type: 'select',
        values: ['1080p', '1440p', '2160p'],
      },
      {
        label: 'Auto-generate captions',
        description: 'Automatically generate captions for your videos',
        docsUrl: 'https://docs.mux.com/guides/add-autogenerated-captions-and-use-transcripts',
        name: 'autoGenerateCaptions',
        type: 'checkbox',
      },
      {
        label: 'Playback policy',
        description:
          'Playback policies allow you to control the different ways users can view and interact with your content.',
        docsUrl: 'https://docs.mux.com/guides/secure-video-playback',
        name: 'playbackPolicy',
        type: 'multi-checkbox',
        values: ['public', 'signed'],
      },
    ],
  },
];

export default function DestinationMetadata() {
  const destinationPlatform = useMigrationStore((state) => state.destinationPlatform);
  const setPlatform = useMigrationStore((state) => state.setPlatform);
  const setCurrentStep = useMigrationStore((state) => state.setCurrentStep);
  const platform = useMigrationStore((state) =>
    state.currentStep === 'set-import-settings' ? state.destinationPlatform : state.sourcePlatform
  );

  if (!platform) {
    return null;
  }

  const platformFields = PLATFORM_METADATA_FIELDS.find((field) => field.id === destinationPlatform?.id);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const rawData = Object.fromEntries(formData.entries());
    const data: PlatformConfig = rawData as unknown as PlatformConfig;
    setPlatform(platform.type, { ...platform, config: data });
    setCurrentStep('review');
  };

  return (
    <form onSubmit={onSubmit}>
      <Heading>Choose your import settings</Heading>

      <div className="flex flex-col gap-4 mb-10">
        {platformFields?.fields.map((field) => {
          return (
            <div key={field.name}>
              {field.type === 'select' && (
                <div className="sm:col-span-3">
                  <label htmlFor={field.name} className="block text-sm font-medium leading-6 text-gray-900">
                    {field.label}
                  </label>
                  <div className="mt-2">
                    <select
                      id={field.name}
                      name={field.name}
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                    >
                      {field.values?.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                    {(field.description || field.docsUrl) && (
                      <p className="text-gray-500 text-xs mt-2 max-w-80">
                        {field.description}
                        {field.docsUrl && (
                          <>
                            {' '}
                            <a
                              href={field.docsUrl}
                              target="_blank"
                              className="underline hover:no-underline focus:no-underline"
                            >
                              Read more
                            </a>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {field.type === 'checkbox' && (
                <div className="">
                  <div className="flex gap-x-3">
                    <div className="flex h-6 items-center">
                      <input
                        type={field.type}
                        name={field.name}
                        id={field.name}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                    </div>
                    <div className="text-sm leading-6">
                      <label htmlFor="comments" className="font-medium text-gray-900">
                        {field.label}
                      </label>
                    </div>
                  </div>
                  {(field.description || field.docsUrl) && (
                    <p className="text-gray-500 mt-1 text-xs max-w-80">
                      {field.description}
                      {field.docsUrl && (
                        <>
                          {' '}
                          <a
                            href={field.docsUrl}
                            target="_blank"
                            className="underline hover:no-underline focus:no-underline"
                          >
                            Read more
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
              )}

              {field.type === 'text' && (
                <div>
                  <input type={field.type} name={field.name} id={field.name} />
                  <p className="text-gray-500 text-xs mt-1 max-w-80">
                    {field.description}
                    {field.docsUrl && (
                      <>
                        {' '}
                        <a
                          href={field.docsUrl}
                          target="_blank"
                          className="underline hover:no-underline focus:no-underline"
                        >
                          Read more
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
              {field.type === 'multi-checkbox' && (
                <div>
                  <fieldset className="text-sm">
                    <legend className="block text-sm font-medium leading-6 text-gray-900">{field.label}</legend>
                    <div className="mt-2 flex flex-col sm:flex-row gap-y-4 gap-x-3 [justify-content:start]">
                      {field.values?.map((value) => (
                        <div key={value} className="flex items-center">
                          <input
                            id={value}
                            name={field.name}
                            value={value}
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <label htmlFor={value} className="ml-3 min-w-0">
                            {value}
                          </label>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                  <p className="text-gray-500 text-xs mt-2 max-w-80">
                    {field.description}
                    {field.docsUrl && (
                      <>
                        {' '}
                        <a
                          href={field.docsUrl}
                          target="_blank"
                          className="underline hover:no-underline focus:no-underline"
                        >
                          Read more
                        </a>
                      </>
                    )}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Confirm and review
      </button>
    </form>
  );
}
