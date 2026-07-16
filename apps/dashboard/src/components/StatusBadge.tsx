const statusLabel: Record<string, string> = {
  REQUESTED: 'Aguardando',
  OFFERED: 'Ofertada',
  ACCEPTED: 'Aceita',
  AT_PICKUP: 'Na coleta',
  PICKED_UP: 'Coletada',
  IN_TRANSIT: 'Em rota',
  DELIVERED: 'Entregue',
  CANCELED: 'Cancelada',
  PENDING: 'Pendente',
  ACTIVE: 'Ativo',
  SUSPENDED: 'Suspenso',
  REJECTED: 'Rejeitado',
};

const statusTone: Record<string, string> = {
  REQUESTED: 'amber',
  OFFERED: 'amber',
  ACCEPTED: 'blue',
  AT_PICKUP: 'blue',
  PICKED_UP: 'blue',
  IN_TRANSIT: 'green',
  DELIVERED: 'gray',
  CANCELED: 'gray',
  PENDING: 'amber',
  ACTIVE: 'green',
  SUSPENDED: 'gray',
  REJECTED: 'gray',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status ${statusTone[status] ?? 'gray'}`}>
      <i />
      {statusLabel[status] ?? status}
    </span>
  );
}

export { statusLabel, statusTone };
