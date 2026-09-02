import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateClassDto {
  @IsString()
  @MinLength(1, { message: 'Class name cannot be empty.' })
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  faculty?: string;

  @IsOptional()
  @IsString()
  term?: string;

  @IsOptional()
  @IsInt({ message: 'Seat cap must be a whole number.' })
  @Min(1, { message: 'Seat cap must be at least 1.' })
  seatCap?: number;
}

export class UpdateClassDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Class name cannot be empty.' })
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  faculty?: string;

  @IsOptional()
  @IsString()
  term?: string;

  @IsOptional()
  @IsInt({ message: 'Seat cap must be a whole number.' })
  @Min(1, { message: 'Seat cap must be at least 1.' })
  seatCap?: number;
}
