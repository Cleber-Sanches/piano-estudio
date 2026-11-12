import { BookOpen, Ear, Hand, Music2, Sparkles, type LucideIcon } from 'lucide-react';
import type { Pillar } from './curriculum';

/** Um ícone por pilar — usado na trilha, no plano e nos medidores. */
export const PILLAR_ICON: Record<Pillar, LucideIcon> = {
  repertorio: Music2,
  tecnica: Hand,
  leitura: BookOpen,
  ouvido: Ear,
  criar: Sparkles,
};
