import { Injectable } from '@nestjs/common';

/**
 * Сервис для нормализации идентификаторов (email и телефонов)
 * Удаляет пробелы и приводит к единому формату
 */
@Injectable()
export class IdentifierNormalizationService {
  /**
   * Нормализует идентификатор:
   * - Удаляет все пробелы и дефисы
   * - Для email: приводит к нижнему регистру
   * - Для телефона: удаляет всё кроме цифр и +
   */
  normalize(identifier: string): string {
    // Проверяем, email ли это (до удаления пробелов/дефисов)
    const isEmail = this.checkIsEmail(identifier);

    // Удаляем все пробелы и дефисы
    let normalized = identifier.replace(/[\s-]/g, '');

    // Для email приводим к нижнему регистру
    if (isEmail) {
      normalized = normalized.toLowerCase();
    }

    return normalized;
  }

  /**
   * Проверяет, является ли строка email
   */
  private checkIsEmail(str: string): boolean {
    const emailPattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(str.replace(/[\s-]/g, ''));
  }
}
