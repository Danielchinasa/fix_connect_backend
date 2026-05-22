import { Test, TestingModule } from '@nestjs/testing';
import { SavedAddressesController } from './saved-addresses.controller';
import { SavedAddressesService } from './saved-addresses.service';

describe('SavedAddressesController', () => {
  let controller: SavedAddressesController;
  let service: {
    findMine: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
    setDefault: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      findMine: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      setDefault: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SavedAddressesController],
      providers: [{ provide: SavedAddressesService, useValue: service }],
    }).compile();

    controller = module.get<SavedAddressesController>(SavedAddressesController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  it('findMine passes userId to service', () => {
    service.findMine.mockReturnValueOnce([]);
    controller.findMine('user-1');
    expect(service.findMine).toHaveBeenCalledWith('user-1');
  });

  it('create passes userId and dto to service', async () => {
    const dto = {
      label: 'Home',
      address: '5 Lagos St',
      city: 'Lagos',
      state: 'Lagos',
    };
    service.create.mockResolvedValueOnce({ id: 'addr-1' });
    await controller.create('user-1', dto);
    expect(service.create).toHaveBeenCalledWith('user-1', dto);
  });

  it('update passes userId, id and dto to service', async () => {
    service.update.mockResolvedValueOnce({ id: 'addr-1', label: 'Work' });
    await controller.update('user-1', 'addr-1', { label: 'Work' });
    expect(service.update).toHaveBeenCalledWith('user-1', 'addr-1', {
      label: 'Work',
    });
  });

  it('remove passes userId and id to service', async () => {
    service.remove.mockResolvedValueOnce(undefined);
    await controller.remove('user-1', 'addr-1');
    expect(service.remove).toHaveBeenCalledWith('user-1', 'addr-1');
  });

  it('setDefault passes userId and id to service', async () => {
    service.setDefault.mockResolvedValueOnce({ id: 'addr-1', isDefault: true });
    await controller.setDefault('user-1', 'addr-1');
    expect(service.setDefault).toHaveBeenCalledWith('user-1', 'addr-1');
  });
});
