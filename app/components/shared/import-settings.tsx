import { sriracha } from '@/_fonts';
import useMigrationStore from '@/utils/store';
import type { PlatformConfig } from '@/utils/store';

const PLATFORM_METADATA_FIELDS = [
  {
    id: 'mux',
    fields: [
      {
        label: 'Encoding tier',
        description: 'Select the encoding tier for your videos',
        docsUrl: 'https://docs.mux.com/guides/use-encoding-tiers',
        name: 'encodingTier',
        type: 'select',
        values: ['baseline', 'smart'],
      },
      {
        label: 'Max resolution tier',
        description: 'Select the max resolution tier for your videos',
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
      <h2 className={`text-primary uppercase font-bold text-lg ${sriracha.className}`}>Choose your import settings</h2>

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
                      className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:max-w-xs sm:text-sm sm:leading-6"
                    >
                      {field.values?.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {field.type === 'checkbox' && (
                <div className="relative flex gap-x-3">
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
                    <p className="text-gray-500">{field.description}</p>
                  </div>
                </div>
              )}

              {field.type === 'text' && <input type={field.type} name={field.name} id={field.name} />}
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Confirm and review
      </button>
    </form>
  );
}