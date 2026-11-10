import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

// Entrada de notas: teclado MIDI (Web MIDI no navegador, CoreMIDI no app de iPad),
// teclado do computador e cliques na tela.

interface NativeMidi {
  start(): Promise<{ devices: MidiDevice[] }>;
  listDevices(): Promise<{ devices: MidiDevice[] }>;
  showBluetooth(): Promise<void>;
  addListener(event: 'note', fn: (e: { type: 'on' | 'off'; midi: number; velocity: number }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'devices', fn: (e: { devices: MidiDevice[] }) => void): Promise<PluginListenerHandle>;
}

const NativeMidi = registerPlugin<NativeMidi>('Midi');
export const isNativeApp = Capacitor.isNativePlatform();

export type NoteListener = (e: { type: 'on' | 'off'; midi: number; velocity: number; source: 'midi' | 'pc' | 'tela' }) => void;

export interface MidiDevice {
  id: string;
  name: string;
}

class InputHub {
  private listeners = new Set<NoteListener>();
  private access: MIDIAccess | null = null;
  private deviceListeners = new Set<(d: MidiDevice[]) => void>();
  private pcOctave = 4;
  private pcDown = new Set<string>();
  midiStatus: 'desconhecido' | 'sem-suporte' | 'negado' | 'ok' = 'desconhecido';
  private nativeDevices: MidiDevice[] = [];
  selectedId: string | 'todos' = 'todos';

  on(fn: NoteListener) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }
  onDevices(fn: (d: MidiDevice[]) => void) {
    this.deviceListeners.add(fn);
    fn(this.devices());
    return () => { this.deviceListeners.delete(fn); };
  }
  emit(type: 'on' | 'off', midi: number, velocity: number, source: 'midi' | 'pc' | 'tela') {
    this.listeners.forEach((l) => l({ type, midi, velocity, source }));
  }

  devices(): MidiDevice[] {
    if (isNativeApp) return this.nativeDevices;
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => ({ id: i.id, name: i.name || 'Teclado MIDI' }));
  }

  /** Abre o pareamento de teclados Bluetooth (só no app de iPad). */
  async pairBluetooth() {
    if (isNativeApp) await NativeMidi.showBluetooth();
  }

  async connectMidi() {
    if (isNativeApp) {
      try {
        await NativeMidi.addListener('note', (e) => this.emit(e.type, e.midi, e.velocity, 'midi'));
        await NativeMidi.addListener('devices', (e) => this.setNativeDevices(e.devices));
        const r = await NativeMidi.start();
        this.setNativeDevices(r.devices);
        this.midiStatus = 'ok';
        // Detecção automática: procura teclados novos a cada 2 s e ao voltar para o app.
        const refresh = () => NativeMidi.listDevices().then((d) => this.setNativeDevices(d.devices)).catch(() => {});
        setInterval(refresh, 2000);
        document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
      } catch {
        this.midiStatus = 'negado';
      }
      this.notifyDevices();
      return;
    }
    if (!('requestMIDIAccess' in navigator)) {
      this.midiStatus = 'sem-suporte';
      this.notifyDevices();
      return;
    }
    try {
      this.access = await navigator.requestMIDIAccess();
      this.midiStatus = 'ok';
      const bind = () => {
        this.access!.inputs.forEach((input) => {
          input.onmidimessage = (ev) => this.handleMidi(input.id, ev);
        });
        this.notifyDevices();
      };
      this.access.onstatechange = bind;
      bind();
    } catch {
      this.midiStatus = 'negado';
      this.notifyDevices();
    }
  }

  /** Ignora a "Rede Session" (MIDI por Wi-Fi do iOS), que não é um teclado. */
  private setNativeDevices(list: MidiDevice[]) {
    const real = list.filter((d) => !/^(Rede|Network) Session/i.test(d.name));
    const same = real.length === this.nativeDevices.length && real.every((d, i) => d.id === this.nativeDevices[i]?.id);
    this.nativeDevices = real;
    if (!same) this.notifyDevices();
  }

  private notifyDevices() {
    const d = this.devices();
    this.deviceListeners.forEach((l) => l(d));
  }

  private handleMidi(id: string, ev: MIDIMessageEvent) {
    if (this.selectedId !== 'todos' && this.selectedId !== id) return;
    const data = ev.data;
    if (!data || data.length < 3) return;
    const cmd = data[0] & 0xf0;
    const note = data[1];
    const vel = data[2];
    if (cmd === 0x90 && vel > 0) this.emit('on', note, vel / 127, 'midi');
    else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) this.emit('off', note, 0, 'midi');
  }

  /** Teclado do computador: A W S E D F T G Y H U J K = Dó a Dó; Z/X mudam a oitava. */
  bindPcKeyboard() {
    const map: Record<string, number> = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14 };
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    const down = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z') { this.pcOctave = Math.max(1, this.pcOctave - 1); return; }
      if (k === 'x') { this.pcOctave = Math.min(7, this.pcOctave + 1); return; }
      if (!(k in map) || this.pcDown.has(k)) return;
      this.pcDown.add(k);
      this.emit('on', 12 * (this.pcOctave + 1) + map[k], 0.7, 'pc');
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!this.pcDown.has(k)) return;
      this.pcDown.delete(k);
      this.emit('off', 12 * (this.pcOctave + 1) + map[k], 0, 'pc');
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
  }

  setPcOctave(o: number) {
    this.pcOctave = o;
  }
}

export const input = new InputHub();
