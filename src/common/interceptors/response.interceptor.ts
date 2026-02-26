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

        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          'statusCode' in data &&
          'status' in data &&
          'data' in data
        ) {
          return {
            statusCode: (data as any).statusCode ?? statusCode,
            status: (data as any).status ?? 'success',
            data: (data as any).data,
          };
        }

        return {
          statusCode,
          status: 'success',
          data,
        };
      }),
    );
  }
}
