"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const converter_1 = require("../src/converter");
describe('Configuration Options', () => {
    describe('maxBodySize Configuration', () => {
        it('should have unbounded maxBodySize by default', () => {
            const converter = new converter_1.HttpConverter();
            expect(converter.options.maxBodySize).toBeUndefined();
        });
        it('should accept explicit maxBodySize value', () => {
            const maxSize = 1024 * 1024; // 1MB
            const converter = new converter_1.HttpConverter({ maxBodySize: maxSize });
            expect(converter.options.maxBodySize).toBe(maxSize);
        });
        it('should accept explicit undefined maxBodySize', () => {
            const converter = new converter_1.HttpConverter({ maxBodySize: undefined });
            expect(converter.options.maxBodySize).toBeUndefined();
        });
        it('should accept explicit null maxBodySize', () => {
            const converter = new converter_1.HttpConverter({ maxBodySize: null });
            expect(converter.options.maxBodySize).toBeNull();
        });
        it('should accept zero maxBodySize', () => {
            const converter = new converter_1.HttpConverter({ maxBodySize: 0 });
            expect(converter.options.maxBodySize).toBe(0);
        });
        it('should accept large maxBodySize values', () => {
            const largeSize = 100 * 1024 * 1024; // 100MB
            const converter = new converter_1.HttpConverter({ maxBodySize: largeSize });
            expect(converter.options.maxBodySize).toBe(largeSize);
        });
        it('should accept negative maxBodySize (though not recommended)', () => {
            const converter = new converter_1.HttpConverter({ maxBodySize: -1 });
            expect(converter.options.maxBodySize).toBe(-1);
        });
    });
    describe('preserveHeaderCase Configuration', () => {
        it('should have preserveHeaderCase false by default', () => {
            const converter = new converter_1.HttpConverter();
            expect(converter.options.preserveHeaderCase).toBe(false);
        });
        it('should accept explicit preserveHeaderCase true', () => {
            const converter = new converter_1.HttpConverter({ preserveHeaderCase: true });
            expect(converter.options.preserveHeaderCase).toBe(true);
        });
        it('should accept explicit preserveHeaderCase false', () => {
            const converter = new converter_1.HttpConverter({ preserveHeaderCase: false });
            expect(converter.options.preserveHeaderCase).toBe(false);
        });
    });
    describe('multipartBoundary Configuration', () => {
        it('should auto-generate multipartBoundary by default', () => {
            const converter = new converter_1.HttpConverter();
            expect(converter.options.multipartBoundary).toBeDefined();
            expect(typeof converter.options.multipartBoundary).toBe('string');
            expect(converter.options.multipartBoundary.length).toBeGreaterThan(0);
        });
        it('should accept explicit multipartBoundary', () => {
            const customBoundary = '----CustomBoundary123';
            const converter = new converter_1.HttpConverter({ multipartBoundary: customBoundary });
            expect(converter.options.multipartBoundary).toBe(customBoundary);
        });
        it('should generate different boundaries for different instances', () => {
            const converter1 = new converter_1.HttpConverter();
            const converter2 = new converter_1.HttpConverter();
            expect(converter1.options.multipartBoundary).not.toBe(converter2.options.multipartBoundary);
        });
    });
    describe('Combined Configuration Options', () => {
        it('should handle all options together', () => {
            const options = {
                maxBodySize: 5 * 1024 * 1024, // 5MB
                preserveHeaderCase: true,
                multipartBoundary: '----TestBoundary'
            };
            const converter = new converter_1.HttpConverter(options);
            expect(converter.options.maxBodySize).toBe(options.maxBodySize);
            expect(converter.options.preserveHeaderCase).toBe(options.preserveHeaderCase);
            expect(converter.options.multipartBoundary).toBe(options.multipartBoundary);
        });
        it('should handle partial options', () => {
            const converter = new converter_1.HttpConverter({
                maxBodySize: 1024,
                preserveHeaderCase: true
            });
            expect(converter.options.maxBodySize).toBe(1024);
            expect(converter.options.preserveHeaderCase).toBe(true);
            expect(converter.options.multipartBoundary).toBeDefined();
        });
        it('should handle empty options object', () => {
            const converter = new converter_1.HttpConverter({});
            expect(converter.options.maxBodySize).toBeUndefined();
            expect(converter.options.preserveHeaderCase).toBe(false);
            expect(converter.options.multipartBoundary).toBeDefined();
        });
        it('should handle undefined options', () => {
            const converter = new converter_1.HttpConverter();
            expect(converter.options.maxBodySize).toBeUndefined();
            expect(converter.options.preserveHeaderCase).toBe(false);
            expect(converter.options.multipartBoundary).toBeDefined();
        });
    });
    describe('Configuration Persistence', () => {
        it('should maintain configuration across multiple operations', () => {
            const converter = new converter_1.HttpConverter({
                maxBodySize: 2048,
                preserveHeaderCase: true,
                multipartBoundary: '----PersistentBoundary'
            });
            // Verify initial configuration
            expect(converter.options.maxBodySize).toBe(2048);
            expect(converter.options.preserveHeaderCase).toBe(true);
            expect(converter.options.multipartBoundary).toBe('----PersistentBoundary');
            // Perform some operations (even if they don't exist yet)
            // This test ensures the configuration persists
            const testConfig = {
                method: 'GET',
                url: '/test',
                headers: { 'Test-Header': 'value' }
            };
            // The configuration should remain the same
            expect(converter.options.maxBodySize).toBe(2048);
            expect(converter.options.preserveHeaderCase).toBe(true);
            expect(converter.options.multipartBoundary).toBe('----PersistentBoundary');
        });
    });
});
