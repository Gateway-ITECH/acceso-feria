import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import config from 'src/config';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [config.KEY],
      useFactory: (configService: ConfigType<typeof config>) => {
        const { dbName, dbHost, dbPassword, dbPort, dbUsername } =
          configService.database;
        return {
          type: 'postgres',
          port: dbPort, //! Port for postgres
          host: dbHost,
          database: dbName,
          username: dbUsername,
          password: dbPassword,
          autoLoadEntities: true,
          synchronize: true,
        };
      },
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
