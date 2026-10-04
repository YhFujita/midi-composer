declare module 'midi-writer-js' {
  export class Track {
    addEvent(event: any): this;
    setTempo(bpm: number): this;
    setTimeSignature(numerator: number, denominator: number): this;
    addInstrumentName(name: string): this;
    addProgramChangeEvent(options: { programNumber: number }): this;
    addTrackName(name: string): this;
  }

  export class NoteEvent {
    constructor(options: {
      pitch: string[] | string;
      duration: string | string[];
      velocity?: number;
      wait?: string | string[];
      channel?: number;
    });
  }

  export class ProgramChangeEvent {
    constructor(options: { instrument: number });
  }

  export class Writer {
    constructor(tracks: Track | Track[]);
    buildFile(): Uint8Array;
    base64(): string;
    dataUri(): string;
  }

  const MidiWriter: {
    Track: typeof Track;
    NoteEvent: typeof NoteEvent;
    ProgramChangeEvent: typeof ProgramChangeEvent;
    Writer: typeof Writer;
  };

  export default MidiWriter;
}
