import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}

export class StudentLoginDto {
  @IsString()
  @MinLength(1)
  token!: string;
}

export class SignupDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class DemoLoginDto {
  @IsOptional()
  @IsString()
  role?: 'admin' | 'student';
}

export class CreateAdminDto {
  @IsString()
  @MinLength(1, { message: 'Username cannot be empty.' })
  username!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  password!: string;

  @IsOptional()
  @IsEmail({}, { message: 'Enter a valid email address.' })
  email?: string;

  @IsOptional()
  @IsBoolean()
  isRoot?: boolean;
}

export class CreateStudentDto {
  @IsString()
  @MinLength(1, { message: 'Name cannot be empty.' })
  name!: string;

  @IsEmail({}, { message: 'Enter a valid email address.' })
  email!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  pointBalance?: number;
}
