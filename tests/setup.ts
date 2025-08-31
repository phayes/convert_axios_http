// Test setup file
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock FormData and File for Node.js environment
if (typeof global.FormData === 'undefined') {
  global.FormData = class FormData {
    private formEntries: Array<[string, any]> = [];

    append(key: string, value: any): void {
      this.formEntries.push([key, value]);
    }

    entries(): IterableIterator<[string, any]> {
      return this.formEntries[Symbol.iterator]();
    }

    [Symbol.iterator](): IterableIterator<[string, any]> {
      return this.entries();
    }
  } as any;
}

// Always override File to ensure our mock is used
global.File = class File extends Blob {
  public readonly name: string;
  
  constructor(
    content: any[],
    name: string,
    options: { type?: string } = {}
  ) {
    super(content, options);
    this.name = name;
  }
} as any;

if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(
      public readonly content: any[],
      public readonly options: { type?: string } = {}
    ) {}
  } as any;
}
