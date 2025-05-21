import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    let message = exceptionResponse.message;

    // Personaliza los mensajes de error aquí
    if (Array.isArray(message)) {
      message = message.map(msg => {
        switch(msg) {
          case 'The password must have a Uppercase, lowercase letter and a number':
            return 'La contraseña debe incluir al menos una letra mayúscula, una letra minúscula y un número.';
          case 'email must be an email':
            return 'El correo electrónico debe ser una dirección válida.';
          default:
            return msg;
        }
      });
    }

    response
      .status(status)
      .json({
        // statusCode: status,
        // error: exceptionResponse.error,
        message,
      });
  }
}
