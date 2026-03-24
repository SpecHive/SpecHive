import { SetMetadata } from '@nestjs/common';

export const EVENT_HANDLER_KEY = Symbol('EventHandlerMeta');

export const EventHandler = (): ClassDecorator => SetMetadata(EVENT_HANDLER_KEY, true);
