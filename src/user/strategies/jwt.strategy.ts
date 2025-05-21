import { PassportStrategy } from "@nestjs/passport";
import { User } from "../entities/user.entity";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { ExtractJwt, Strategy } from "passport-jwt";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import { UnauthorizedException, Injectable } from '@nestjs/common';

@Injectable()
export class jwtStrategy extends PassportStrategy(Strategy) {

    constructor(
        @InjectRepository(User) private readonly userRepository: Repository<User>,
        configureService: ConfigService
    ) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET,
        });
    }
  

  async validate(payload: JwtPayload): Promise<User> { 
  
    const { id } = payload;
    const user = await this.userRepository.findOneBy({ id });

    if (!user) {
      throw new UnauthorizedException('token no valido');
    }

    if(!user.isActive){
        throw new UnauthorizedException('usuario inactive');
    }

    // console.log({ user })
    return user;
}
}