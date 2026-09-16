import { tag } from '@tunarr/types';
import type { EmbyItem as ApiEmbyItem } from '@tunarr/types/emby';
import type { JellyfinItem as ApiJellyfinItem } from '@tunarr/types/jellyfin';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmbyApiClient } from '../../external/emby/EmbyApiClient.ts';
import { JellyfinApiClient } from '../../external/jellyfin/JellyfinApiClient.ts';
import { Result } from '../../types/result.ts';
import { ProgramDaoMinter } from './ProgramMinter.ts';

describe('ProgramDaoMinter subtitles', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['jellyfin', 'emby'] as const)(
    'preserves %s subtitle paths and API indices through import',
    async (sourceType) => {
      const ApiClient =
        sourceType === 'jellyfin' ? JellyfinApiClient : EmbyApiClient;
      const client = new ApiClient(
        { getCanonicalId: (item) => item.Id },
        {
          mediaSource: {
            uuid: tag('media-source'),
            name: tag('Media server'),
            type: sourceType,
            uri: 'http://media.example',
            accessToken: 'test-token',
            username: null,
            userId: null,
            mediaType: null,
            libraries: [],
            paths: [],
            replacePaths: [],
          },
        },
      );
      const item = {
        Id: 'episode-id',
        Type: 'Episode',
        Name: 'Episode with external subtitles',
        RunTimeTicks: 600_000_000,
        MediaSources: [
          {
            Id: 'episode-id',
            Protocol: 'File',
            Path: '/media/episode.mkv',
            MediaStreams: [
              {
                Type: 'Subtitle',
                Index: 0,
                Codec: 'subrip',
                Language: 'fra',
                IsExternal: true,
                Path: '/media/episode.fr.srt',
              },
              {
                Type: 'Subtitle',
                Index: 1,
                Codec: 'subrip',
                Language: 'hin',
                IsExternal: true,
                Path: '/media/episode.hi.srt',
              },
              {
                Type: 'Video',
                Index: 2,
                Codec: 'hevc',
                Width: 704,
                Height: 480,
              },
              {
                Type: 'Audio',
                Index: 3,
                Codec: 'opus',
                Language: 'jpn',
                Channels: 2,
              },
              {
                Type: 'Subtitle',
                Index: 4,
                Codec: 'ass',
                Language: 'eng',
                IsExternal: false,
              },
            ],
          },
        ],
      };
      if (client instanceof JellyfinApiClient) {
        vi.spyOn(client, 'getRawItem').mockResolvedValue(
          Result.success(item as ApiJellyfinItem),
        );
      } else {
        vi.spyOn(client, 'getItem').mockResolvedValue(
          Result.success(item as ApiEmbyItem),
        );
      }

      const episode = (await client.getEpisode('episode-id')).get();
      const subtitles = new ProgramDaoMinter().mintSubtitles(
        'program-id',
        episode,
      );

      expect(subtitles).toEqual([
        expect.objectContaining({
          subtitleType: 'sidecar',
          streamIndex: 0,
          path: '/media/episode.fr.srt',
          language: 'fra',
        }),
        expect.objectContaining({
          subtitleType: 'sidecar',
          streamIndex: 1,
          path: '/media/episode.hi.srt',
          language: 'hin',
        }),
        expect.objectContaining({ subtitleType: 'embedded', streamIndex: 2 }),
      ]);
    },
  );
});
