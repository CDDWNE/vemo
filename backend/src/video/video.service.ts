// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Cache } from 'cache-manager';
import {
    Injectable,
    Logger,
    NotFoundException,
    UnauthorizedException,
    UseInterceptors,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChannelService } from '../channel/channel.service';
import { YoutubeApiInterceptor } from '../youtubeauth/youtube-api.interceptor';
import { YoutubeAuthService } from '../youtubeauth/youtube-auth.service';
import { Video } from './video.entity';

@Injectable()
export class VideoService {
    private readonly logger = new Logger(VideoService.name);

    constructor(
        @InjectRepository(Video)
        private videoRepository: Repository<Video>,
        private youtubeAuthService: YoutubeAuthService,
        private channelService: ChannelService,
        // @Inject(CACHE_MANAGER)
        // private cacheManager: Cache,
    ) {}

    async getVideoById(videoId: string): Promise<Video> {
        // 1. Redis 캐시 확인
        // const cachedVideo = await this.cacheManager.get<Video>(`video:${videoId}`);
        // if (cachedVideo) {
        //     return cachedVideo;
        // }

        // 2. DB 조회
        const existingVideo = await this.findVideoInDatabase(videoId);
        if (existingVideo) {
            // DB에서 찾은 데이터 캐싱 (1시간)
            // await this.cacheManager.set(`video:${videoId}`, existingVideo, 3600000);
            return existingVideo;
        }

        const videoData = await this.fetchVideoFromYouTube(videoId);
        if (!videoData) {
            throw new NotFoundException('Video not found');
        }

        const savedVideo = await this.createAndSaveVideo(videoData);
        // await this.cacheManager.set(`video:${videoId}`, savedVideo, 3600000);

        return savedVideo;
    }

    async findVideoInDatabase(videoId: string): Promise<Video | null> {
        return await this.videoRepository.findOne({
            where: { id: videoId },
            relations: ['channel'],
        });
    }

    @UseInterceptors(YoutubeApiInterceptor)
    async fetchVideoFromYouTube(videoId: string): Promise<any> {
        try {
            const response = await this.youtubeAuthService.youtube.videos.list({
                part: ['snippet', 'contentDetails', 'statistics'],
                id: [videoId],
            });

            return response.data.items?.[0] || null;
        } catch (error) {
            this.logger.error(`Failed to fetch video from YouTube for videoId: ${videoId}`, error);
            throw new UnauthorizedException('YouTube API 호출 실패');
        }
    }

    private async createAndSaveVideo(videoData: any): Promise<Video> {
        const snippet = videoData.snippet || {};
        const contentDetails = videoData.contentDetails || {};

        const channelId = snippet.channelId;
        if (!channelId) {
            throw new NotFoundException('Channel ID not found');
        }

        const channel = await this.channelService.getChannel(channelId);

        const video = this.videoRepository.create({
            id: videoData.id,
            title: snippet.title || '',
            thumbnails: snippet.thumbnails?.high?.url || '',
            duration: this.parseDuration(contentDetails.duration),
            category: snippet.categoryId || '',
            channel,
        });

        return await this.videoRepository.save(video);
    }

    async getAllVideos(page: number = 1, limit: number = 10): Promise<Video[]> {
        const cacheKey = `videos:page:${page}:limit:${limit}`;

        // // 캐시 확인
        // const cachedVideos = await this.cacheManager.get<Video[]>(cacheKey);
        // if (cachedVideos) {
        //     return cachedVideos;
        // }

        // DB 조회
        const videos = await this.videoRepository.find({
            relations: ['channel'],
            order: { id: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        // 결과 캐싱 (5분)
        // await this.cacheManager.set(cacheKey, videos, 300000);

        return videos;
    }

    async getVideosByIds(videoIds: string[]): Promise<Video[]> {
        const videos = await Promise.all(videoIds.map(videoId => this.getVideoById(videoId)));
        if (videos.length !== videoIds.length) {
            const foundVideoIds = videos.map(video => video.id);
            const notFoundVideoIds = videoIds.filter(id => !foundVideoIds.includes(id));
            throw new NotFoundException(`Videos with IDs ${notFoundVideoIds.join(', ')} not found`);
        }
        return videos;
    }

    private parseDuration(duration: string): string {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        const hours = match?.[1] ? parseInt(match[1]) : 0;
        const minutes = match?.[2] ? parseInt(match[2]) : 0;
        const seconds = match?.[3] ? parseInt(match[3]) : 0;
        return [hours, minutes, seconds].map(unit => unit.toString().padStart(2, '0')).join(':');
    }
}
