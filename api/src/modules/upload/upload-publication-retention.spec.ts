import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { unlink } from 'fs/promises';
import { UploadService } from './upload.service';

jest.mock('uuid', () => ({ v4: () => 'uuid' }));
jest.mock('fs/promises', () => ({ unlink: jest.fn().mockResolvedValue(undefined), mkdir: jest.fn(), readdir: jest.fn(), stat: jest.fn(), writeFile: jest.fn() }));

describe('Publication media retention', () => {
  beforeEach(() => jest.clearAllMocks());
  function fixture(referenced: boolean, tableExists = true) {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('to_regclass')) return [{ publications: tableExists ? 'event_publications' : null }];
      if (sql.includes('SELECT id FROM event_publications')) return referenced ? [{ id: 'historical' }] : [];
      return [];
    });
    const source = { transaction: jest.fn(async callback => callback({ query })) };
    const service = new UploadService({ get: () => './uploads' } as unknown as ConfigService, source as unknown as DataSource);
    return { service, query };
  }
  it.each(['events/photo.jpg', 'events/video.mp4', 'events/poster.webp'])('blocks historical image/video/poster %s before unlink', async filename => {
    const f = fixture(true);
    await expect(f.service.deleteFile(filename)).rejects.toThrow('发布历史引用');
    expect(unlink).not.toHaveBeenCalled();
    expect(f.query).toHaveBeenCalledWith('LOCK TABLE event_publications IN SHARE MODE');
    expect(f.query).toHaveBeenCalledWith(expect.stringContaining('position($1 IN snapshot::text)'), [`/uploads/${filename}`]);
  });
  it('preserves old unreferenced file deletion and registry cleanup', async () => {
    const f = fixture(false);
    await expect(f.service.deleteFile('events/unreferenced.jpg')).resolves.toBe(true);
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(f.query).toHaveBeenCalledWith('DELETE FROM media_files WHERE filename = $1', ['events/unreferenced.jpg']);
  });
  it('allows old-schema behavior before rollout but never bypasses unexpected database errors', async () => {
    const f = fixture(false, false);
    await expect(f.service.deleteFile('old.jpg')).resolves.toBe(true);
    jest.mocked(unlink).mockClear();
    f.query.mockRejectedValueOnce(new Error('Database unavailable'));
    await expect(f.service.deleteFile('other.jpg')).rejects.toThrow('Database unavailable');
    expect(unlink).not.toHaveBeenCalled();
  });
});
