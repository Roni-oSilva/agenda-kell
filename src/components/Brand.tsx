import { IconSparkle } from './Icons';

/** Marca tipográfica: monograma serifado com aro dourado + nome em script. Usa o nome configurado no painel. */
export default function Brand({ name, small = false }: { name: string; small?: boolean }) {
  const initial = (name.trim()[0] ?? 'N').toUpperCase();
  const size = small ? 'h-14 w-14 text-4xl' : 'h-28 w-28 text-7xl';
  return (
    <div className="flex flex-col items-center">
      <div className={`relative grid place-items-center ${size}`}>
        <span className="absolute inset-0 rounded-full border border-ouro/70" />
        <span className="absolute inset-1.5 rounded-full border border-ouro/30" />
        <span className="font-display font-semibold leading-none text-rose-600">{initial}</span>
        {!small && <IconSparkle className="absolute -right-1 top-1 animate-twinkle text-ouro" width={14} height={14} />}
      </div>
      <p className={`font-script text-rose-600 ${small ? 'mt-1 text-2xl' : 'mt-2 text-4xl'}`}>{name}</p>
    </div>
  );
}
