import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';
import { SosMeshMetricsService } from '../../observability/sosmesh-metrics.service';
import { REQUEST_ID_HEADER } from '../middleware/request-id.middleware';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let metricsService: SosMeshMetricsService;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockHost: ArgumentsHost;
  let loggerErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    metricsService = {
      recordHttpStatus: jest.fn(),
    } as any;

    filter = new HttpExceptionFilter(metricsService);
    loggerErrorSpy = jest.spyOn(filter['logger'], 'error');

    mockRequest = {
      path: '/v1/test/endpoint',
      headers: {
        [REQUEST_ID_HEADER]: 'test-request-id-123',
      },
    };

    const jsonMock = jest.fn();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jsonMock,
    };

    mockHost = {
      switchToHttp: () => ({
        getRequest: () => mockRequest as Request,
        getResponse: () => mockResponse as Response,
      }),
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('PII safety in Prisma errors', () => {
    it('should NOT log raw message from PrismaClientValidationError (may contain query args)', () => {
      const piiNoteText = 'SENSITIVE: yardım lazım, coordinates 39.9, 32.8';
      const validationError = new Prisma.PrismaClientValidationError(
        `Invalid query arguments for sosMessage.create:\nReceived: { noteText: "${piiNoteText}" }\nExpected: { noteText?: String }`,
        { clientVersion: '5.22.0' }
      );

      filter.catch(validationError, mockHost);

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const loggedObject = loggerErrorSpy.mock.calls[0][0];

      expect(loggedObject.errorClass).toBe('PrismaClientValidationError');
      expect(loggedObject.path).toBe('/v1/test/endpoint');
      expect(loggedObject.requestId).toBe('test-request-id-123');
      expect(loggedObject.hint).toBeDefined();

      expect(loggedObject.prismaMessage).toBeUndefined();
      const loggedString = JSON.stringify(loggedObject);
      expect(loggedString).not.toContain(piiNoteText);
      expect(loggedString).not.toContain('yardım');
      expect(loggedString).not.toContain('39.9');

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(metricsService.recordHttpStatus).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    });

    it('should log only safe metadata from PrismaClientKnownRequestError', () => {
      const knownError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed on field: incident_id (with PII in message)',
        {
          code: 'P2003',
          clientVersion: '5.22.0',
          meta: {
            modelName: 'SosMessage',
            column_name: 'incident_id',
            field_name: 'incidentId',
          },
        }
      );

      filter.catch(knownError, mockHost);

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const loggedObject = loggerErrorSpy.mock.calls[0][0];

      expect(loggedObject.prismaCode).toBe('P2003');
      expect(loggedObject.modelName).toBe('SosMessage');
      expect(loggedObject.columnName).toBe('incident_id');
      expect(loggedObject.path).toBe('/v1/test/endpoint');
      expect(loggedObject.requestId).toBe('test-request-id-123');

      expect(loggedObject.prismaMessage).toBeUndefined();
    });

    it('should NOT log connection details from PrismaClientInitializationError', () => {
      const initError = new Prisma.PrismaClientInitializationError(
        'Connection string contains DATABASE_URL=postgresql://user:password@host:5432/db',
        '5.22.0'
      );

      filter.catch(initError, mockHost);

      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      const loggedObject = loggerErrorSpy.mock.calls[0][0];

      expect(loggedObject.errorClass).toBe('PrismaClientInitializationError');
      expect(loggedObject.hint).toContain('DATABASE_URL');

      expect(loggedObject.prismaMessage).toBeUndefined();
      const loggedString = JSON.stringify(loggedObject);
      expect(loggedString).not.toContain('password');
      expect(loggedString).not.toContain('postgresql://');
    });
  });

  describe('Known error code handling', () => {
    it('should return 409 for P2002 duplicate constraint', () => {
      const duplicateError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.22.0',
      });

      filter.catch(duplicateError, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'DUPLICATE_MESSAGE_ID',
        })
      );
    });
  });
});
