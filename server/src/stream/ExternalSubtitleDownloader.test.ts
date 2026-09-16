import { tag } from '@tunarr/types';
import fs from 'node:fs/promises';
import path from 'node:path';
import { instance, mock, when } from 'ts-mockito';
import { afterEach, expect, it, vi } from 'vitest';
import type { MediaSourceId } from '../db/schema/base.ts';
import { FileSystemService } from '../services/FileSystemService.ts';
import { Result } from '../types/result.ts';
import { fileExists } from '../util/fsUtil.ts';
import { getSubtitleCacheFilePath } from '../util/subtitles.ts';
import { ExternalSubtitleDownloader } from './ExternalSubtitleDownloader.ts';

vi.mock('../util/fsUtil.ts', () => ({ fileExists: vi.fn() }));

afterEach(() => vi.restoreAllMocks());

it('does not reuse an embedded subtitle cache file with the same index and codec', async () => {
  const item = {
    uuid: 'program-id',
    externalKey: 'episode-id',
    externalSourceId: tag<MediaSourceId>('media-source'),
    sourceType: 'jellyfin' as const,
  };
  const subtitle = { streamIndex: 2, codec: 'subrip' };
  const cacheFolder = path.resolve('subtitle-cache');
  const embeddedPath = path.join(
    cacheFolder,
    getSubtitleCacheFilePath(
      {
        id: item.uuid,
        externalKey: item.externalKey,
        externalSourceId: item.externalSourceId,
        externalSourceType: item.sourceType,
      },
      subtitle,
    )!,
  );
  vi.mocked(fileExists).mockImplementation(
    async (file) => file === cacheFolder || file === embeddedPath,
  );
  vi.spyOn(fs, 'mkdir').mockResolvedValue(undefined);
  vi.spyOn(fs, 'writeFile').mockResolvedValue(undefined);
  const fileSystemService = mock(FileSystemService);
  when(fileSystemService.getSubtitleCacheFolder()).thenReturn(cacheFolder);
  const downloader = new ExternalSubtitleDownloader(
    instance(fileSystemService),
  );
  const download = vi
    .fn()
    .mockResolvedValue(Result.success('French subtitles'));

  const downloadedPath = await downloader.downloadSubtitlesIfNecessary(
    item,
    subtitle,
    download,
  );

  expect(downloadedPath).not.toBe(embeddedPath);
  expect(download).toHaveBeenCalledOnce();
  expect(fs.writeFile).toHaveBeenCalledWith(downloadedPath, 'French subtitles');
});
