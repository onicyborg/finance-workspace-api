import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const http = context.switchToHttp();
        const response = http.getResponse();
        const statusCode = response?.statusCode;

        if (data && typeof data === 'object' && !Array.isArray(data)) {
          if ('statusCode' in data) {
            return {
              ...data,
              statusCode: (data as any).statusCode ?? statusCode,
            };
          }

          return {
            statusCode,
            ...data,
          };
        }

        return {
          statusCode,
          data,
        };
      }),
    );
  }
}
