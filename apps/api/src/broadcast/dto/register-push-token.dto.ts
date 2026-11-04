import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum DevicePlatformDto {
  android = 'android',
  ios = 'ios',
}

export class RegisterPushTokenDto {
  @IsEnum(DevicePlatformDto)
  platform!: DevicePlatformDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  deviceId!: string;
}
