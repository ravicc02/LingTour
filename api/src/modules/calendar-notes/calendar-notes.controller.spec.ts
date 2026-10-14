import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { CalendarNotesController } from './calendar-notes.controller';
import { CalendarNotesService } from './calendar-notes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtStrategy } from '../auth/jwt.strategy';

const owner = 'a1111111-1111-4111-8111-111111111111';
const id = 'c1111111-1111-4111-8111-111111111111';
const path = '/api/v1/account/calendar-notes';
const input = { date: '2026-10-14', title: 'Plan the afternoon', body: '' };

describe('CalendarNotesController guarded contract', () => {
  let app: INestApplication;
  const service = { list: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue({ id }), create: jest.fn().mockResolvedValue({ id }), update: jest.fn().mockResolvedValue({ id }), remove: jest.fn().mockResolvedValue(undefined) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CalendarNotesController],
      providers: [
        { provide: CalendarNotesService, useValue: service },
        { provide: JwtService, useValue: { verifyAsync: jest.fn(async (token) => { if (token === 'expired') throw new Error('expired'); return { sub: owner, role: token }; }) } },
        { provide: ConfigService, useValue: { get: (key: string) => key === 'frontendUrl' ? 'http://localhost:3000' : 'calendar-test-secret-only' } },
        { provide: JwtStrategy, useValue: { validate: async (payload: { sub: string; role: string }) => payload } },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
    await app.init();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => app.close());

  it('rejects missing/expired auth for every operation', async () => {
    for (const token of [undefined, 'expired']) {
      for (const method of ['get', 'post', 'patch', 'delete'] as const) {
        const url = method === 'get' || method === 'post' ? path : `${path}/${id}`;
        const call = request(app.getHttpServer())[method](url);
        if (token) call.set('Authorization', `Bearer ${token}`);
        await call.send(input).expect(401);
      }
    }
    for (const mock of Object.values(service)) expect(mock).not.toHaveBeenCalled();
  });

  it('allows multi-role travelers but never grants a pure staff bypass', async () => {
    for (const role of ['admin', 'editor']) await request(app.getHttpServer()).get(`${path}?month=2026-10`).set('Authorization', `Bearer ${role}`).expect(403);
    await request(app.getHttpServer()).get(`${path}?month=2026-10`).set('Authorization', 'Bearer admin,traveler').expect(200).expect('Cache-Control', 'private, no-store');
    expect(service.list).toHaveBeenCalledWith(owner, '2026-10');
  });

  it('uses verified cookie identity and blocks cross-origin cookie mutation', async () => {
    await request(app.getHttpServer()).post(path).set('Cookie', 'culvoy_session=traveler').set('Origin', 'http://attacker.invalid').send(input).expect(401);
    expect(service.create).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post(path).set('Cookie', 'culvoy_session=traveler').set('Origin', 'http://localhost:3000').send(input).expect(201);
    expect(service.create).toHaveBeenCalledWith(owner, expect.objectContaining(input));
  });

  it('rejects client identity, timestamp and legacy object injection', async () => {
    for (const patch of [{ userId: owner }, { id }, { createdAt: '2026-10-01' }, { title: { en: 'Legacy' } }]) {
      await request(app.getHttpServer()).post(path).set('Authorization', 'Bearer traveler').send({ ...input, ...patch }).expect(400);
    }
    expect(service.create).not.toHaveBeenCalled();
  });

  it('rejects impossible dates, datetime strings and malformed months', async () => {
    for (const date of ['2026-02-29', '2026-04-31', '2026-10-14T00:00:00Z', '0000-01-01', null]) await request(app.getHttpServer()).post(path).set('Authorization', 'Bearer traveler').send({ ...input, date }).expect(400);
    for (const month of ['2026-13', '0000-01', '2026-1', '']) await request(app.getHttpServer()).get(`${path}?month=${month}`).set('Authorization', 'Bearer traveler').expect(400);
  });

  it('rejects incomplete create payloads and accepts leap-day text without coercion', async () => {
    for (const payload of [{}, { date: input.date }, { ...input, body: undefined }, { ...input, body: 123 }, { ...input, citySlug: 123 }]) {
      await request(app.getHttpServer()).post(path).set('Authorization', 'Bearer traveler').send(payload).expect(400);
    }
    expect(service.create).not.toHaveBeenCalled();
    await request(app.getHttpServer()).post(path).set('Authorization', 'Bearer traveler').send({ ...input, date: '2024-02-29', title: '  Plan  ', citySlug: null }).expect(201).expect('Cache-Control', 'private, no-store');
    expect(service.create).toHaveBeenCalledWith(owner, expect.objectContaining({ date: '2024-02-29', title: 'Plan', body: '', citySlug: null }));
  });

  it('allows city clearing, disallows null required fields, trims blank titles', async () => {
    for (const patch of [{ title: '  ' }, { title: null }, { date: null }, { body: null }, { citySlug: 'Bad City!' }]) await request(app.getHttpServer()).patch(`${path}/${id}`).set('Authorization', 'Bearer traveler').send(patch).expect(400);
    await request(app.getHttpServer()).patch(`${path}/${id}`).set('Authorization', 'Bearer traveler').send({ citySlug: null }).expect(200);
    expect(service.update).toHaveBeenCalledWith(owner, id, expect.objectContaining({ citySlug: null }));
  });

  it('scopes detail/delete and does not publish an endpoint', async () => {
    await request(app.getHttpServer()).get(`${path}/${id}`).set('Authorization', 'Bearer traveler').expect(200);
    expect(service.findOne).toHaveBeenCalledWith(owner, id);
    await request(app.getHttpServer()).delete(`${path}/${id}`).set('Authorization', 'Bearer traveler').expect(204);
    expect(service.remove).toHaveBeenCalledWith(owner, id);
    await request(app.getHttpServer()).get('/api/v1/public/calendar-notes').set('Authorization', 'Bearer traveler').expect(404);
  });
});
