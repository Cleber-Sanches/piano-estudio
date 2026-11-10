# Piano Estúdio

App de estudo de piano no navegador: notas caindo, modo espera com teclado MIDI, lições guiadas e partitura sincronizada. Feito para estudar com acompanhamento de um mentor (o Claude), seguindo uma trilha em fases.

## O que tem

- **Plano de hoje:** ao abrir, o app diz o que estudar naquele dia (revisões, leitura, lição nova e sua música), na ordem certa.
- **Trilha da Fase 1:** 24 itens em 5 módulos (cinco dedos, escalas de Dó/Sol/Fá, acordes e inversões, arpejos, progressão I–V–vi–IV) com peças de domínio público entre eles (Brilha Brilha, Ode à Alegria, Jingle Bells, Für Elise), dedilhado nas notas, metas de BPM e precisão.
- **Revisão espaçada:** lições concluídas voltam como aquecimento em 1, 3, 7, 14, 30 e 60 dias.
- **Nivelamento:** cada módulo tem um teste; passou, o módulo inteiro fica marcado como dominado.
- **Leitura relâmpago:** 7 níveis de reconhecer notas na pauta tocando no piano, e a ponte gradual das notas caindo (normais, fracas, só partitura).
- **Modo espera:** a música para até você apertar a tecla certa.
- **Modo tempo:** segue o metrônomo e avalia cada nota (acerto, erro, atraso médio em ms).
- **Mãos separadas:** você toca uma mão e o app toca a outra.
- **Repetir compassos:** loop de um trecho, com contagem de passadas limpas seguidas.
- **Partitura:** pauta dupla sincronizada, com as notas ficando verdes ou vermelhas.
- **Suas músicas:** carregue qualquer `.mid` (os mesmos do Synthesia), escolha a mão de cada faixa e pratique com velocidade ajustável.
- **Feedback de mentor** após cada passada e **relatório semanal** para colar no chat de check-in.

## Como usar

Use o **Chrome ou o Edge** no computador, com o piano elétrico ligado por USB. Na primeira vez, o navegador pede permissão para acessar dispositivos MIDI.

Sem teclado à mão, dá para usar o teclado do computador (A W S E D F T G Y H U J K = Dó a Dó; Z e X trocam a oitava) ou clicar nas teclas da tela.

O progresso fica salvo no navegador (Ajustes → Exportar progresso para levar para outro computador).

## Rodar localmente

```bash
npm install
npm run dev
```

## Tecnologia

React + Vite + TypeScript, Web MIDI API, [@tonejs/midi](https://github.com/Tonejs/Midi) para ler arquivos MIDI, [VexFlow](https://github.com/0xfe/vexflow) para a partitura e [smplr](https://github.com/danigb/smplr) para o som do piano. O motor de prática (`src/engine/practice.ts`) é independente da interface e tem testes (`npm test`).

## Publicação

Cada push na `main` publica no GitHub Pages pelo workflow em `.github/workflows/deploy.yml`. Ative em Settings → Pages → Source: **GitHub Actions**.
