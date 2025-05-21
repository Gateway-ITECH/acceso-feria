import { BadRequestException, CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { META_ROLES } from 'src/user/decorator/role-protected/role-protected.decorator';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class UseRoleGuard implements CanActivate {

  constructor(
    private readonly reflector: Reflector,
  ) {}
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    
    const validRoles = this.reflector.get<string[]>(META_ROLES, context.getHandler());
    // const validRoles: string[] = this.reflector.get('roles', context.getHandler());
    console.log({ validRoles })
    if(validRoles.length === 0) {
      return true;
    }
    
    const req = context.switchToHttp().getRequest();
    const user = req.user as User;

    if(!user) {
      throw new BadRequestException('user not found');
    }

    // const hasRole = () => user.role.some((role) => validRoles.includes(role));
    console.log({ user: user.role })
    for(const role of user.role) {
      if(validRoles.includes(role))
        return true;
    }

    throw new ForbiddenException(
    `User role ${user.role} is not valid. Required roles are [${validRoles}]`
    )
  }
}
