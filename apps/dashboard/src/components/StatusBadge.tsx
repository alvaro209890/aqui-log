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

/*
 * UX-01C: tom semântico de cada estado, conforme a regra 1 das diretrizes
 * visuais — concluído é verde, cancelado/rejeitado é vermelho, pendência é
 * âmbar, rastreamento é azul. Laranja é marca e não aparece aqui.
 *
 * Antes desta rodada, DELIVERED e CANCELED dividiam o mesmo cinza: entrega
 * concluída ficava indistinguível de cancelada na tabela, e IN_TRANSIT usava
 * o verde que pertence ao sucesso.
 */
const statusTone: Record<string, string> = {
  REQUESTED: 'amber',
  OFFERED: 'amber',
  ACCEPTED: 'blue',
  AT_PICKUP: 'blue',
  PICKED_UP: 'blue',
  IN_TRANSIT: 'blue',
  DELIVERED: 'green',
  CANCELED: 'red',
  PENDING: 'amber',
  ACTIVE: 'green',
  SUSPENDED: 'gray',
  REJECTED: 'red',
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
