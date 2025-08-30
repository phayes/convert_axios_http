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

if (typeof global.File === 'undefined') {
  global.File = class File {
    constructor(
      public readonly name: string,
      public readonly type: string = 'application/octet-stream'
    ) {}
  } as any;
}

if (typeof global.Blob === 'undefined') {
  global.Blob = class Blob {
    constructor(
      public readonly content: any[],
      public readonly options: { type?: string } = {}
    ) {}
  } as any;
}
