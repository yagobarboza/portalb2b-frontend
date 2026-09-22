import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { IntegrationFilePicker } from './IntegrationFilePicker';

describe('IntegrationFilePicker', () => {
  it('mantém dois cards ligados às suas próprias integrações', async () => {
    const user = userEvent.setup();
    const first = vi.fn();
    const second = vi.fn();
    render(
      <>
        <IntegrationFilePicker
          integrationId="integration-a"
          integrationName="ERP A"
          onFile={first}
        />
        <IntegrationFilePicker
          integrationId="integration-b"
          integrationName="ERP B"
          onFile={second}
        />
      </>,
    );

    const fileA = new File(['sku,stock\nA,1'], 'a.csv', { type: 'text/csv' });
    const fileB = new File(['sku,stock\nB,2'], 'b.csv', { type: 'text/csv' });
    await user.upload(screen.getByTestId('integration-file-integration-a'), fileA);
    expect(first).toHaveBeenCalledWith(fileA);
    expect(second).not.toHaveBeenCalled();

    await user.upload(screen.getByTestId('integration-file-integration-b'), fileB);
    expect(second).toHaveBeenCalledWith(fileB);
    expect(first).toHaveBeenCalledTimes(1);
  });
});
