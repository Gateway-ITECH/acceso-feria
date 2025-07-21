import { validate } from 'class-validator';
import { WebSocketNotificationDto } from './websocket-notification.dto';
import { v4 as uuidv4 } from 'uuid';

describe('WebSocketNotificationDto', () => {
  let dto: WebSocketNotificationDto;

  beforeEach(() => {
    dto = new WebSocketNotificationDto();
  });

  describe('Valid DTO', () => {
    it('should pass validation with all required fields', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with optional data field', async () => {
      dto.id = uuidv4();
      dto.type = 'alert';
      dto.message = 'Test notification with data';
      dto.data = { key: 'value', number: 123, nested: { prop: 'test' } };
      dto.priority = 'high';
      dto.timestamp = new Date().toISOString();
      dto.source = 'system';

      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass validation with all valid priority values', async () => {
      const priorities: Array<'low' | 'normal' | 'high'> = [
        'low',
        'normal',
        'high',
      ];

      for (const priority of priorities) {
        dto.id = uuidv4();
        dto.type = 'info';
        dto.message = 'Test message';
        dto.priority = priority;
        dto.timestamp = new Date().toISOString();
        dto.source = 'webhook';

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });

    it('should pass validation with all valid source values', async () => {
      const sources: Array<'webhook' | 'system'> = ['webhook', 'system'];

      for (const source of sources) {
        dto.id = uuidv4();
        dto.type = 'info';
        dto.message = 'Test message';
        dto.priority = 'normal';
        dto.timestamp = new Date().toISOString();
        dto.source = source;

        const errors = await validate(dto);
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe('Invalid DTO', () => {
    it('should fail validation when id is missing', async () => {
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('id');
    });

    it('should fail validation when id is not a valid UUID', async () => {
      dto.id = 'invalid-uuid';
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('id');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should fail validation when type is missing', async () => {
      dto.id = uuidv4();
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('type');
    });

    it('should fail validation when message is missing', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('message');
    });

    it('should fail validation when priority is invalid', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'invalid' as any;
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('priority');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation when source is invalid', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'invalid' as any;

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('source');
      expect(errors[0].constraints).toHaveProperty('isIn');
    });

    it('should fail validation when timestamp is missing', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('timestamp');
    });

    it('should fail validation when timestamp is not a valid ISO string', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.priority = 'normal';
      dto.timestamp = 'invalid-date';
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('timestamp');
      expect(errors[0].constraints).toHaveProperty('isDateString');
    });

    it('should fail validation when data is not an object', async () => {
      dto.id = uuidv4();
      dto.type = 'info';
      dto.message = 'Test notification';
      dto.data = 'not an object' as any;
      dto.priority = 'normal';
      dto.timestamp = new Date().toISOString();
      dto.source = 'webhook';

      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('data');
      expect(errors[0].constraints).toHaveProperty('isObject');
    });
  });

  describe('DTO Transformation', () => {
    it('should create a valid DTO from webhook data', () => {
      const webhookData = {
        type: 'alert',
        message: 'System alert',
        data: { severity: 'high', component: 'database' },
        priority: 'high' as const,
      };

      const websocketDto = new WebSocketNotificationDto();
      websocketDto.id = uuidv4();
      websocketDto.type = webhookData.type;
      websocketDto.message = webhookData.message;
      websocketDto.data = webhookData.data;
      websocketDto.priority = webhookData.priority;
      websocketDto.timestamp = new Date().toISOString();
      websocketDto.source = 'webhook';

      expect(websocketDto.id).toBeDefined();
      expect(websocketDto.type).toBe(webhookData.type);
      expect(websocketDto.message).toBe(webhookData.message);
      expect(websocketDto.data).toEqual(webhookData.data);
      expect(websocketDto.priority).toBe(webhookData.priority);
      expect(websocketDto.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(websocketDto.source).toBe('webhook');
    });

    it('should handle transformation with default priority', () => {
      const webhookData = {
        type: 'info',
        message: 'Information message',
      };

      const websocketDto = new WebSocketNotificationDto();
      websocketDto.id = uuidv4();
      websocketDto.type = webhookData.type;
      websocketDto.message = webhookData.message;
      websocketDto.priority = 'normal'; // default priority
      websocketDto.timestamp = new Date().toISOString();
      websocketDto.source = 'webhook';

      expect(websocketDto.priority).toBe('normal');
      expect(websocketDto.data).toBeUndefined();
    });
  });
});
