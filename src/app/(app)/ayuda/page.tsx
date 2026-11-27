import type { Metadata } from 'next';
import { Eyebrow, Title } from '@/components/rayo/title';
import { Icon } from '@/components/sin/ui';

export const metadata: Metadata = { title: 'Ayuda' };

const QA: [string, string][] = [
  ['¿Cómo funciona la racha?', 'Es semanal: una práctica en la semana la mantiene. Si una semana no puedes, la pausas (una vez al mes) y tu racha te espera. También puedes ocultarla en Ajustes.'],
  ['¿Qué cuenta como práctica?', 'Ver o escuchar una clase o práctica guiada. Con una al día, ese día queda en tu camino.'],
  ['¿Qué son los círculos?', 'Grupos opcionales de unas 30 personas por semana. Solo ves quién practicó hoy; no hay tablas ni comparaciones.'],
  ['¿Puedo cambiar la hora del recordatorio?', 'Sí, en Perfil → Ajustes. Recibes como máximo un recordatorio al día, y solo si ese día aún no practicaste.'],
  ['Atajos de teclado', 'Presiona ? en cualquier pantalla para verlos. ⌘K o / abre la búsqueda.'],
];

export default function Help() {
  return (
    <div className="page-pad" style={{ maxWidth: 760 }}>
      <div className="stack" style={{ gap: 12, margin: '8px 0 32px' }}>
        <Eyebrow>Estamos contigo</Eyebrow>
        <Title className="t-page" text="¿En qué te" em="ayudamos?" />
      </div>
      <div className="card" style={{ padding: 8 }}>
        {QA.map(([q, a]) => (
          <details key={q} className="pref-row" style={{ display: 'block', padding: '4px 8px' }}>
            <summary className="mod-head t-label-l" style={{ listStyle: 'none' }}>
              {q}
              <Icon name="expand_more" />
            </summary>
            <p className="t-body-m c-variant" style={{ padding: '0 8px 12px' }}>
              {a}
            </p>
          </details>
        ))}
      </div>
      <p className="t-body-m c-variant" style={{ marginTop: 24 }}>
        ¿Algo más? Escríbenos a soporte desde indigoacademy.digital.
      </p>
    </div>
  );
}
