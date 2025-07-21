import { validate } from 'class-validator';
import { WebhookNotificationDto } from './webhook-notification.dto';

describe('WebhookNotificationDto', () => {
  let dto: WebhookNotificationDto;

  beforeEach(() => {
    dto = new WebhookNotificationDto();
  });

  describe('Valid DTO', () => {
    it('should pass validation with required fields only', async () => {
      dto.type = 'info';
      dto.message = 'Test notification';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all fields', async () => {
      dto.type = 'alert';
      dto.message = 'Test notification with all fields';
      dto.targetUsers = ['user1', 'user2'];
      dto.data = { key: 'value', number: 123 };
      dto.priority = 'high';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with valid priority values', async () => {
      const priorities: Array<'low' | 'normal' | 'high'> = [
        'low',
        'normal',
        'high',
      ];

      for (const priority of priorities) {
        dto.type = 'info';
        dto.message = 'Test message';
        dto.priority = priority;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Invalid DTO', () => {
    it('should fail validation when type is missing', async () => {
      dto.message = 'Test notification';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('type');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when message is missing', async () => {
      dto.type = 'info';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('message');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when type is empty string', async () => {
      dto.type = '';
      dto.message = 'Test notification';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('type');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when message is empty string', async () => {
      dto.type = 'info';
      dto.message = '';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('message');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('should fail validation when targetUsers contains non-string values', async () => {
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.targetUsers = ['user1', 123 as any, 'user2'];

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('targetUsers');
    });

    it('should fail validation when priority is invalid', async () => {
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'invalid' as any;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('priority');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation when data is not an object', async () => {
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.data = 'not an object' as any;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('data');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });
  });
});
