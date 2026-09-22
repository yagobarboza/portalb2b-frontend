const styles: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground', running: 'bg-blue-500/15 text-blue-600',
  success: 'bg-green-500/15 text-green-600', partial: 'bg-amber-500/15 text-amber-700',
  failed: 'bg-red-500/15 text-red-600', dead_letter: 'bg-red-700/15 text-red-700',
};
const labels: Record<string, string> = {
  pending: 'Pendente', running: 'Em execução', success: 'Sucesso', partial: 'Parcial',
  failed: 'Falha', dead_letter: 'Intervenção necessária',
};

export function RunStatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}>{labels[status] ?? status}</span>;
}
