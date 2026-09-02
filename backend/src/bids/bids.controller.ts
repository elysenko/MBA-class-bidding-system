import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { User } from '@prisma/client';
import { BidsService, PlaceBidDto } from './bids.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { SessionGuard, StudentGuard } from '../auth/guards';

@ApiTags('bids')
@Controller()
@UseGuards(SessionGuard)
export class BidsController {
  constructor(private readonly bids: BidsService) {}

  @Post('bids')
  @UseGuards(StudentGuard)
  place(@CurrentUser() user: User, @Body() dto: PlaceBidDto): Promise<unknown> {
    return this.bids.place(user, dto);
  }

  @Delete('bids/:id')
  @UseGuards(StudentGuard)
  cancel(@CurrentUser() user: User, @Param('id') id: string): Promise<unknown> {
    return this.bids.cancel(user, id);
  }

  @Get('me/bids')
  @UseGuards(StudentGuard)
  mine(@CurrentUser() user: User): Promise<unknown> {
    return this.bids.myBids(user);
  }
}
