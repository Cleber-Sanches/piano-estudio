import type { PassResult, PracticeMode } from '../engine/practice';

// Feedback de mentor depois de cada passada: uma recomendação concreta por vez.

export interface CoachInput {
  result: PassResult;
  mode: PracticeMode;
  /** BPM efetivo (lições) ou null (músicas). */
  bpm: number | null;
  speed: number;
  cleanStreak: number;
  goal?: { bpm: number; accuracy: number };
  inLoop: boolean;
}

export function coach({ result, mode, bpm, speed, cleanStreak, goal, inLoop }: CoachInput): string[] {
  const tips: string[] = [];
  const acc = result.accuracy;
  const trouble = result.troubleMeasures.map((m) => m + 1);

  if (mode === 'espera') {
    if (acc >= 0.95) tips.push('As notas estão certas. Agora troque para o modo tempo: é ele que treina o ritmo.');
    else tips.push(`Ainda há notas erradas no modo espera (${Math.round(acc * 100)}%). Olhe os números de dedo e toque devagar até sair limpo.`);
    if (trouble.length && acc < 0.95) tips.push(`Isole o compasso ${trouble[0]} em loop antes de tocar tudo de novo.`);
    return tips;
  }

  if (acc < 0.7) {
    tips.push(
      bpm
        ? `Está rápido demais para agora. Volte para ${Math.max(30, bpm - 8)} BPM ou passe pelo modo espera.`
        : `Está rápido demais para agora. Baixe a velocidade para ${Math.max(25, Math.round(speed * 100) - 15)}%.`,
    );
  } else if (acc < 0.9) {
    tips.push('Quase lá. Mantenha a mesma velocidade até acertar 90% ou mais.');
  }

  if (Math.abs(result.avgOffsetMs) >= 45 && result.hits >= 4) {
    tips.push(
      result.avgOffsetMs > 0
        ? `Você está atrasando em média ${Math.round(result.avgOffsetMs)} ms. Conte os tempos em voz alta junto com o metrônomo.`
        : `Você está correndo, adiantando em média ${Math.round(-result.avgOffsetMs)} ms. Respire e deixe o metrônomo puxar.`,
    );
  }

  if (trouble.length && acc < 0.95) {
    tips.push(
      inLoop
        ? `O compasso ${trouble[0]} concentra os erros. Continue nele até 3 passadas limpas.`
        : `Os erros se concentram no${trouble.length > 1 ? 's compassos' : ' compasso'} ${trouble.join(', ')}. Use “Repetir trecho” nele.`,
    );
  }

  if (inLoop && cleanStreak >= 3) {
    tips.push('3 passadas limpas seguidas. Hora de subir a velocidade um degrau ou sair do loop.');
  }

  if (acc >= 0.9 && goal && bpm != null) {
    if (bpm >= goal.bpm && acc >= goal.accuracy) tips.push('Meta da lição batida. Pode seguir para a próxima.');
    else tips.push(`Limpo a ${bpm} BPM. Suba para ${Math.min(goal.bpm, bpm + 4)} BPM e repita.`);
  } else if (acc >= 0.9 && bpm == null) {
    tips.push(speed < 1 ? `Limpo a ${Math.round(speed * 100)}%. Suba para ${Math.min(100, Math.round(speed * 100) + 10)}%.` : 'Limpo na velocidade original. Tente tocar sem olhar a tela.');
  }
  return tips.slice(0, 3);
}
