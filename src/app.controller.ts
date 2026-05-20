import { Controller, Get, Param } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    // This is your first custom API response!
    return 'Welcome to FixConnect API!';
  }

  // Route: GET /greet/:name
  // Example: /greet/Daniel returns "Hello, Daniel!"
  @Get('greet/:name')
  greetUser(@Param('name') name: string): string {
    return `Hello, ${name}!`;
  }
}
