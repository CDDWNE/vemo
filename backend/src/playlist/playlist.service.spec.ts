import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistService } from './playlist.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Playlist } from './entities/playlist.entity';
import { Repository } from 'typeorm';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UsersService } from '../users/users.service';
import { VideoService } from '../video/video.service';
import { User } from '../users/users.entity';
import { Video } from '../video/video.entity';
import { Channel } from '../channel/channel.entity';
import { NotFoundException } from '@nestjs/common';

type MockRepository<T = any> = Partial<Record<keyof Repository<T>, jest.Mock>>;

// 리포지토리 모킹 생성 함수
const createMockRepository = <T = any>(): MockRepository<T> => ({
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
});

describe('PlaylistService', () => {
    let service: PlaylistService;
    let playlistRepository: MockRepository<Playlist>;
    let usersService: UsersService;
    let videoService: VideoService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PlaylistService,
                {
                    provide: getRepositoryToken(Playlist),
                    useValue: createMockRepository(),
                },
                {
                    provide: UsersService,
                    useValue: {
                        findById: jest.fn(),
                    },
                },
                {
                    provide: VideoService,
                    useValue: {
                        getVideosByIds: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<PlaylistService>(PlaylistService);
        playlistRepository = module.get<MockRepository<Playlist>>(getRepositoryToken(Playlist));
        usersService = module.get<UsersService>(UsersService);
        videoService = module.get<VideoService>(VideoService);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('재생목록 생성', () => {
        it('재생목록을 성공적으로 생성해야 한다', async () => {
            const createPlaylistDto: CreatePlaylistDto = {
                name: '내 재생목록',
                videoIds: ['video1', 'video2'],
                userId: 1,
            };

            const mockUser: User = {
                id: createPlaylistDto.userId,
            } as User;

            const mockVideos: Video[] = [
                {
                    id: 'video1',
                    title: '비디오 1',
                    thumbnails: 'http://example.com/video1.jpg',
                    duration: '00:10:00',
                    category: '교육',
                    channel: {
                        title: '채널 1',
                        thumbnails: 'http://example.com/channel1.jpg',
                    } as Channel,
                } as Video,
                {
                    id: 'video2',
                    title: '비디오 2',
                    thumbnails: 'http://example.com/video2.jpg',
                    duration: '00:15:00',
                    category: '엔터테인먼트',
                    channel: {
                        title: '채널 2',
                        thumbnails: 'http://example.com/channel2.jpg',
                    } as Channel,
                } as Video,
            ];

            // UsersService.findById 모킹
            (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

            // VideoService.getVideosByIds 모킹
            (videoService.getVideosByIds as jest.Mock).mockResolvedValue(mockVideos);

            // PlaylistRepository.create 모킹
            const mockPlaylist = {
                id: 1,
                name: createPlaylistDto.name,
                user: mockUser,
                videos: mockVideos,
            } as Playlist;
            (playlistRepository.create as jest.Mock).mockReturnValue(mockPlaylist);

            // PlaylistRepository.save 모킹
            (playlistRepository.save as jest.Mock).mockResolvedValue(mockPlaylist);

            // 서비스 메서드 호출
            const result = await service.createPlaylist(createPlaylistDto);

            // 호출된 메서드 검증
            expect(usersService.findById).toHaveBeenCalledWith(createPlaylistDto.userId);
            expect(videoService.getVideosByIds).toHaveBeenCalledWith(createPlaylistDto.videoIds);
            expect(playlistRepository.create).toHaveBeenCalledWith({
                name: createPlaylistDto.name,
                user: mockUser,
                videos: mockVideos,
            });
            expect(playlistRepository.save).toHaveBeenCalledWith(mockPlaylist);

            // 결과 검증
            expect(result).toEqual({
                id: mockPlaylist.id,
                name: mockPlaylist.name,
                userId: mockUser.id,
                videos: mockVideos.map(video => ({
                    id: video.id,
                    title: video.title,
                    thumbnails: video.thumbnails,
                    duration: video.duration,
                    channel: {
                        title: video.channel.title,
                        thumbnails: video.channel.thumbnails,
                    },
                })),
            });
        });

        it('존재하지 않는 사용자의 경우 NotFoundException을 던져야 한다', async () => {
            const createPlaylistDto: CreatePlaylistDto = {
                name: '내 재생목록',
                videoIds: ['video1', 'video2'],
                userId: 999,
            };

            // UsersService.findById를 NotFoundException으로 모킹
            (usersService.findById as jest.Mock).mockRejectedValue(
                new NotFoundException(`User with ID ${createPlaylistDto.userId} not found`),
            );

            // 서비스 메서드 호출 및 예외 검증
            await expect(service.createPlaylist(createPlaylistDto)).rejects.toThrow(
                `User with ID ${createPlaylistDto.userId} not found`,
            );

            expect(usersService.findById).toHaveBeenCalledWith(createPlaylistDto.userId);
            expect(videoService.getVideosByIds).not.toHaveBeenCalled();
            expect(playlistRepository.create).not.toHaveBeenCalled();
            expect(playlistRepository.save).not.toHaveBeenCalled();
        });

        it('존재하지 않는 영상이 포함된 경우 NotFoundException을 던져야 한다', async () => {
            const createPlaylistDto: CreatePlaylistDto = {
                name: '내 재생목록',
                videoIds: ['video1', 'video2', 'video3'],
                userId: 1,
            };

            const mockUser: User = {
                id: createPlaylistDto.userId,
            } as User;

            const mockVideos: Video[] = [
                {
                    id: 'video1',
                    title: '비디오 1',
                    thumbnails: 'http://example.com/video1.jpg',
                    duration: '00:10:00',
                    category: '교육',
                    channel: {
                        title: '채널 1',
                        thumbnails: 'http://example.com/channel1.jpg',
                    } as Channel,
                } as Video,
                {
                    id: 'video2',
                    title: '비디오 2',
                    thumbnails: 'http://example.com/video2.jpg',
                    duration: '00:15:00',
                    category: '엔터테인먼트',
                    channel: {
                        title: '채널 2',
                        thumbnails: 'http://example.com/channel2.jpg',
                    } as Channel,
                } as Video,
            ];

            // UsersService.findById 모킹
            (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

            // VideoService.getVideosByIds 모킹을 NotFoundException으로 설정
            (videoService.getVideosByIds as jest.Mock).mockRejectedValue(
                new NotFoundException('Videos with IDs video3 not found'),
            );

            // 서비스 메서드 호출 및 예외 검증
            await expect(service.createPlaylist(createPlaylistDto)).rejects.toThrow(
                'Videos with IDs video3 not found',
            );

            expect(usersService.findById).toHaveBeenCalledWith(createPlaylistDto.userId);
            expect(videoService.getVideosByIds).toHaveBeenCalledWith(createPlaylistDto.videoIds);
            expect(playlistRepository.create).not.toHaveBeenCalled();
            expect(playlistRepository.save).not.toHaveBeenCalled();
        });
    });

    describe('사용자별 재생목록 조회', () => {
        it('사용자의 모든 재생목록을 성공적으로 조회해야 한다', async () => {
            const userId = 1;
            const mockUser: User = {
                id: userId,
            } as User;

            const mockVideos: Video[] = [
                {
                    id: 'video1',
                    title: '비디오 1',
                    thumbnails: 'http://example.com/video1.jpg',
                    duration: '00:10:00',
                    category: '교육',
                    channel: {
                        title: '채널 1',
                        thumbnails: 'http://example.com/channel1.jpg',
                    } as Channel,
                } as Video,
                {
                    id: 'video2',
                    title: '비디오 2',
                    thumbnails: 'http://example.com/video2.jpg',
                    duration: '00:15:00',
                    category: '엔터테인먼트',
                    channel: {
                        title: '채널 2',
                        thumbnails: 'http://example.com/channel2.jpg',
                    } as Channel,
                } as Video,
            ];

            const mockPlaylists: Playlist[] = [
                {
                    id: 1,
                    name: '재생목록 1',
                    user: mockUser,
                    videos: mockVideos,
                } as Playlist,
                {
                    id: 2,
                    name: '재생목록 2',
                    user: mockUser,
                    videos: [],
                } as Playlist,
            ];

            // UsersService.findById 모킹
            (usersService.findById as jest.Mock).mockResolvedValue(mockUser);

            // PlaylistRepository.find 모킹
            (playlistRepository.find as jest.Mock).mockResolvedValue(mockPlaylists);

            // 서비스 메서드 호출
            const result = await service.getPlaylistsByUser(userId);

            // 검증
            expect(usersService.findById).toHaveBeenCalledWith(userId);
            expect(playlistRepository.find).toHaveBeenCalledWith({
                where: { user: { id: userId } },
                relations: ['videos', 'videos.channel'],
            });

            expect(result).toEqual([
                {
                    id: mockPlaylists[0].id,
                    name: mockPlaylists[0].name,
                    userId: mockUser.id,
                    videos: mockVideos.map(video => ({
                        id: video.id,
                        title: video.title,
                        thumbnails: video.thumbnails,
                        duration: video.duration,
                        channel: {
                            title: video.channel.title,
                            thumbnails: video.channel.thumbnails,
                        },
                    })),
                },
                {
                    id: mockPlaylists[1].id,
                    name: mockPlaylists[1].name,
                    userId: mockUser.id,
                    videos: [],
                },
            ]);
        });

        it('존재하지 않는 사용자의 경우 NotFoundException을 던져야 한다', async () => {
            const userId = 999;

            // UsersService.findById를 NotFoundException으로 모킹
            (usersService.findById as jest.Mock).mockRejectedValue(
                new NotFoundException(`User with ID ${userId} not found`),
            );

            // 서비스 메서드 호출 및 예외 검증
            await expect(service.getPlaylistsByUser(userId)).rejects.toThrow(
                `User with ID ${userId} not found`,
            );

            expect(usersService.findById).toHaveBeenCalledWith(userId);
            expect(playlistRepository.find).not.toHaveBeenCalled();
        });
    });
});
