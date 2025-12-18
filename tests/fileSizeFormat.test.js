const formatFileSize = require('../utils/fileSizeFormat');

describe('formatFileSize', () => {
  test('should return "0 Bytes" for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 Bytes');
  });

  test('should format bytes correctly', () => {
    expect(formatFileSize(1)).toBe('1.0 Bytes');
    expect(formatFileSize(1023)).toBe('1023.0 Bytes');
  });

  test('should format kilobytes correctly', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  test('should format megabytes correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
  });

  test('should format gigabytes correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
  });

  test('should format terabytes correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
  });

  test('should handle large numbers', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1024 * 2)).toBe('2.0 TB');
  });
});
