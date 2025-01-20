import {
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Memos } from '../memos/memos.entity';
import { Captures } from './captures.entity';
import { CreateCapturesDto } from './dto/create-capture.dto';
import { UpdateCapturesDto } from './dto/update-capture.dto';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
// import { Cache } from 'cache-manager';

@Injectable()
export class CapturesService {
    private readonly logger = new Logger(CapturesService.name);

    constructor(
        @InjectRepository(Memos) private readonly memosRepository: Repository<Memos>,
        @InjectRepository(Captures) private capturesRepository: Repository<Captures>,
        // @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly configService: ConfigService,
    ) {}

    async createCapture(createCapturesDto: CreateCapturesDto, isScrap = false): Promise<Captures> {
        try {
            const { memosId, image, ...rest } = createCapturesDto;

            // memos 존재 여부 확인
            const memos = await this.memosRepository.findOne({
                where: { id: memosId },
            });

            if (!memos) {
                throw new NotFoundException(`Memos with ID ${memosId} not found`);
            }

            // base64 이미지 데이터를 직접 DB에 저장
            const captures = this.capturesRepository.create({
                ...rest,
                memos,
                image: image, // base64 이미지 데이터를 직접 저장
            });

            const savedCapture = await this.capturesRepository.save(captures);
            // await this.invalidateCache();
            return savedCapture;
        } catch (error) {
            this.logger.error('Create capture failed:', error);
            throw new InternalServerErrorException('Failed to create capture', {
                cause: error,
            });
        }
    }

    async getCaptures(): Promise<Captures[]> {
        try {
            // const cacheKey = 'captures:all';
            // const cachedCaptures = await this.cacheManager.get<Captures[]>(cacheKey);

            // if (cachedCaptures) {
            //     this.logger.log('Cache HIT for all captures');
            //     return cachedCaptures;
            // }

            this.logger.log('Cache MISS for all captures');
            const captures = await this.capturesRepository.find({
                relations: ['memos'],
                order: {
                    timestamp: 'ASC',
                },
            });

            // await this.cacheManager.set(cacheKey, captures, 3600);
            return captures;
        } catch (error) {
            throw new InternalServerErrorException('Failed to get captures', {
                cause: error,
            });
        }
    }

    async getCaptureById(id: number): Promise<Captures> {
        try {
            // const cacheKey = `capture:${id}`;
            // const cachedCapture = await this.cacheManager.get<Captures>(cacheKey);

            // if (cachedCapture) {
            //     this.logger.log(`Cache HIT for capture ${id}`);
            //     return cachedCapture;
            // }

            this.logger.log(`Cache MISS for capture ${id}`);
            const capture = await this.capturesRepository.findOne({
                where: { id },
                relations: ['memos'],
            });

            if (!capture) {
                throw new NotFoundException(`Capture with ID ${id} not found`);
            }

            // await this.cacheManager.set(cacheKey, capture, 3600);
            return capture;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to get capture', {
                cause: error,
            });
        }
    }

    async updateCapture(id: number, updateCapturesDto: UpdateCapturesDto): Promise<Captures> {
        try {
            const capture = await this.capturesRepository.findOne({
                where: { id },
                relations: ['memos'],
            });

            if (!capture) {
                throw new NotFoundException(`Capture with ID ${id} not found`);
            }

            // 이미지 데이터 직접 업데이트
            if (updateCapturesDto.image) {
                capture.image = updateCapturesDto.image;
            }

            const updatedCapture = await this.capturesRepository.save(capture);
            // await this.invalidateCache(id);
            return updatedCapture;
        } catch (error) {
            if (error instanceof NotFoundException) {
                throw error;
            }
            throw new InternalServerErrorException('Failed to update capture', {
                cause: error,
            });
        }
    }

    async deleteCapture(id: number): Promise<void> {
        const capture = await this.capturesRepository.findOne({ where: { id } });
        if (!capture) {
            throw new NotFoundException('Capture not found', {
                cause: 'Capture not found',
            });
        }

        await this.capturesRepository.delete(id);
        // await this.invalidateCache(id);
    }

    // private async invalidateCache(id?: number): Promise<void> {
    //     const promises = ['captures:all'];
    //     if (id) {
    //         promises.push(`capture:${id}`);
    //     }
    //     await Promise.all(promises.map(key => this.cacheManager.del(key)));
    //     this.logger.log('Cache invalidated');
    // }
}
