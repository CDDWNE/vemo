import { Injectable, NotFoundException, UseInterceptors } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YoutubeApiInterceptor } from '../youtubeauth/youtube-api.interceptor';
import { YoutubeAuthService } from '../youtubeauth/youtube-auth.service';
import { Channel } from './channel.entity';

@Injectable()
export class ChannelService {
    constructor(
        @InjectRepository(Channel)
        private channelRepository: Repository<Channel>,
        private youtubeAuthService: YoutubeAuthService,
        // @Inject(CACHE_MANAGER)
        // private cacheManager: Cache,
    ) {}

    @UseInterceptors(YoutubeApiInterceptor)
    async getChannel(channelId: string): Promise<Channel> {
        // // 1. Redis 캐시 확인
        // const cachedChannel = await this.cacheManager.get<Channel>(`channel:${channelId}`);
        // if (cachedChannel) {
        //     return cachedChannel;
        // }

        // 2. DB 조회
        const existingChannel = await this.findChannelById(channelId);
        if (existingChannel) {
            // DB에서 찾은 데이터 캐싱 (24시간)
            // await this.cacheManager.set(`channel:${channelId}`, existingChannel, 86400000);
            return existingChannel;
        }

        // 3. YouTube API 호출 및 저장
        const newChannel = await this.createChannelFromYoutube(channelId);
        // await this.cacheManager.set(`channel:${channelId}`, newChannel, 86400000);
        return newChannel;
    }

    private async findChannelById(channelId: string): Promise<Channel | null> {
        return await this.channelRepository.findOne({ where: { id: channelId } });
    }

    private async createChannelFromYoutube(channelId: string): Promise<Channel> {
        const channelData = await this.fetchChannelFromYoutube(channelId);
        return await this.saveChannel(channelData);
    }

    private async fetchChannelFromYoutube(channelId: string): Promise<any> {
        const response = await this.youtubeAuthService.youtube.channels.list({
            part: ['snippet', 'contentDetails', 'statistics'],
            id: [channelId],
        });

        const channelData = response.data.items?.[0];
        if (!channelData) {
            throw new NotFoundException(`Channel with ID ${channelId} not found on YouTube`);
        }

        return channelData;
    }

    private async saveChannel(channelData: any): Promise<Channel> {
        const snippet = channelData.snippet || {};
        const thumbnailUrl =
            snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url || '';

        const channel = this.channelRepository.create({
            id: channelData.id,
            thumbnails: thumbnailUrl,
            title: snippet.title,
            videos: [],
        });

        return await this.channelRepository.save(channel);
    }
}
