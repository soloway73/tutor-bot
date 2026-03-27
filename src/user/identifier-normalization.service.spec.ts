import { Test, TestingModule } from '@nestjs/testing';
import { IdentifierNormalizationService } from './identifier-normalization.service';

describe('IdentifierNormalizationService', () => {
  let service: IdentifierNormalizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IdentifierNormalizationService],
    }).compile();

    service = module.get<IdentifierNormalizationService>(
      IdentifierNormalizationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('normalize', () => {
    it('should remove spaces from phone numbers', () => {
      expect(service.normalize('+7 917 603-70-35')).toBe('+79176037035');
      expect(service.normalize('+7 917603 70 35')).toBe('+79176037035');
      expect(service.normalize('8 917 603 70 35')).toBe('89176037035');
    });

    it('should remove spaces from emails', () => {
      expect(service.normalize('user @ example.com')).toBe(
        'user@example.com',
      );
      expect(service.normalize('user@ exam ple.com')).toBe(
        'user@example.com',
      );
    });

    it('should convert emails to lowercase', () => {
      expect(service.normalize('User@Example.COM')).toBe('user@example.com');
      expect(service.normalize('USER@EXAMPLE.COM')).toBe('user@example.com');
    });

    it('should handle emails with spaces and mixed case', () => {
      expect(service.normalize('User @ Example.COM')).toBe(
        'user@example.com',
      );
      expect(service.normalize(' Test.User @ Test.Domain.RU ')).toBe(
        'test.user@test.domain.ru',
      );
    });

    it('should handle phone numbers with dashes', () => {
      expect(service.normalize('+7-917-603-70-35')).toBe('+79176037035');
      expect(service.normalize('8-917-603-70-35')).toBe('89176037035');
    });

    it('should handle already normalized identifiers', () => {
      expect(service.normalize('+79176037035')).toBe('+79176037035');
      expect(service.normalize('user@example.com')).toBe('user@example.com');
    });

    it('should handle identifiers with leading/trailing spaces', () => {
      expect(service.normalize(' +79176037035 ')).toBe('+79176037035');
      expect(service.normalize(' user@example.com ')).toBe('user@example.com');
    });
  });

  describe('isEmail detection', () => {
    it('should correctly identify emails', () => {
      expect(service.normalize('test@email.com')).toBe('test@email.com');
      expect(service.normalize('Test@Email.COM')).toBe('test@email.com');
    });

    it('should not treat phones as emails', () => {
      expect(service.normalize('+79176037035')).toBe('+79176037035');
      expect(service.normalize('89176037035')).toBe('89176037035');
    });
  });
});
