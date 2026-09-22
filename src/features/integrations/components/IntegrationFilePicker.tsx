import { useRef } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';

interface IntegrationFilePickerProps {
  integrationId: string;
  integrationName: string;
  disabled?: boolean;
  onFile: (file: File) => void;
}

export function IntegrationFilePicker({
  integrationId,
  integrationName,
  disabled = false,
  onFile,
}: IntegrationFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        data-testid={`integration-file-${integrationId}`}
        type="file"
        accept=".csv,.xlsx,.xlsm"
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onFile(file);
        }}
      />
      <Button
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        aria-label={`Importar arquivo de ${integrationName}`}
      >
        <FileUp className="mr-1 h-3.5 w-3.5" />
        Importar CSV/Excel
      </Button>
    </>
  );
}
