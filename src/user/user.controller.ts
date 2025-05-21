import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  SetMetadata,
  UseFilters,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from './decorator/get-user.decorator';
import { GetRawHeaders } from './decorator/get-rawHeaders.decorator';
import { UseRoleGuard } from './guards/use-role/use-role.guard';
import { RoleProtected } from './decorator/role-protected/role-protected.decorator';
import { ValidRoles } from './interfaces';
import { Auth } from './decorator';
import { HttpExceptionFilter } from 'src/utils/http-exception.filter';
// import { UpdateUserDto } from './dto/update-user.dto';

@Controller('auth')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('register')
  @UseFilters(new HttpExceptionFilter())
  async create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Post('login')
  async login(@Body() loginUserDto: LoginUserDto) {
    return this.userService.login(loginUserDto);
  }

  @Get()
  @UseGuards(AuthGuard(), UseRoleGuard)
  findAll(
    @GetUser() user: User,
    @GetUser('email') email: string,
    @GetRawHeaders() rawHeaders: string[],
    ) {
    // console.log(user, email);
    return {
      user: user,
      email: email,
      rawHeaders: rawHeaders,
    };
  }

  @Get('private')
  // @SetMetadata('roles', ['admin', 'super-user'])
  @RoleProtected()
  @UseGuards(AuthGuard(), UseRoleGuard)
  privateRoute(
    @GetUser() user: User,
  ) {
    return {
      ok: true,
      user: user,
    };
  }

  @Get('private3')
  @Auth()
  privateRoute3(
    @GetUser() user: User,
  ) {
    return {
      ok: true,
      user: user,
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
